// Native Microduck design measurements. Optional authoring tool, not a CI gate.
// Rebuild both reports: node scripts/measure-footwear-native.mjs
// Motion only: node scripts/measure-footwear-native.mjs --motion --report=/tmp/motion.json
// Top field and adjacent-calf motion: node scripts/measure-footwear-native.mjs --topfield --report=/tmp/topfield.json
// Custom directory: node scripts/measure-footwear-native.mjs --output-dir=/tmp/duckrobe-fit
// Topfield always generates current behavior poses in memory; it never trusts
// a stale saved report. Only report files are written; source geometry is read.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Matrix4, Ray, Triangle, Vector3 } from 'three';
import { loadRobot } from '../src/robot.js';
import { ACTIONS } from '../src/behavior.js';

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

const sides = [{ ankle: 'ankle_left', leg: 'leg', joint: 'left_ankle' }, { ankle: 'ankle_right', leg: 'leg_2', joint: 'right_ankle' }];
const bands = [0, .005, .010, .015, .020];
const footBands = [-.025, -.0225, -.020, -.0175, -.015, -.0125, -.010, -.0075, -.005, -.0025, ...bands];
const calfBands = Array.from({ length: 28 }, (_, i) => -.055 + i * .0025);
const upperLimit = .020;
function emptyBox() { return { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }; }
function pointInto(box, x, y, z) {
  box.min[0] = Math.min(box.min[0], x); box.max[0] = Math.max(box.max[0], x);
  box.min[1] = Math.min(box.min[1], y); box.max[1] = Math.max(box.max[1], y);
  box.min[2] = Math.min(box.min[2], z); box.max[2] = Math.max(box.max[2], z);
}
function unionInto(box, other) { if (other) { pointInto(box, ...other.min); pointInto(box, ...other.max); } }
function serializeBox(box) { return Number.isFinite(box.min[0]) ? box : null; }
function packGeometry(mesh) {
  const attr = mesh.geometry.getAttribute('position'), originalIndex = mesh.geometry.index;
  const points = [], remap = [], seen = new Map();
  for (let i = 0; i < attr.count; i++) {
    const xyz = [attr.getX(i), attr.getY(i), attr.getZ(i)], key = xyz.join(',');
    let vertex = seen.get(key);
    if (vertex === undefined) { vertex = points.length / 3; seen.set(key, vertex); points.push(...xyz); }
    remap.push(vertex);
  }
  const count = originalIndex?.count || attr.count;
  const triangles = new Int32Array(count);
  for (let i = 0; i < count; i++) triangles[i] = remap[originalIndex ? originalIndex.getX(i) : i];
  return { source: mesh.userData.meshFile, bodyName: mesh.userData.bodyName, positions: new Float64Array(points), triangles };
}
function convexHull(points) {
  const xy = [...new Map(points.map(p => [p.slice(0, 2).join(','), p.slice(0, 2)])).values()].sort((a,b) => a[0] - b[0] || a[1] - b[1]);
  if (xy.length < 3) return xy;
  const cross = (o,a,b) => (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const lower = [], upper = [];
  for (const p of xy) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop(); lower.push(p); }
  for (const p of xy.reverse()) { while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop(); upper.push(p); }
  return lower.slice(0,-1).concat(upper.slice(0,-1));
}
function measureGeometry(packed, transform, planes = bands, contours = false) {
  const p = packed.positions, out = new Float64Array(p.length), e = transform.elements;
  const full = emptyBox(), clipped = emptyBox(), sections = planes.map(z => ({ z, box: emptyBox(), segmentCount: 0, points: contours ? [] : null }));
  for (let i = 0; i < p.length; i += 3) {
    const x = e[0]*p[i]+e[4]*p[i+1]+e[8]*p[i+2]+e[12];
    const y = e[1]*p[i]+e[5]*p[i+1]+e[9]*p[i+2]+e[13];
    const z = e[2]*p[i]+e[6]*p[i+1]+e[10]*p[i+2]+e[14];
    out[i]=x;out[i+1]=y;out[i+2]=z; pointInto(full,x,y,z);
    if (z <= upperLimit) pointInto(clipped,x,y,z);
  }
  const t = packed.triangles;
  for (let i = 0; i < t.length; i += 3) {
    const v = [t[i]*3,t[i+1]*3,t[i+2]*3];
    const lo=Math.min(out[v[0]+2],out[v[1]+2],out[v[2]+2]), hi=Math.max(out[v[0]+2],out[v[1]+2],out[v[2]+2]);
    for (const s of sections) {
      if (s.z < lo || s.z > hi) continue;
      let count = 0;
      for (let edge = 0; edge < 3; edge++) {
        const a=v[edge],b=v[(edge+1)%3], az=out[a+2],bz=out[b+2];
        if (Math.abs(az-bz)<1e-14) {
          if (Math.abs(az-s.z)<1e-14) for (const n of [a,b]) {pointInto(s.box,out[n],out[n+1],s.z);if(s.points)s.points.push([out[n],out[n+1],s.z]);count++;}
          continue;
        }
        const fraction=(s.z-az)/(bz-az);
        if (fraction < 0 || fraction > 1) continue;
        const x=out[a]+fraction*(out[b]-out[a]),y=out[a+1]+fraction*(out[b+1]-out[a+1]);
        pointInto(s.box,x,y,s.z);if(s.points)s.points.push([x,y,s.z]);count++;
      }
      if (count >= 2) s.segmentCount++;
    }
  }
  const ceiling=sections.find(s=>Math.abs(s.z-upperLimit)<1e-14);
  if (ceiling) unionInto(clipped,serializeBox(ceiling.box));
  return { source: packed.source, bodyName: packed.bodyName, uniqueNativeVertices: p.length/3, triangles:t.length/3,
    fullBBox:serializeBox(full), clippedBBox:serializeBox(clipped), sections:sections.map(s=>({...serializeBox(s.box),z:s.z,segmentCount:s.segmentCount,...(contours?{convexHullXY:convexHull(s.points)}:{})})).filter(s=>s.min) };
}
function allMeshes(rig) { const meshes=[];rig.group.traverse(mesh=>{if(mesh.isMesh&&mesh.userData.meshFile)meshes.push(mesh)});return meshes; }
function createSweep() { return { fullBBox:emptyBox(),clippedBBox:emptyBox(),sections:bands.map(z=>({z,box:emptyBox()})),extrema:{} }; }
function updateSweep(sweep,measure,ref) {
  for (const [label,box] of [['fullBBox',measure.fullBBox],['clippedBBox',measure.clippedBBox]]) {
    if (!box) continue;
    for (const bound of ['min','max']) for (let axis=0;axis<3;axis++) {
      if ((bound==='min'&&box[bound][axis]<sweep[label][bound][axis])||(bound==='max'&&box[bound][axis]>sweep[label][bound][axis])) {
        sweep[label][bound][axis]=box[bound][axis];sweep.extrema[`${label}.${bound}.${'xyz'[axis]}`]={...ref,value:box[bound][axis]};
      }
    }
  }
  for (const section of measure.sections) {
    const target=sweep.sections.find(s=>Math.abs(s.z-section.z)<1e-12);if(!target)continue;
    for(const bound of ['min','max'])for(let axis=0;axis<2;axis++)if((bound==='min'&&section[bound][axis]<target.box[bound][axis])||(bound==='max'&&section[bound][axis]>target.box[bound][axis])){
      target.box[bound][axis]=section[bound][axis];sweep.extrema[`section.${target.z}.${bound}.${'xy'[axis]}`]={...ref,value:section[bound][axis]};
    }
    target.box.min[2]=target.box.max[2]=target.z;
  }
}
function serializeSweep(sweep) { return { fullBBox:serializeBox(sweep.fullBBox),clippedBBox:serializeBox(sweep.clippedBBox),sections:sweep.sections.map(s=>({z:s.z,...serializeBox(s.box)})).filter(s=>s.min),extrema:sweep.extrema }; }

