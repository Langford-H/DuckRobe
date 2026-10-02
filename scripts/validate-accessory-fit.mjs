import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Box3, BoxGeometry, BufferAttribute, Matrix4, Mesh, MeshBasicMaterial, Ray, Triangle, Vector3 } from 'three';
import { loadRobot } from '../src/robot.js';
import { ACTIONS } from '../src/behavior.js';
import { ITEMS, OUTFITS, ACCESSORY_REGIONS, createOutfitParts, normalizeSelection } from '../src/outfits.js';
import { meshTriangles, buildTree, boxDistanceSquared, triangleDistanceSquared, closestTriangle, closestPair, insideNative, collectRayHits, topology, uniquePoints } from './accessory-fit-geometry.mjs';

const requested = process.argv.find(arg => arg.startsWith('--items='))?.slice(8).split(',');
const output = path.resolve(process.argv.find(arg => arg.startsWith('--report='))?.slice(9) || 'test-results/accessory-fit.json');
const baseline = process.argv.includes('--baseline');
const staticOnly = process.argv.includes('--static-only');
const threshold = .0008;
const started = performance.now();
const sourceFiles = ['scripts/validate-accessory-fit.mjs', 'scripts/accessory-fit-geometry.mjs', 'src/accessory-geometry.js', 'src/artisan-accessories.js', 'src/garment-primitives.js', 'src/garment-geometry.js', 'src/footwear-geometry.js', 'src/footwear-fit-data.js', 'src/outfits.js', 'src/behavior.js', 'src/robot.js', 'public/robot/manifest.json', 'public/robot/web/kinematics.json', 'public/robot/web/microduck.glb'];
const sourceHash = async () => Object.fromEntries(await Promise.all(sourceFiles.map(async filename => [filename, createHash('sha256').update(await readFile(filename)).digest('hex')])));
const sourceSha256AtStart = await sourceHash();
const publicRoot = path.resolve('public');
const NativeRequest = globalThis.Request;
globalThis.Request = class extends NativeRequest {
  constructor(input, init) { super(typeof input === 'string' ? new URL(input, 'http://duckrobe.local').href : input, init); }
};
globalThis.ProgressEvent ||= class { constructor(type, fields) { this.type = type; Object.assign(this, fields); } };
globalThis.fetch = async input => {
  const url = new URL(typeof input === 'string' ? input : input.url, 'http://duckrobe.local');
  const filename = path.resolve(publicRoot, `.${url.pathname}`);
  assert(filename.startsWith(`${publicRoot}${path.sep}`));
  return new Response(await readFile(filename), { status: 200 });
};
let seed = 3719;
const originalRandom = Math.random;
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const rig = await loadRobot();
Math.random = originalRandom;
rig.animate(0, { enabled: false });
rig.group.updateMatrixWorld(true);
const jaw = rig.group.getObjectByName('microduck_visual_jaw');
assert(jaw, 'Actual visual jaw hinge is required for mouth-motion checks.');

