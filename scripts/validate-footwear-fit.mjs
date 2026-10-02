import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ACTIONS } from '../src/behavior.js';
import { Box3, Matrix4, Ray, Triangle, Vector3 } from 'three';
import { loadRobot } from '../src/robot.js';
import { ITEMS, createOutfitParts } from '../src/outfits.js';

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

// BVH boxes only select candidate triangles. Clearance comes from actual
// triangle intersections, vertex-to-face and all nine edge-to-edge distances.
function meshTriangles(mesh, transform) {
  const positions = mesh.geometry.getAttribute('position'), index = mesh.geometry.index;
  const count = index?.count || positions.count, triangles = [];
  for (let i = 0; i < count; i += 3) {
    const vertices = [0, 1, 2].map(offset => {
      const vertex = index ? index.getX(i + offset) : i + offset;
      const point = new Vector3().fromBufferAttribute(positions, vertex).applyMatrix4(transform);
      assert(point.toArray().every(Number.isFinite), `Invalid vertex in ${mesh.name}`);
      return point;
    });
    const triangle = new Triangle(...vertices), box = new Box3().setFromPoints(vertices);
    triangles.push({ triangle, box, center: box.getCenter(new Vector3()), source: mesh.userData.meshFile || mesh.name });
  }
  return triangles;
}
function buildTree(triangles) {
  const box = new Box3(); triangles.forEach(item => box.union(item.box));
  if (triangles.length <= 16) return { box, triangles };
  const size = box.getSize(new Vector3()), axis = size.x >= size.y && size.x >= size.z ? 'x' : size.y >= size.z ? 'y' : 'z';
  triangles.sort((a, b) => a.center[axis] - b.center[axis]);
  const middle = Math.floor(triangles.length / 2);
  return { box, left: buildTree(triangles.slice(0, middle)), right: buildTree(triangles.slice(middle)) };
}
function boxDistanceSquared(a, b) {
  const x = Math.max(0, a.min.x - b.max.x, b.min.x - a.max.x);
  const y = Math.max(0, a.min.y - b.max.y, b.min.y - a.max.y);
  const z = Math.max(0, a.min.z - b.max.z, b.min.z - a.max.z);
  return x * x + y * y + z * z;
}
function segmentDistanceSquared(p1, q1, p2, q2, witness) {
  const ux = q1.x - p1.x, uy = q1.y - p1.y, uz = q1.z - p1.z;
  const vx = q2.x - p2.x, vy = q2.y - p2.y, vz = q2.z - p2.z;
  const wx = p1.x - p2.x, wy = p1.y - p2.y, wz = p1.z - p2.z;
  const a = ux * ux + uy * uy + uz * uz, b = ux * vx + uy * vy + uz * vz;
  const c = vx * vx + vy * vy + vz * vz, d = ux * wx + uy * wy + uz * wz, e = vx * wx + vy * wy + vz * wz;
  const clamp = value => Math.max(0, Math.min(1, value));
  let s = 0, t = 0;
  if (a < 1e-24 && c < 1e-24) { if (witness) { witness.a = p1.toArray(); witness.b = p2.toArray(); } return wx * wx + wy * wy + wz * wz; }
  if (a < 1e-24) t = clamp(e / c);
  else if (c < 1e-24) s = clamp(-d / a);
  else {
    const denominator = a * c - b * b;
    if (denominator > 1e-24) s = clamp((b * e - c * d) / denominator);
    t = (b * s + e) / c;
    if (t < 0) { t = 0; s = clamp(-d / a); }
    else if (t > 1) { t = 1; s = clamp((b - d) / a); }
  }
  if (witness) { witness.a = [p1.x + s * ux, p1.y + s * uy, p1.z + s * uz]; witness.b = [p2.x + t * vx, p2.y + t * vy, p2.z + t * vz]; }
  return (wx + s * ux - t * vx) ** 2 + (wy + s * uy - t * vy) ** 2 + (wz + s * uz - t * vz) ** 2;
}
const ray = new Ray(), direction = new Vector3(), intersection = new Vector3(), closest = new Vector3();
function segmentIntersectsTriangle(start, end, triangle) {
  direction.subVectors(end, start); const length = direction.length();
  if (length < 1e-12) return false;
  ray.set(start, direction.multiplyScalar(1 / length));
  const hit = ray.intersectTriangle(triangle.a, triangle.b, triangle.c, false, intersection);
  return Boolean(hit && hit.distanceToSquared(start) <= (length + 1e-10) ** 2);
}
function triangleDistanceSquared(a, b) {
  const ap = [a.a, a.b, a.c], bp = [b.a, b.b, b.c];
  for (let i = 0; i < 3; i++) {
    if (segmentIntersectsTriangle(ap[i], ap[(i + 1) % 3], b) || segmentIntersectsTriangle(bp[i], bp[(i + 1) % 3], a)) return 0;
  }
  let minimum = Infinity;
  for (const point of ap) { b.closestPointToPoint(point, closest); if (closest.toArray().every(Number.isFinite)) minimum = Math.min(minimum, point.distanceToSquared(closest)); }
  for (const point of bp) { a.closestPointToPoint(point, closest); if (closest.toArray().every(Number.isFinite)) minimum = Math.min(minimum, point.distanceToSquared(closest)); }
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) minimum = Math.min(minimum, segmentDistanceSquared(ap[i], ap[(i + 1) % 3], bp[j], bp[(j + 1) % 3]));
  return minimum;
}
function closestPair(a, b) {
  const ap = [a.a, a.b, a.c], bp = [b.a, b.b, b.c]; let distanceSquared = Infinity, result;
  const record = (distance, aa, bb) => { if (distance < distanceSquared) { distanceSquared = distance; result = { clothingPoint: aa, nativePoint: bb }; } };
  for (let i = 0; i < 3; i++) {
    if (segmentIntersectsTriangle(ap[i], ap[(i + 1) % 3], b) || segmentIntersectsTriangle(bp[i], bp[(i + 1) % 3], a)) return { clothingPoint: intersection.toArray(), nativePoint: intersection.toArray() };
  }
  for (const point of ap) { b.closestPointToPoint(point, closest); record(point.distanceToSquared(closest), point.toArray(), closest.toArray()); }
  for (const point of bp) { a.closestPointToPoint(point, closest); record(point.distanceToSquared(closest), closest.toArray(), point.toArray()); }
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const witness = {}; const distance = segmentDistanceSquared(ap[i], ap[(i + 1) % 3], bp[j], bp[(j + 1) % 3], witness); record(distance, witness.a, witness.b); }
  return result;
}
function closestTriangle(tree, item, best) {
  if (boxDistanceSquared(tree.box, item.box) > best.distanceSquared) return;
  if (tree.triangles) {
    for (const candidate of tree.triangles) {
      if (boxDistanceSquared(candidate.box, item.box) > best.distanceSquared) continue;
      const distanceSquared = triangleDistanceSquared(item.triangle, candidate.triangle);
      if (distanceSquared < best.distanceSquared) { best.distanceSquared = distanceSquared; best.nativeSource = candidate.source; best.clothingSource = item.source; best.clothingCenter = item.center.toArray(); best.clothingTriangle = item.triangle; best.nativeTriangle = candidate.triangle; }
    }
    return;
  }
  const left = boxDistanceSquared(tree.left.box, item.box), right = boxDistanceSquared(tree.right.box, item.box);
  closestTriangle(left <= right ? tree.left : tree.right, item, best);
  closestTriangle(left <= right ? tree.right : tree.left, item, best);
}