async function measureMotion(output) {
const baseline=await loadRobot();baseline.animate(0,false);baseline.group.updateMatrixWorld(true);
const nativeMeshes=allMeshes(baseline),packedBySource=new Map();
for(const mesh of nativeMeshes)if(!packedBySource.has(mesh.userData.meshFile))packedBySource.set(mesh.userData.meshFile,packGeometry(mesh));
function measureMesh(mesh,inverse,planes=bands,contours=false) {
  const base=packedBySource.get(mesh.userData.meshFile), packed={...base,bodyName:mesh.userData.bodyName};
  return measureGeometry(packed,new Matrix4().multiplyMatrices(inverse,mesh.matrixWorld),planes,contours);
}
const report={method:'Exact positions retained from native GLB/STL triangles, transformed by current native mesh matrixWorld and inverse current clothing anchor matrixWorld. True triangle-plane intersections supplement vertices when clipping z<=20mm; no bounding-box projection or mesh substitution. All actions use fresh native rigs and actual manual behavior.animate calls at 60Hz with enabled:false. Geometry measurement cache uses own ankle joint rounded to 1e-12 rad only (sub-picometre positional tolerance); recorded joint values remain unrounded.',
 coordinateFrame:'Metres; current ankle_left/right or leg/leg_2 clothing anchor. These frames are world aligned in DEFAULT_POSE, +X front and +Z up, then inherit that native body motion.',samplingHz:60,clipMaxZ:upperLimit,bands,staticFrames:[],smallCalfProfiles:[],actions:[],overall:{}};
for(const frame of ['ankle_left','ankle_right','leg','leg_2']) {
 const inverse=baseline.anchors.get(frame).matrixWorld.clone().invert(),ownLeg=sides.find(s=>s.ankle===frame)?.leg;
 const wanted=nativeMeshes.filter(m=>m.userData.bodyName===frame||m.userData.bodyName===ownLeg);
 report.staticFrames.push({frame,anchorDefinition:baseline.metadata.anchorDefinitions[frame],native: wanted.map(mesh=>({relativeMatrix:new Matrix4().multiplyMatrices(inverse,mesh.matrixWorld).toArray(),...measureMesh(mesh,inverse,footBands,true)}))});
 if(frame==='leg'||frame==='leg_2')report.smallCalfProfiles.push({frame,sectionsZ:calfBands,native:wanted.filter(m=>m.userData.bodyName===frame).map(mesh=>({relativeMatrix:new Matrix4().multiplyMatrices(inverse,mesh.matrixWorld).toArray(),...measureMesh(mesh,inverse,calfBands,true)}))});
}
const cache=new Map(),globalSweeps=new Map();
for(const side of sides)for(const source of ['leg.stl','xl330.stl'])globalSweeps.set(`${side.ankle}:${source}`,createSweep());
for(const action of ACTIONS) {
 const rig=await loadRobot();rig.animate(0,{enabled:false});assert(rig.trigger(action.id));
 const adjacent=allMeshes(rig).filter(m=>sides.some(s=>m.userData.bodyName===s.leg&&['leg.stl','xl330.stl'].includes(m.userData.meshFile)));
 const actionReport={id:action.id,duration:action.duration,poses:[],ankleSweeps:[],sparseSamples:[]},sweeps=new Map(),frameMeasures=[];
 for(const side of sides)for(const source of ['leg.stl','xl330.stl'])sweeps.set(`${side.ankle}:${source}`,createSweep());
 let startElapsed;
 for(let frame=0;frame<=Math.ceil(action.duration*60)+1;frame++) {
   const time=(frame+1)/60,state=rig.animate(time,{enabled:false}),elapsed=rig.behavior.getState().elapsed;
   if(startElapsed===undefined)startElapsed=elapsed;
   const progress=Math.min(1,(elapsed-startElapsed)/action.duration),joints=Object.fromEntries([...rig.joints].map(([key,value])=>[key,value.angle]));
   actionReport.poses.push({frame,time,progress,active:state.active,support:state.support,joints,rootPosition:rig.group.position.toArray(),rootQuaternion:rig.group.quaternion.toArray()});
   const measurements=[];
   for(const side of sides) {
     const inverse=rig.anchors.get(side.ankle).matrixWorld.clone().invert();
     for(const mesh of adjacent.filter(m=>m.userData.bodyName===side.leg)) {
       const key=`${side.ankle}:${mesh.userData.meshFile}`,cacheKey=`${key}:${joints[side.joint].toFixed(12)}`;
       let measure=cache.get(cacheKey);if(!measure){measure=measureMesh(mesh,inverse);cache.set(cacheKey,measure);}
       const ref={action:action.id,frame,progress,joints:{[side.joint]:joints[side.joint]}};
       updateSweep(sweeps.get(key),measure,ref);updateSweep(globalSweeps.get(key),measure,ref);
       measurements.push({anchor:side.ankle,...measure});
     }
   }
   frameMeasures.push(measurements);
 }
 for(const side of sides)actionReport.ankleSweeps.push({anchor:side.ankle,native:['leg.stl','xl330.stl'].map(source=>({source,...serializeSweep(sweeps.get(`${side.ankle}:${source}`))}))});
 const sparseFrames=new Set([0,...[.15,.30,.50,.70,.85,1].map(p=>Math.min(actionReport.poses.length-1,Math.round(p*action.duration*60)))]);
 for(const sweep of sweeps.values())for(const ref of Object.values(sweep.extrema))sparseFrames.add(ref.frame);
 for(const frame of [...sparseFrames].sort((a,b)=>a-b))actionReport.sparseSamples.push({poseFrame:frame,native:frameMeasures[frame]});
 report.actions.push(actionReport);
 console.log(JSON.stringify({action:action.id,frames:actionReport.poses.length,sparsePoses:actionReport.sparseSamples.length,measuredTransforms:cache.size}));
 const disposed=new Set();rig.group.traverse(m=>{if(m.isMesh){if(!disposed.has(m.geometry)){disposed.add(m.geometry);m.geometry.dispose();}if(!disposed.has(m.material)){disposed.add(m.material);m.material.dispose();}}});
}
for(const side of sides)report.overall[side.ankle]={native:['leg.stl','xl330.stl'].map(source=>({source,...serializeSweep(globalSweeps.get(`${side.ankle}:${source}`))}))};
report.totalPoseSamples=report.actions.reduce((n,a)=>n+a.poses.length,0);report.measuredTransforms=cache.size;
if(output)await persist(report,output);
console.log(JSON.stringify({type:'motion-sweep',output,totalPoseSamples:report.totalPoseSamples,measuredTransforms:cache.size}));
return report;
}