// Test the guard itself before loading author geometry. An enclosed solid is
// rejected even when its surfaces never intersect the other solid's faces.
const probe = new Triangle(new Vector3(0,0,0), new Vector3(1,0,0), new Vector3(0,1,0));
assert(Math.abs(triangleDistanceSquared(probe, new Triangle(new Vector3(0,0,.001), new Vector3(1,0,.001), new Vector3(0,1,.001))) - 1e-6) < 1e-16);
assert.equal(triangleDistanceSquared(probe, new Triangle(new Vector3(.2,.2,-.5), new Vector3(.2,.2,.5), new Vector3(.8,.8,.5))), 0);
assert(triangleDistanceSquared(probe, new Triangle(new Vector3(.1,-.5,0), new Vector3(.1,1.5,0), new Vector3(.2,1.5,0))) < 1e-20);
const tinyTriangle = points => new Triangle(...points.map(([x,y]) => new Vector3(x * 1e-5,y * 1e-5,0)));
const tinyA = tinyTriangle([[-.5,0],[.5,0],[0,-.002]]);
const tinyB = tinyTriangle([[-.5,-.001],[.5,.001],[0,.002]]);
assert(triangleDistanceSquared(tinyA,tinyB) < 1e-24, 'Ten-micrometre skinny coplanar crossings must survive scale-sensitive segment tests.');
assert(new Vector3(...closestPair(tinyA,tinyB).clothingPoint).distanceToSquared(new Vector3(...closestPair(tinyA,tinyB).nativePoint)) < 1e-24);
const fixture = new Mesh(new BoxGeometry(2,2,2), new MeshBasicMaterial());
fixture.updateMatrixWorld(true);
const fixtureTriangles = meshTriangles(fixture, fixture.matrixWorld), fixtureTree = buildTree([...fixtureTriangles]);
assert(topology(fixtureTriangles).closed);
assert(!topology([{ triangle: probe }]).closed);
assert(insideNative(new Vector3(), [['box', fixtureTree]]));
assert.equal(insideNative(new Vector3(2,0,0), [['box', fixtureTree]]), null);
assert(insideNative(new Vector3(.1,.1,.1), [['enclosing-accessory', fixtureTree]]));
fixture.geometry.setAttribute('normal',new BufferAttribute(fixture.geometry.getAttribute('normal').array.slice(0,-6),3));
assert.throws(()=>meshTriangles(fixture,fixture.matrixWorld),/Vertex\/normal count mismatch/, 'Adding cap vertices without extending normals must fail before checking fit.');
fixture.geometry.dispose(); fixture.material.dispose();