// Odd/even ray parity is evaluated separately for each native closed mesh.
// This excludes a connected feature entirely embedded in the shell even when
// its triangles do not cross the shell. The ray avoids mesh principal axes.
const parityDirection = new Vector3(.7341, .4832, .4777).normalize();
function collectRayHits(tree, probeRay, distances) {
  if (!probeRay.intersectsBox(tree.box)) return;
  if (tree.triangles) {
    for (const item of tree.triangles) {
      const hit=probeRay.intersectTriangle(item.triangle.a,item.triangle.b,item.triangle.c,false,new Vector3());
      if(hit) distances.push(hit.distanceTo(probeRay.origin));
    }
  } else { collectRayHits(tree.left,probeRay,distances); collectRayHits(tree.right,probeRay,distances); }
}
function insideNative(point, trees) {
  for (const [source,tree] of trees) {
    if(!tree.box.containsPoint(point)) continue;
    const hits=[]; collectRayHits(tree,new Ray(point,parityDirection),hits);
    hits.sort((a,b)=>a-b);const distinct=hits.filter((v,i)=>i===0||v-hits[i-1]>1e-8);
    if(distinct.length%2===1) return source;
  }
  return null;
}
await mkdir('test-results', { recursive: true });
const rig = await loadRobot(); rig.animate(0, false);rig.group.updateMatrixWorld(true);
// Regression fixtures exercise exact crossing, coplanar overlap, true separated
// surfaces, and a feature entirely inside a closed native solid without crossings.
const probe=new Triangle(new Vector3(0,0,0),new Vector3(1,0,0),new Vector3(0,1,0));
assert(Math.abs(triangleDistanceSquared(probe,new Triangle(new Vector3(0,0,.001),new Vector3(1,0,.001),new Vector3(0,1,.001)))-1e-6)<1e-16);
assert.equal(triangleDistanceSquared(probe,new Triangle(new Vector3(.2,.2,-.5),new Vector3(.2,.2,.5),new Vector3(.8,.8,.5))),0);
assert(triangleDistanceSquared(probe,new Triangle(new Vector3(.1,-.5,0),new Vector3(.1,1.5,0),new Vector3(.2,1.5,0)))<1e-20);
const {BoxGeometry,Mesh,MeshBasicMaterial}=await import('three');
const fixtureMesh=new Mesh(new BoxGeometry(2,2,2),new MeshBasicMaterial());fixtureMesh.updateMatrixWorld(true);
const fixtureTriangles=meshTriangles(fixtureMesh,fixtureMesh.matrixWorld),fixtureTree=buildTree(fixtureTriangles);
assert(closedSurface(fixtureTriangles), 'Closed solid fixture must have two faces per welded edge');
assert(!closedSurface([{ triangle: probe }]), 'An open sheet must not define a volume');
assert.equal(insideNative(new Vector3(0,0,0),[['box',fixtureTree]]),'box');assert.equal(insideNative(new Vector3(2,0,0),[['box',fixtureTree]]),null);
// Enlarging a filled shoe around a small native solid must fail even though
// none of the filled shoe's vertices or faces cross the native surface.
const tinyNativeMesh = new Mesh(new BoxGeometry(.2,.2,.2),new MeshBasicMaterial());tinyNativeMesh.updateMatrixWorld(true);
const tinyNativeTriangles = meshTriangles(tinyNativeMesh,tinyNativeMesh.matrixWorld),tinyNativeTree = buildTree(tinyNativeTriangles);
assert(fixtureTriangles.every(({triangle}) => !insideNative(triangle.a,[['native',tinyNativeTree]])));
assert.equal(insideNative(tinyNativeTriangles[0].triangle.a,[['filled-shoe',fixtureTree]]),'filled-shoe');
tinyNativeMesh.geometry.dispose();tinyNativeMesh.material.dispose();