async function measureTopfield(motion, output) {
const rig=await loadRobot();rig.animate(0,false);rig.group.updateMatrixWorld(true);
const meshes=allMeshes(rig),inverse=rig.anchors.get('ankle_left').matrixWorld.clone().invert();
const footMeshes=meshes.filter(m=>m.userData.bodyName==='ankle_left'&&['foot_left.stl','sole_left.stl'].includes(m.userData.meshFile));
const packedBySource=new Map();for(const mesh of meshes)if(!packedBySource.has(mesh.userData.meshFile))packedBySource.set(mesh.userData.meshFile,packGeometry(mesh));
function nativeMeasure(mesh,inverse,planes,contours=false){return measureGeometry({...packedBySource.get(mesh.userData.meshFile),bodyName:mesh.userData.bodyName},new Matrix4().multiplyMatrices(inverse,mesh.matrixWorld),planes,contours)}
const triangles=[];
for(const mesh of footMeshes){
 const positions=mesh.geometry.getAttribute('position'),index=mesh.geometry.index,count=index?.count||positions.count,transform=new Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);
 for(let i=0;i<count;i+=3){
  const vertices=[0,1,2].map(j=>new Vector3().fromBufferAttribute(positions,index?index.getX(i+j):i+j).applyMatrix4(transform));
  const triangle=new Triangle(...vertices);
  triangles.push({triangle,source:mesh.userData.meshFile,triangleIndex:i/3,normal:triangle.getNormal(new Vector3()).toArray(),bbox:{minX:Math.min(...vertices.map(v=>v.x)),maxX:Math.max(...vertices.map(v=>v.x)),minY:Math.min(...vertices.map(v=>v.y)),maxY:Math.max(...vertices.map(v=>v.y))}});
 }
}
const ray=new Ray(new Vector3(),new Vector3(0,0,-1)),hitPoint=new Vector3();
function topHit(x,y){
 ray.origin.set(x,y,.05);let highest=null;
 for(const entry of triangles){
  const b=entry.bbox;if(x<b.minX-1e-14||x>b.maxX+1e-14||y<b.minY-1e-14||y>b.maxY+1e-14)continue;
  if(!ray.intersectTriangle(entry.triangle.a,entry.triangle.b,entry.triangle.c,false,hitPoint))continue;
  if(!highest||hitPoint.z>highest.z+1e-14)highest={z:hitPoint.z,normal:entry.normal,source:entry.source,triangleIndex:entry.triangleIndex};
 }
 return highest;
}
const xs=Array.from({length:30},(_,i)=>-.022+i*.002),ys=Array.from({length:23},(_,i)=>-.038+i*.002);
const zs=[...new Set([...Array.from({length:15},(_,i)=>Number((-.023+i*.0015).toFixed(6))),...Array.from({length:11},(_,i)=>Number((-.023+i*.002).toFixed(6)))])].sort((a,b)=>a-b);
const footProfiles=footMeshes.map(mesh=>nativeMeasure(mesh,inverse,zs,true));
const sections=zs.map(z=>{
 const native=footProfiles.map(m=>({source:m.source,...m.sections.find(s=>Math.abs(s.z-z)<1e-12)})).filter(s=>s.min);
 const box=emptyBox();native.forEach(s=>unionInto(box,s));
 return {z,...serializeBox(box),convexHullXY:convexHull(native.flatMap(s=>s.convexHullXY.map(p=>[...p,z]))),native};
}).filter(s=>s.min);
const report={method:'Direct +Z-down ray intersections with every actual transformed native foot_left.stl and sole_left.stl triangle. First union hit (highest z) records actual triangle normal, source and triangleIndex; null means no triangle hit. Footprint containment is never inferred from a bounding box. Sections use exact triangle-plane intersection segments followed by convex hull of the section XY points.',
 coordinateFrame:'ankle_left current clothing anchor, metres; +X forward/+Z up; native DEFAULT_POSE. Right-foot counterpart is mirrored in Y except small upstream STL asymmetry.',sources:footMeshes.map(m=>({bodyName:m.userData.bodyName,source:m.userData.meshFile,relativeMatrix:new Matrix4().multiplyMatrices(inverse,m.matrixWorld).toArray()})),
 topField:{originZ:.05,direction:[0,0,-1],xMin:-.022,xMax:.036,xStep:.002,yMin:-.038,yMax:.006,yStep:.002,xs,ys,storage:'rows[y index][x index]',rows:ys.map(y=>xs.map(x=>topHit(x,y)))},
 requestedToeSamples:{xs:[.014,.019,.024,.029,.033],ys:[-.0281,-.0161,-.0041,0],rows:[-.0281,-.0161,-.0041,0].map(y=>[.014,.019,.024,.029,.033].map(x=>({x,y,...topHit(x,y)})))},
 footSoleSections:sections,ankleOpeningNative:meshes.filter(m=>m.userData.bodyName==='ankle_left'&&['ankle_left.stl','seeed_bearing__configuration_default.stl'].includes(m.userData.meshFile)).map(m=>nativeMeasure(m,inverse,[-.02,-.015,-.01,-.005,0,.005,.01,.012,.015,.02],true)),calfAdjacentMotion:{state:'pending'}};