const items = ITEMS.filter(item => item.slot === 'accessory' && (!requested || requested.includes(item.id)));
assert(items.length, 'No selected accessory items.');
if (requested) for (const id of requested) assert(items.some(item => item.id === id), `Unknown accessory ${id}`);
const isWing = item => item.region === 'back' && /wing/.test(item.kind);
const report = {
  result: 'passed', minimumRequiredNativeClearance: threshold,
  coordinateFrame: 'Stable trunk_base Z-up clothing anchor, metres; native mesh local frames use actual robot/jaw transforms.',
  method: 'Actual triangle distance/intersections and closed-solid ray parity. AABB distances are conservative lower bounds used only to reject separated candidates. Open tube ends are reported and never assigned an interior volume.',
  fixtures: ['1mm separated faces', 'transverse crossing', 'coplanar crossing', '10µm skinny coplanar crossing', 'closed versus open topology', 'inside/outside solid parity', 'enclosed feature without a face crossing', 'mismatched vertex/normal buffers'],
  limitations: ['Finite manual and autonomous-idle pose samples, not continuous motion proof.', 'Visibility uses surface samples at one front three-quarter view, not every camera direction.', 'Region combination checks cover catalog recipes and stated wing contexts, not every Cartesian product of pieces.'],
  itemCount: items.length, static: [], combinations: [], wings: [], motion: null,
};
const native = [];
rig.group.traverse(mesh => {
  if (!mesh.isMesh || !mesh.userData.meshFile) return;
  const triangles = meshTriangles(mesh, new Matrix4());
  const structure = topology(triangles);
  native.push({ mesh, triangles, tree: buildTree([...triangles]), points: uniquePoints(triangles), box: new Box3().setFromPoints(uniquePoints(triangles)), closed: structure.closed });
});
const geometryCache = new Map(), comparisonCache = new Map();
function prepareFeature(mesh, matrix) {
  const triangles = meshTriangles(mesh, matrix);
  assert(triangles.some(({triangle}) => triangle.getArea() > 1e-16), `Entirely degenerate ${mesh.name}`);
  const hash = createHash('sha256');
  for (const { triangle } of triangles) for (const p of [triangle.a,triangle.b,triangle.c]) hash.update(p.toArray().map(v => v.toPrecision(12)).join(','));
  const signature = hash.digest('hex');
  let geometry = geometryCache.get(signature);
  if (!geometry) {
    const points = uniquePoints(triangles), structure = topology(triangles);
    geometry = { triangles, points, box: new Box3().setFromPoints(points), structure, tree: structure.closed ? buildTree([...triangles]) : null };
    geometryCache.set(signature, geometry);
  }
  const solidPrimitive = ['BoxGeometry','SphereGeometry','CylinderGeometry','ExtrudeGeometry','TorusGeometry'].includes(mesh.geometry.type);
  const wingShell = Boolean(mesh.userData.closedWingSurface);
  const expectedClosedSolid = Boolean(mesh.userData.expectedClosedSolid || solidPrimitive || wingShell || (mesh.geometry.type === 'TubeGeometry' && mesh.geometry.parameters.closed));
  const intendedOpen = mesh.geometry.type === 'TubeGeometry' && !expectedClosedSolid;
  const outwardVolume = geometry.structure.signedVolume * Math.sign(matrix.determinant());
  const topologyViolation = expectedClosedSolid && (!geometry.structure.closed || geometry.structure.inconsistentWindingEdges > 0 || outwardVolume <= 0);
  return { ...geometry, signature, name: mesh.name, type: mesh.geometry.type, intendedOpen, expectedClosedSolid, topologyViolation, closedWingSurface: Boolean(mesh.userData.closedWingSurface) };
}
function preparePart(part) {
  assert(part.bodyName === 'trunk_base', `Unexpected accessory mount ${part.bodyName}`);
  part.group.updateMatrixWorld(true);
  const features = [];
  part.group.traverse(mesh => { if (mesh.isMesh) features.push(prepareFeature(mesh, mesh.matrixWorld)); });
  assert(features.length, `Empty accessory ${part.itemId}`);
  return { ...part, features };
}
function nativeTransforms() {
  rig.group.updateMatrixWorld(true);
  const inverse = rig.anchors.get('trunk_base').matrixWorld.clone().invert();
  return native.map(entry => {
    const toAnchor = new Matrix4().multiplyMatrices(inverse, entry.mesh.matrixWorld);
    return { ...entry, toAnchor, anchorBox: entry.box.clone().applyMatrix4(toAnchor), fromAnchor: toAnchor.clone().invert(), key: toAnchor.elements.map(v => Math.round(v*1e11)).join(',') };
  });
}
function checkFeature(feature, entry) {
  const anchorLowerBound = Math.sqrt(boxDistanceSquared(feature.box, entry.anchorBox));
  if (anchorLowerBound >= threshold) return { lowerBound: anchorLowerBound, crossing: false, embeddedVertices: 0, nativeInsideAccessory: 0, exact: false };
  const key = `${feature.signature}:${entry.mesh.name}:${entry.key}`;
  if (comparisonCache.has(key)) return comparisonCache.get(key);
  const localBox = feature.box.clone().applyMatrix4(entry.fromAnchor);
  const lowerBound = Math.sqrt(boxDistanceSquared(localBox, entry.box));
  if (lowerBound >= threshold) {
    const result = { lowerBound, crossing: false, embeddedVertices: 0, nativeInsideAccessory: 0, exact: false };
    return result;
  }
  const triangles = feature.triangles.map(({ triangle }) => {
    const tri = new Triangle(triangle.a.clone().applyMatrix4(entry.fromAnchor), triangle.b.clone().applyMatrix4(entry.fromAnchor), triangle.c.clone().applyMatrix4(entry.fromAnchor));
    const box = new Box3().setFromPoints([tri.a,tri.b,tri.c]);
    return { triangle: tri, box, center: box.getCenter(new Vector3()), source: feature.name };
  });
  // Only distances below the required clearance need an exact closest pair.
  const best = { distanceSquared: threshold**2 };
  for (const triangle of triangles) closestTriangle(entry.tree, triangle, best);
  const points = feature.points.map(p => p.clone().applyMatrix4(entry.fromAnchor));
  let embeddedVertices = 0, embeddedPoint = null;
  if (entry.closed) for (const p of points) if (insideNative(p, [[entry.mesh.name, entry.tree]])) { embeddedVertices++; embeddedPoint ||= p.clone().applyMatrix4(entry.toAnchor).toArray(); }
  let nativeInsideAccessory = 0;
  if (feature.structure.closed) {
    const tree = buildTree([...triangles]);
    for (const p of entry.points) if (localBox.containsPoint(p) && insideNative(p, [[feature.name, tree]])) nativeInsideAccessory++;
  }
  const witness = best.clothingTriangle ? closestPair(best.clothingTriangle, best.nativeTriangle) : null;
  const result = { lowerBound: Math.sqrt(best.distanceSquared), exact: true,
    crossing: best.distanceSquared < 1e-18, embeddedVertices, nativeInsideAccessory,
    nearestNative: best.nativeSource || null,
    witnessFrame: 'trunk_base stable clothing anchor', embeddedPoint,
    clothingPoint: witness ? new Vector3(...witness.clothingPoint).applyMatrix4(entry.toAnchor).toArray() : null,
    nativePoint: witness ? new Vector3(...witness.nativePoint).applyMatrix4(entry.toAnchor).toArray() : null };
  comparisonCache.set(key, result); return result;
}
function validatePart(part, transforms) {
  const violations = [], features = [];
  for (const feature of part.features) {
    let clearanceLowerBound = Infinity;
    if (feature.topologyViolation) violations.push({ feature: feature.name, type: 'intended-solid-topology', topology: feature.structure });
    for (const entry of transforms) {
      const result = checkFeature(feature, entry);
      clearanceLowerBound = Math.min(clearanceLowerBound, result.lowerBound);
      if (result.crossing || result.embeddedVertices || result.nativeInsideAccessory || result.lowerBound < threshold-1e-10) {
        violations.push({ feature: feature.name, native: entry.mesh.name, type: 'native-clearance', ...result });
      }
    }
    features.push({ name: feature.name, type: feature.type, intendedOpen: feature.intendedOpen, expectedClosedSolid: feature.expectedClosedSolid, topology: feature.structure, clearanceLowerBound });
  }
  if (violations.length) report.result = 'failed';
  return { itemId: part.itemId, region: part.region, bodyName: part.bodyName, features, clearanceLowerBound: Math.min(...features.map(f => f.clearanceLowerBound)), violations };
}
function dispose(parts) {
  for (const part of parts) part.group.traverse(mesh => { if (mesh.isMesh) { mesh.geometry.dispose(); for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) mat.dispose(); } });
}
// Exercise the complete transformed-mesh containment path, not just its ray
// primitive. Bounds separation must never accept a solid enclosing the duck.
const enclosingFixture = new Mesh(new BoxGeometry(2,2,2), new MeshBasicMaterial());
enclosingFixture.name = 'enclosing-fixture'; enclosingFixture.updateMatrixWorld(true);
const smallFixture = new Mesh(new BoxGeometry(.2,.2,.2), new MeshBasicMaterial());
smallFixture.name = 'native-contained-fixture'; smallFixture.updateMatrixWorld(true);
const smallTriangles = meshTriangles(smallFixture,new Matrix4()), smallPoints = uniquePoints(smallTriangles), smallBox = new Box3().setFromPoints(smallPoints);
const containmentFixture = checkFeature(prepareFeature(enclosingFixture,new Matrix4()), { mesh: smallFixture, tree: buildTree([...smallTriangles]), points: smallPoints, closed: true, box: smallBox, anchorBox: smallBox, fromAnchor: new Matrix4(), key: 'identity-fixture' });
assert(containmentFixture.nativeInsideAccessory > 0 && !containmentFixture.crossing, 'Reverse containment must reject an enclosing solid with no face crossing.');
const brokenFixture = new Mesh(new BoxGeometry(.2,.2,.2), new MeshBasicMaterial());
brokenFixture.name = 'declared-closed-buffer-fixture'; brokenFixture.geometry.type = 'BufferGeometry';
brokenFixture.geometry.setIndex(Array.from(brokenFixture.geometry.index.array).slice(3));
brokenFixture.userData.expectedClosedSolid = true;
assert(prepareFeature(brokenFixture, new Matrix4()).topologyViolation, 'A missing face of a declared closed custom mesh must fail topology validation.');
brokenFixture.geometry.dispose(); brokenFixture.material.dispose();
enclosingFixture.geometry.dispose(); enclosingFixture.material.dispose(); smallFixture.geometry.dispose(); smallFixture.material.dispose();
const standalone = items.map(item => ({ item, parts: createOutfitParts({ accessory: item.id }).map(preparePart) }));
const standing = nativeTransforms();
for (const { item, parts } of standalone) report.static.push({ id: item.id, kind: item.kind, region: item.region, parts: parts.map(part => validatePart(part, standing)) });
console.log(`Static native accessory checks: ${items.length} items; ${report.static.filter(row => row.parts.some(p => p.violations.length)).length} failing items.`);