const inner=new Triangle(new Vector3(.1,.1,.1),new Vector3(.2,.1,.1),new Vector3(.1,.2,.1)),innerItem={triangle:inner,box:new Box3().setFromPoints([inner.a,inner.b,inner.c]),center:new Vector3(.14,.14,.1),source:'contained-fixture'},innerBest={distanceSquared:Infinity};closestTriangle(fixtureTree,innerItem,innerBest);assert(innerBest.distanceSquared>.5);assert.equal(insideNative(inner.a,[['box',fixtureTree]]),'box');fixtureMesh.geometry.dispose();fixtureMesh.material.dispose();
const threshold=.0008;
const items=ITEMS.filter(item=>item.slot==='legwear');assert.equal(items.length,28);
const startedAt=performance.now();
const report={coordinateFrame:'Each garment part native clothing anchor, metres, +X front / +Z up in DEFAULT_POSE',method:'Actual native GLB triangles vs generated garment triangles. Bounds only prune BVH candidates; exact segment/triangle, point/face, all edge/edge distances, native closed surface parity checks all clothing vertices, and reverse containment rejects native vertices hidden inside filled garment solids.',minimumRequiredClearance:threshold,fixtures:['parallel surfaces with 1mm known gap','transverse triangle crossing','coplanar edge-only overlap','native inside/outside parity','contained feature without any face crossing','closed manifold versus open sheet topology','reverse filled-solid containment'],itemCount:items.length,states:[],result:'passed'};
const nativeMeshes=[];rig.group.traverse(mesh=>{if(mesh.isMesh&&mesh.userData.meshFile&&['ankle_left','ankle_right','leg','leg_2','upper_leg_left','upper_leg_right'].includes(mesh.userData.bodyName))nativeMeshes.push(mesh);});
const cache = new Map(), nativeTransformKeys = new Set();
function nativeFor(bodyName, movingOnly = false) {
  const adjacent = bodyName === 'ankle_left' ? ['ankle_left', 'leg']
    : bodyName === 'ankle_right' ? ['ankle_right', 'leg_2']
    : bodyName === 'leg' ? ['leg', 'ankle_left', 'upper_leg_left'] : ['leg_2', 'ankle_right', 'upper_leg_right'];
  const inverse = rig.anchors.get(bodyName).matrixWorld.clone().invert();
  const meshes = nativeMeshes.filter(mesh => adjacent.includes(mesh.userData.bodyName) && (!movingOnly || mesh.userData.bodyName !== bodyName));
  const transforms = meshes.map(mesh => new Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
  // Quantization is 0.01 micrometres, far below the 0.8 mm fit threshold.
  const key = `${bodyName}:${movingOnly}:${transforms.map(m => m.elements.map(v => Math.round(v * 1e8)).join(',')).join(';')}`;
  if (cache.has(key)) return cache.get(key);
  const triangles = [], trees = [], points = [];
  meshes.forEach((mesh, index) => {
    const part = meshTriangles(mesh, transforms[index]); part.forEach(t => t.source = mesh.name);
    triangles.push(...part); trees.push([mesh.name, buildTree([...part])]);
    const seen = new Set();
    for (const { triangle } of part) for (const point of [triangle.a, triangle.b, triangle.c]) {
      const key = point.toArray().map(v => Math.round(v * 1e8)).join(',');
      if (!seen.has(key)) { seen.add(key); points.push({ point, source: mesh.name }); }
    }
  });
  const value = { key, tree: buildTree(triangles), trees, points, triangles: triangles.length };
  nativeTransformKeys.add(key);
  if (cache.size >= 4) cache.delete(cache.keys().next().value);
  cache.set(key, value); return value;
}
const baseline = process.argv.includes('--baseline');
const validationCache = new Map(), featureCache = new Map();
function closedSurface(triangles) {
  const edges = new Map();
  const vertexKey = p => p.toArray().map(v => Math.round(v * 1e8)).join(',');
  for (const { triangle } of triangles) {
    const vertices = [triangle.a, triangle.b, triangle.c].map(vertexKey);
    if (new Set(vertices).size < 3) continue;
    for (let i = 0; i < 3; i++) {
      const key = [vertices[i], vertices[(i + 1) % 3]].sort().join(';');
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  return edges.size > 0 && [...edges.values()].every(count => count === 2);
}
function preparePart(part) {
  part.group.updateMatrixWorld(true);
  const features = [], hash = createHash('sha256');
  part.group.traverse(mesh => {
    if (!mesh.isMesh) return;
    const triangles = meshTriangles(mesh, mesh.matrixWorld), seen = new Set(), points = [];
    hash.update(`${triangles.length};`);
    for (const { triangle } of triangles) for (const point of [triangle.a, triangle.b, triangle.c]) {
      const key = point.toArray().map(v => Math.round(v * 1e8)).join(',');
      hash.update(key); if (!seen.has(key)) { seen.add(key); points.push(point); }
    }
    const closed = closedSurface(triangles);
    const bounds = new Box3().setFromPoints(points);
    features.push({ name: mesh.name, triangles, points, bounds, closed, tree: closed ? buildTree([...triangles]) : null });
  });
  const signature = hash.digest('hex');
  const existing = featureCache.get(signature);
  if (!existing) featureCache.set(signature, features);
  return { ...part, features: existing || features, signature };
}
function validatePart(part, movingOnly = false) {
  const native = nativeFor(part.bodyName, movingOnly), key = `${part.signature}:${native.key}`;
  if (validationCache.has(key)) return validationCache.get(key);
  const features = part.features.map(feature => {
    const best = { distanceSquared: Infinity };
    for (const triangle of feature.triangles) closestTriangle(native.tree, triangle, best);
    let embeddedVertices = 0; const embeddedExamples = [];
    for (const point of feature.points) {
      const containedIn = insideNative(point, native.trees);
      if (containedIn) { embeddedVertices++; if (embeddedExamples.length < 3) embeddedExamples.push({ containedIn, point: point.toArray() }); }
    }
    // Reverse containment rejects an enlarged solid that encloses the native
    // robot while every garment vertex happens to be outside it. Only proven
    // closed manifold garment solids use parity; an open fabric sheet cannot
    // define an interior volume.
    let nativeInsideClosedGarment = 0; const nativeInsideExamples = [];
    if (feature.closed) for (const { point, source } of native.points) {
      if (insideNative(point, [[feature.name, feature.tree]])) {
        nativeInsideClosedGarment++;
        if (nativeInsideExamples.length < 3) nativeInsideExamples.push({ source, point: point.toArray() });
      }
    }
    const witness = closestPair(best.clothingTriangle, best.nativeTriangle);
    const entry = { feature: feature.name, triangles: feature.triangles.length, closedSurface: feature.closed,
      nativeInsideClosedGarment, nativeInsideExamples, bounds: { min: feature.bounds.min.toArray(), max: feature.bounds.max.toArray() }, minimumClearance: Math.sqrt(best.distanceSquared),
      intersects: best.distanceSquared < 1e-18, nearestNative: best.nativeSource, nearestCenter: best.clothingCenter, ...witness, embeddedVertices, embeddedExamples };
    if (entry.minimumClearance < threshold || embeddedVertices || nativeInsideClosedGarment) report.result = 'failed';
    return entry;
  });
  const result = { bodyName: part.bodyName, nativeTriangles: native.triangles, minimumClearance: Math.min(...features.map(f => f.minimumClearance)), features };
  validationCache.set(key, result); return result;
}
function concise(result) {
  return { bodyName: result.bodyName, minimumClearance: result.minimumClearance,
    crossingFeatures: result.features.filter(f => f.intersects).length,
    embeddedFeatures: result.features.filter(f => f.embeddedVertices).length,
    violations: result.features.filter(f => f.minimumClearance < threshold || f.embeddedVertices || f.nativeInsideClosedGarment).map(f => ({ feature: f.feature, nearestNative: f.nearestNative, nearestCenter: f.nearestCenter, clothingPoint: f.clothingPoint, nativePoint: f.nativePoint, minimumClearance: f.minimumClearance, embeddedVertices: f.embeddedVertices, nativeInsideClosedGarment: f.nativeInsideClosedGarment })) };
}
// Capture factories before checks, so edits in another process cannot mutate
// a slow baseline run. Geometric signatures ignore materials and item IDs.
const factory = items.map(item => ({ item, parts: createOutfitParts({ legwear: item.id }).map(preparePart) }));
if (baseline) await writeFile('test-results/footwear-before-parts.json', JSON.stringify(factory.map(({ item, parts }) => ({ id: item.id, kind: item.kind, name: item.name, parts: parts.map(part => ({ bodyName: part.bodyName, group: part.group.toJSON() })) }))));
report.anatomyChecks = [];
for (const { item, parts } of factory) {
  const results = parts.map(part => validatePart(part));
  if (item.kind !== 'socks' && parts.every(part => part.bodyName.startsWith('ankle_'))) for (const result of results) {
    const upper = result.features.find(feature => feature.feature.endsWith('hollow-fitted-shoe-upper'));
    const sole = result.features.find(feature => feature.feature.endsWith('complete-contoured-sole'));
    const soleThickness = sole ? sole.bounds.max[2] - sole.bounds.min[2] : 0;
    const pass = Boolean(upper?.closedSurface && sole?.closedSurface && soleThickness >= .002 && upper.minimumClearance <= .004);
    report.anatomyChecks.push({ id: item.id, bodyName: result.bodyName, closedHollowUpper: upper?.closedSurface || false,
      closedCompleteSole: sole?.closedSurface || false, soleThickness, maximumSupportGap: .004, supportGap: upper?.minimumClearance ?? null, result: pass ? 'passed' : 'failed' });
    if (!pass) report.result = 'failed';
  }
  report.states.push({ id: item.id, kind: item.kind, parts: results });
  console.log(JSON.stringify({ id: item.id, kind: item.kind, parts: results.map(concise) }));
}
if (report.result === 'passed' && !baseline && !process.argv.includes('--static-only')) {
  // Manual actions run through the actual behavior controller at 60 Hz.
  // Keep uniform progress samples plus actual ankle/knee extrema, catching
  // moving calf/motor surfaces that the default standing pose cannot expose.
  let time = 0; const dt = 1 / 60, samples = [];
  const requestedAction = process.argv.find(arg => arg.startsWith('--action='))?.slice(9);
  const motionActions = requestedAction ? ACTIONS.filter(action => action.id === requestedAction) : ACTIONS;
  assert(motionActions.length, 'Unknown motion action');
  for (const action of motionActions) {
    rig.animate(time += dt, { enabled: true }); rig.animate(time += dt, { enabled: false });
    for (let i = 0; i < 90; i++) rig.animate(time += dt, { enabled: false });
    assert(rig.trigger(action.id)); const poses = [];
    for (let index = 0; index <= Math.ceil(action.duration / dt); index++) {
      rig.animate(time += dt, { enabled: false });
      poses.push({ action: action.id, progress: index * dt / action.duration,
        joints: Object.fromEntries([...rig.joints].map(([name, joint]) => [name, joint.angle])) });
    }
    const chosen = new Set([0, ...[.15, .30, .50, .70, .85, 1].map(progress => Math.min(poses.length - 1, Math.round(progress * action.duration / dt)))]);
    for (const name of ['left_ankle', 'right_ankle', 'left_knee', 'right_knee']) {
      for (const extremum of ['min', 'max']) {
        let best = 0; poses.forEach((pose, index) => { if (extremum === 'min' ? pose.joints[name] < poses[best].joints[name] : pose.joints[name] > poses[best].joints[name]) best = index; }); chosen.add(best);
      }
    }
    samples.push(...[...chosen].sort((a, b) => a - b).map(index => poses[index]));
  }
  report.motion = { actions: motionActions.length, samples: samples.length, method: 'Actual 60 Hz manual behavior poses; uniform progress and real ankle/knee extrema. Rigid own-body clearance is invariant; motion checks every neighboring calf, motor, upper leg and ankle mesh.', poses: [] };
  for (const pose of samples) {
    for (const [name, angle] of Object.entries(pose.joints)) rig.setJoint(name, angle);
    rig.group.updateMatrixWorld(true);
    const entries = factory.map(({ item, parts }) => ({ id: item.id, kind: item.kind, parts: parts.map(part => concise(validatePart(part, true))) }));
    report.motion.poses.push({ ...pose, results: entries });
    console.log(JSON.stringify({ action: pose.action, progress: pose.progress, violations: entries.filter(e => e.parts.some(p => p.violations.length)).map(e => e.id) }));
  }
  report.motion.distinctNativeTransforms = nativeTransformKeys.size;
}
for (const { parts } of factory) for (const part of parts) part.group.traverse(mesh => {
  if (mesh.isMesh) { mesh.geometry.dispose(); (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(m => m.dispose()); }
});
report.elapsedSeconds = (performance.now() - startedAt) / 1000;
const output = process.argv.find(arg => arg.startsWith('--report='))?.slice(9) || (baseline ? 'test-results/footwear-fit-before.json' : 'test-results/footwear-fit.json');
await mkdir(path.dirname(path.resolve(output)), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ result: report.result, items: items.length, parts: report.states.reduce((sum, state) => sum + state.parts.length, 0),
  crossingFeatures: report.states.reduce((sum, state) => sum + state.parts.reduce((n, p) => n + p.features.filter(f => f.intersects).length, 0), 0),
  embeddedFeatures: report.states.reduce((sum, state) => sum + state.parts.reduce((n, p) => n + p.features.filter(f => f.embeddedVertices).length, 0), 0),
  motionActions: report.motion?.actions || 0, motionSamples: report.motion?.samples || 0 }, null, 2));
if (!baseline) assert.equal(report.result, 'passed', 'Footwear crosses or comes within 0.8 mm of actual native foot/ankle/calf surfaces or is embedded in a native closed mesh.');