console.log(JSON.stringify({output,topFieldValidHits:report.topField.rows.flat().filter(Boolean).length,footSoleSections:sections.length,firstPass:'complete'}));


const calfZs=[-.050,-.045,-.040,-.0375,-.035,-.0325,-.030,-.0275,-.025,-.0225,-.020,-.0175,-.015,-.0125,-.010,-.005,0,.005,.01,.015];
function newSweep(){return{fullBBox:emptyBox(),sections:calfZs.map(z=>({z,box:emptyBox()})),extrema:{}};}
function addSweep(sweep,measure,ref){
 for(const bound of ['min','max'])for(let axis=0;axis<3;axis++)if((bound==='min'&&measure.fullBBox[bound][axis]<sweep.fullBBox[bound][axis])||(bound==='max'&&measure.fullBBox[bound][axis]>sweep.fullBBox[bound][axis])){sweep.fullBBox[bound][axis]=measure.fullBBox[bound][axis];sweep.extrema[`fullBBox.${bound}.${'xyz'[axis]}`]={...ref,value:measure.fullBBox[bound][axis]};}
 for(const section of measure.sections){const target=sweep.sections.find(s=>Math.abs(s.z-section.z)<1e-12);for(const bound of ['min','max'])for(let axis=0;axis<2;axis++)if((bound==='min'&&section[bound][axis]<target.box[bound][axis])||(bound==='max'&&section[bound][axis]>target.box[bound][axis])){target.box[bound][axis]=section[bound][axis];sweep.extrema[`section.${section.z}.${bound}.${'xy'[axis]}`]={...ref,value:section[bound][axis]};}target.box.min[2]=target.box.max[2]=target.z;}
}
function sweepJSON(sweep){return{fullBBox:serializeBox(sweep.fullBBox),sections:sweep.sections.map(s=>({z:s.z,...serializeBox(s.box)})).filter(s=>s.min),extrema:sweep.extrema};}
const overall=new Map(),perAction=[],cache=new Map();
for(const side of sides){const own=meshes.filter(m=>m.userData.bodyName===side.ankle);for(const mesh of own)overall.set(`${side.leg}:${mesh.userData.meshFile}`,newSweep());}
for(const action of motion.actions){
 const actionSweeps=new Map();for(const key of overall.keys())actionSweeps.set(key,newSweep());
 for(const pose of action.poses){
  for(const [joint,angle]of Object.entries(pose.joints))rig.setJoint(joint,angle);
  rig.group.position.fromArray(pose.rootPosition);rig.group.quaternion.fromArray(pose.rootQuaternion);rig.group.updateMatrixWorld(true);
  for(const side of sides){
   const inv=rig.anchors.get(side.leg).matrixWorld.clone().invert();
   for(const mesh of meshes.filter(m=>m.userData.bodyName===side.ankle)){
    const key=`${side.leg}:${mesh.userData.meshFile}`,cacheKey=`${key}:${pose.joints[side.joint].toFixed(12)}`;
    let measure=cache.get(cacheKey);if(!measure){measure=nativeMeasure(mesh,inv,calfZs);cache.set(cacheKey,measure);}
    const ref={action:action.id,frame:pose.frame,progress:pose.progress,ankleAngle:pose.joints[side.joint]};
    addSweep(overall.get(key),measure,ref);addSweep(actionSweeps.get(key),measure,ref);
   }
  }
 }
 perAction.push({id:action.id,frames:sides.map(side=>({anchor:side.leg,native:meshes.filter(m=>m.userData.bodyName===side.ankle).map(m=>({source:m.userData.meshFile,...sweepJSON(actionSweeps.get(`${side.leg}:${m.userData.meshFile}`))}))}))});
 console.log(JSON.stringify({calfAdjacentAction:action.id,measuredTransforms:cache.size}));
}
report.calfAdjacentMotion={state:'complete',method:'Replay every recorded actual 60Hz behavior pose (all joints/root) into the native rig; transform each ankle body native triangle into current parent leg clothing anchor. Sections use exact triangle-plane segments; overall sections are XY extrema over all poses, not hull-only acceptance. Measurement cache uses own ankle joint rounded to 1e-12 rad (sub-picometre positional tolerance).',totalPoseSamples:motion.totalPoseSamples,sectionsZ:calfZs,measuredTransforms:cache.size,frames:sides.map(side=>({anchor:side.leg,native:meshes.filter(m=>m.userData.bodyName===side.ankle).map(m=>({source:m.userData.meshFile,...sweepJSON(overall.get(`${side.leg}:${m.userData.meshFile}`))}))})),actions:perAction};
const heights=report.topField.rows.flat().filter(Boolean).map(h=>h.z);assert(heights.every(Number.isFinite));assert(report.topField.rows.flat().filter(Boolean).every(h=>h.normal.every(Number.isFinite)));
if(output)await persist(report,output);
console.log(JSON.stringify({type:'native-topfield',output,topFieldValidHits:heights.length,topMin:Math.min(...heights),topMax:Math.max(...heights),poses:motion.totalPoseSamples,calfMeasuredTransforms:cache.size}));
return report;

}