// Simultaneously equipped accessories are distinct objects. A region label
// alone cannot prove their meshes don't intersect or contain one another.
function regionPairs(parts) {
  const violations = [];
  for (let i=0;i<parts.length;i++) for(let j=i+1;j<parts.length;j++) {
    const a=parts[i], b=parts[j]; if(a.region===b.region) continue;
    for(const fa of a.features) for(const fb of b.features) {
      if(boxDistanceSquared(fa.box,fb.box)>1e-18) continue;
      const tree=buildTree([...fb.triangles]), best={distanceSquared:1e-18};
      for(const triangle of fa.triangles) closestTriangle(tree,triangle,best);
      const contains = (fa.structure.closed && fb.points.some(point=>insideNative(point,[[fa.name,fa.tree]]))) || (fb.structure.closed && fa.points.some(point=>insideNative(point,[[fb.name,fb.tree]])));
      if(best.distanceSquared<1e-18 || contains) violations.push({a:a.itemId,b:b.itemId,featureA:fa.name,featureB:fb.name,crossing:best.distanceSquared<1e-18,contains});
    }
  }
  return violations;
}
const selectedIds = new Set(items.map(item => item.id));
const contexts = OUTFITS.filter(look => Object.values(look.selection.accessory).some(id=>selectedIds.has(id))).map(look=>({id:look.id,selection:look.selection}));
const byKind = kind => ITEMS.find(item=>item.slot==='body'&&item.kind===kind)?.id;
const chest = ITEMS.find(item=>item.slot==='accessory'&&item.kind==='brooch')?.id || ITEMS.find(item=>item.slot==='accessory'&&item.region==='chest')?.id;
const side = ITEMS.find(item=>item.slot==='accessory'&&item.kind==='satchel')?.id || ITEMS.find(item=>item.slot==='accessory'&&item.region==='side')?.id;
for(const item of items.filter(isWing)) for(const kind of ['puffer','petal-dress','wizard-cape']) {
  const body=byKind(kind);assert(body,`Missing wing body context ${kind}`);
  contexts.push({id:`wing:${item.id}:${kind}`,wingItem:item,selection:normalizeSelection({body,accessory:{chest,side,back:item.id}})});
}
const motionParts = [...standalone.flatMap(record=>record.parts)];
for(const context of contexts) {
  const parts=createOutfitParts(context.selection);
  // A targeted item still participates in the complete equipped region set.
  // Filtering its neighbours out here would silently skip pair collisions.
  const accessory=parts.filter(part=>part.slot==='accessory').map(preparePart);
  const collisions=regionPairs(accessory);
  const nativeResults=accessory.map(part=>validatePart(part,standing));
  if(collisions.length) report.result='failed';
  report.combinations.push({id:context.id,selection:context.selection,testedAccessoryItemIds:accessory.map(part=>part.itemId),nativeResults,regionCollisions:collisions});
  motionParts.push(...accessory);
  // Wing visibility and placement use geometry in the same anchor as fitting.
  const wingPart=accessory.find(part=>isWing(ITEMS.find(item=>item.id===part.itemId)));
  if(wingPart) {
    // Contacts and bridges intentionally meet the cloth nearer the trunk.
    // Measure only the tagged aerodynamic surfaces, not a kind-name prefix
    // that also appears on every hinge, contact pad and support in the group.
    const surfaces=wingPart.features.filter(f=>f.closedWingSurface);
    assert(surfaces.length, `Missing tagged closed wing surfaces for ${wingPart.itemId}`);
    const camera=new Vector3(.45,-.38,.30), blockers=[];
    for(const part of parts) if(part.itemId!==wingPart.itemId) {
      part.group.updateMatrixWorld(true);
      const transform=new Matrix4().multiplyMatrices(rig.anchors.get('trunk_base').matrixWorld.clone().invert(),rig.anchors.get(part.bodyName).matrixWorld);
      part.group.traverse(mesh=>{if(mesh.isMesh){const tris=meshTriangles(mesh,new Matrix4().multiplyMatrices(transform,mesh.matrixWorld));blockers.push(buildTree([...tris]));}});
    }
    const visibility={negativeY:{samples:0,visible:0},positiveY:{samples:0,visible:0}};
    for(const surface of surfaces) {
      const step=Math.max(1,Math.ceil(surface.triangles.length/96));
      for(let i=0;i<surface.triangles.length;i+=step) {
        const p=surface.triangles[i].triangle.getMidpoint(new Vector3()), side=p.y<0?'negativeY':'positiveY';
        visibility[side].samples++;
        let obscured=false;
        for(const entry of standing) {
          const from=camera.clone().applyMatrix4(entry.fromAnchor),to=p.clone().applyMatrix4(entry.fromAnchor),dir=to.clone().sub(from),length=dir.length(),hits=[];
          collectRayHits(entry.tree,new Ray(from,dir.normalize()),hits);
          if(hits.some(distance=>distance<length-1e-6)){obscured=true;break;}
        }
        if(!obscured)for(const blocker of blockers){const direction=p.clone().sub(camera),length=direction.length(),hits=[];collectRayHits(blocker,new Ray(camera,direction.normalize()),hits);if(hits.some(distance=>distance<length-1e-6)){obscured=true;break;}}
        if(!obscured)visibility[side].visible++;
      }
    }
    const surfaceBox=new Box3();for(const surface of surfaces)surfaceBox.union(surface.box);
    const placedBehind=surfaceBox.max.x<-.06;
    const visible=Object.values(visibility).every(side=>side.samples>0&&side.visible>0);
    if(!placedBehind||!visible)report.result='failed';
    report.wings.push({context:context.id,itemId:wingPart.itemId,bodyName:wingPart.bodyName,surfaceBounds:{min:surfaceBox.min.toArray(),max:surfaceBox.max.toArray()},camera:camera.toArray(),placedBehind,visibility,visible});
  }
  // Accessory features have independent copied triangle data for motion checks.
  dispose(parts);
}
console.log(`Region contexts: ${contexts.length}; wing visibility contexts: ${report.wings.length}.`);

if(!staticOnly) {
  let time=0,dt=1/60;
  const capture=(label,progress)=>({label,progress,joints:Object.fromEntries([...rig.joints].map(([name,joint])=>[name,joint.angle])),jawQuaternion:jaw.quaternion.toArray()});
  const sampled=[];
  const extremaNames=['neck_pitch','head_pitch','head_yaw','head_roll','left_hip_pitch','right_hip_pitch','left_knee','right_knee'];
  function selectExtrema(poses,uniform) {
    const selected=new Set(uniform);
    for(const name of [...extremaNames,'jawAngle'])for(const mode of ['min','max']){
      let best=0;const value=pose=>name==='jawAngle'?2*Math.acos(Math.min(1,Math.abs(pose.jawQuaternion[3]))):pose.joints[name];
      for(let i=1;i<poses.length;i++)if(mode==='min'?value(poses[i])<value(poses[best]):value(poses[i])>value(poses[best]))best=i;
      selected.add(best);
    }
    return [...selected].sort((a,b)=>a-b).map(i=>poses[i]);
  }
  for(const action of ACTIONS){
    for(let i=0;i<90;i++)rig.animate(time+=dt,{enabled:false});
    assert(rig.trigger(action.id));const poses=[];
    for(let i=0;i<=Math.ceil(action.duration/dt);i++){rig.animate(time+=dt,{enabled:false});poses.push(capture(`manual:${action.id}`,i*dt/action.duration));}
    sampled.push(...selectExtrema(poses,[0,...[.2,.4,.6,.8,1].map(progress=>Math.min(poses.length-1,Math.round(progress*action.duration/dt)))]));
  }
  for(let i=0;i<120;i++)rig.animate(time+=dt,{enabled:false});
  const idle=new Map();
  for(let i=0;i<7200;i++){
    const state=rig.animate(time+=dt,{enabled:true});
    const list=idle.get(state.kind)||[];list.push(capture(`idle:${state.kind}`,i*dt));idle.set(state.kind,list);
  }
  for(const poses of idle.values()) sampled.push(...selectExtrema(poses,[0,Math.floor(poses.length/2),poses.length-1]));
  const uniqueParts=[...new Map(motionParts.map(part=>[part.features.map(f=>f.signature).join('|'),part])).values()];
  report.motion={manualActions:ACTIONS.length,idleSeconds:120,idleKinds:[...idle.keys()],poseSamples:sampled.length,uniqueAccessoryGeometries:uniqueParts.length,actualJawHinge:true,maximumJawOpening:Math.max(...sampled.map(p=>2*Math.acos(Math.min(1,Math.abs(p.jawQuaternion[3]))))),poses:[]};
  for(let index=0;index<sampled.length;index++){
    const pose=sampled[index];for(const[name,angle]of Object.entries(pose.joints))rig.setJoint(name,angle);jaw.quaternion.fromArray(pose.jawQuaternion);rig.group.updateMatrixWorld(true);
    const transforms=nativeTransforms(),failures=[];
    for(const part of uniqueParts){const result=validatePart(part,transforms);if(result.violations.length)failures.push({itemId:part.itemId,region:part.region,violations:result.violations});}
    report.motion.poses.push({...pose,failures});
    if((index+1)%25===0)console.log(`Accessory actual-pose checks ${index+1}/${sampled.length}.`);
  }
}
for(const record of standalone)dispose(record.parts);
report.nativeMeshes=native.length;
report.nativeClosedMeshes=native.filter(entry=>entry.closed).length;
report.elapsedSeconds=(performance.now()-started)/1000;
report.geometryComparisons=comparisonCache.size;
report.sourceSha256 = sourceSha256AtStart;
report.sourceSha256AtEnd = await sourceHash();
report.sourceStayedUnchanged = JSON.stringify(report.sourceSha256) === JSON.stringify(report.sourceSha256AtEnd);
if (!baseline && !report.sourceStayedUnchanged) report.result = 'failed';
await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({result:report.result,items:report.itemCount,contexts:report.combinations.length,wings:report.wings.length,poseSamples:report.motion?.poseSamples||0,maximumJawOpening:report.motion?.maximumJawOpening||0,seconds:report.elapsedSeconds,report:output},null,2));
if(!baseline)assert.equal(report.result,'passed','Accessory native geometry, region combination, topology or wing placement/visibility checks failed.');