async function persist(report, output) {
  await mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
}
const args = process.argv.slice(2);
const help = args.includes('--help');
if (help) {
  console.log('Usage: node scripts/measure-footwear-native.mjs [--motion | --topfield] [--report=FILE] [--output-dir=DIR]');
} else {
  for (const arg of args) assert(arg === '--motion' || arg === '--topfield' || arg.startsWith('--report=') || arg.startsWith('--output-dir='), `Unknown argument: ${arg}`);
  assert(!(args.includes('--motion') && args.includes('--topfield')), 'Choose one mode, or omit both mode flags to generate both reports.');
  const mode = args.includes('--motion') ? 'motion' : args.includes('--topfield') ? 'topfield' : 'all';
  const customReport = args.find(arg => arg.startsWith('--report='))?.slice(9);
  assert(!customReport || mode !== 'all', '--report requires either --motion or --topfield; use --output-dir for both reports.');
  const outputDir = args.find(arg => arg.startsWith('--output-dir='))?.slice(13) || 'test-results';
  const motionPath = mode === 'motion' && customReport ? customReport : path.join(outputDir, 'footwear-motion-sweep.json');
  const topfieldPath = mode === 'topfield' && customReport ? customReport : path.join(outputDir, 'footwear-native-topfield.json');
  const motion = await measureMotion(mode === 'topfield' ? null : motionPath);
  if (mode !== 'motion') await measureTopfield(motion, topfieldPath);
}
