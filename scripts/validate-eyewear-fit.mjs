import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Box3, Matrix4, Quaternion, Ray, Triangle, Vector3 } from 'three';
import { loadRobot } from '../src/robot.js';
import { MAX_VISUAL_JAW_OPEN } from '../src/behavior.js';
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
function segmentDistanceSquared(p1, q1, p2, q2) {
  const ux = q1.x - p1.x, uy = q1.y - p1.y, uz = q1.z - p1.z;
  const vx = q2.x - p2.x, vy = q2.y - p2.y, vz = q2.z - p2.z;
  const wx = p1.x - p2.x, wy = p1.y - p2.y, wz = p1.z - p2.z;
  const a = ux * ux + uy * uy + uz * uz, b = ux * vx + uy * vy + uz * vz;
  const c = vx * vx + vy * vy + vz * vz, d = ux * wx + uy * wy + uz * wz, e = vx * wx + vy * wy + vz * wz;
  const clamp = value => Math.max(0, Math.min(1, value));
  let s = 0, t = 0;
  if (a < 1e-24 && c < 1e-24) return wx * wx + wy * wy + wz * wz;
  if (a < 1e-24) t = clamp(e / c);
  else if (c < 1e-24) s = clamp(-d / a);
  else {
    const denominator = a * c - b * b;
    if (denominator > 1e-24) s = clamp((b * e - c * d) / denominator);
    t = (b * s + e) / c;
    if (t < 0) { t = 0; s = clamp(-d / a); }
    else if (t > 1) { t = 1; s = clamp((b - d) / a); }
  }
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
function closestTriangle(tree, item, best) {
  if (boxDistanceSquared(tree.box, item.box) > best.distanceSquared) return;
  if (tree.triangles) {
    for (const candidate of tree.triangles) {
      if (boxDistanceSquared(candidate.box, item.box) > best.distanceSquared) continue;
      const distanceSquared = triangleDistanceSquared(item.triangle, candidate.triangle);
      if (distanceSquared < best.distanceSquared) { best.distanceSquared = distanceSquared; best.headSource = candidate.source; best.eyewearSource = item.source; best.eyewearCenter = item.center.toArray(); }
    }
    return;
  }
  const left = boxDistanceSquared(tree.left.box, item.box), right = boxDistanceSquared(tree.right.box, item.box);
  closestTriangle(left <= right ? tree.left : tree.right, item, best);
  closestTriangle(left <= right ? tree.right : tree.left, item, best);
}

// Sanity-check the distance primitive on intersections and parallel surfaces,
// including a coplanar pair whose vertices lie outside the other triangle.
const probe = new Triangle(new Vector3(0, 0, 0), new Vector3(1, 0, 0), new Vector3(0, 1, 0));
assert(Math.abs(triangleDistanceSquared(probe, new Triangle(new Vector3(0, 0, .001), new Vector3(1, 0, .001), new Vector3(0, 1, .001))) - 1e-6) < 1e-16);
assert.equal(triangleDistanceSquared(probe, new Triangle(new Vector3(.2, .2, -.5), new Vector3(.2, .2, .5), new Vector3(.8, .8, .5))), 0);
assert(triangleDistanceSquared(probe, new Triangle(new Vector3(.1, -.5, 0), new Vector3(.1, 1.5, 0), new Vector3(.2, 1.5, 0))) < 1e-20);

const rig = await loadRobot(); rig.animate(0, false);
const head = rig.bodies.get('jaw_soft'), anchor = rig.anchors.get('jaw_soft');
const jawPivot = rig.group.getObjectByName('microduck_visual_jaw');
const jawAxis = new Vector3(0, 1, 0).applyQuaternion(head.getWorldQuaternion(new Quaternion()).invert()).normalize();
const threshold = .0008, items = ITEMS.filter(item => item.slot === 'eyewear');
const report = { coordinateFrame: 'jaw_soft outfit anchor, metres, +X front / +Z up in DEFAULT_POSE',
  method: 'Actual native GLB triangles vs generated eyewear triangles; BVH candidate pruning, segment-triangle intersections, vertex-face and edge-edge minimum distance. AABBs are only bounds, not collision evidence.',
  minimumRequiredClearance: threshold, states: [], result: 'passed' };
for (const jawAngle of [0, .12, MAX_VISUAL_JAW_OPEN]) {
  jawPivot.quaternion.setFromAxisAngle(jawAxis, jawAngle); rig.group.updateMatrixWorld(true);
  const inverseAnchor = anchor.matrixWorld.clone().invert(), headTriangles = [], nativeBounds = [];
  head.traverse(mesh => {
    if (!mesh.isMesh || !mesh.userData.meshFile) return;
    const triangles = meshTriangles(mesh, new Matrix4().multiplyMatrices(inverseAnchor, mesh.matrixWorld));
    headTriangles.push(...triangles);
    const box = new Box3(); triangles.forEach(item => box.union(item.box));
    nativeBounds.push({ source: mesh.userData.meshFile, min: box.min.toArray(), max: box.max.toArray() });
  });
  const tree = buildTree(headTriangles), results = [];
  for (const item of items) {
    const parts = createOutfitParts({ eyewear: item.id }), meshes = [];
    for (const part of parts) part.group.traverse(mesh => { if (mesh.isMesh) meshes.push(mesh); });
    parts.forEach(part => part.group.updateMatrixWorld(true));
    const best = { distanceSquared: Infinity }, features = [];
    for (const mesh of meshes) {
      const feature = { distanceSquared: Infinity };
      const triangles = meshTriangles(mesh, mesh.matrixWorld);
      // Each procedural eyepiece/temple is connected and starts outside the
      // complete native head bound. Combined with a positive triangle gap,
      // this excludes a feature hidden entirely inside a closed solid.
      assert(triangles.some(({ triangle }) => [triangle.a, triangle.b, triangle.c].some(point => !tree.box.containsPoint(point))), `No exterior witness for ${mesh.name}`);
      for (const triangle of triangles) closestTriangle(tree, triangle, feature);
      features.push({ feature: mesh.name, minimumClearance: Math.sqrt(feature.distanceSquared), nearestNative: feature.headSource, closestFeatureCenter: feature.eyewearCenter });
      if (feature.distanceSquared < best.distanceSquared) Object.assign(best, feature);
    }
    const minimumClearance = Math.sqrt(best.distanceSquared);
    results.push({ id: item.id, kind: item.kind, minimumClearance, nearestNative: best.headSource, nearestFeature: best.eyewearSource, features });
    if (minimumClearance < threshold) report.result = 'failed';
    for (const part of parts) part.group.traverse(mesh => { if (mesh.isMesh) { mesh.geometry.dispose(); mesh.material.dispose(); } });
  }
  report.states.push({ jawAngle, nativeTriangles: headTriangles.length, nativeBounds, results });
}
const outputPath = process.argv.find(arg => arg.startsWith('--report='))?.slice(9);
if (outputPath) await writeFile(outputPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ result: report.result, minimumRequiredClearance: threshold,
  states: report.states.map(state => ({ jawAngle: state.jawAngle, nativeTriangles: state.nativeTriangles,
    kinds: [...new Set(state.results.map(item => item.kind))].map(kind => {
      const entry = state.results.filter(item => item.kind === kind).sort((a, b) => a.minimumClearance - b.minimumClearance)[0];
      return { kind, minimumClearance: entry.minimumClearance, nearestFeature: entry.nearestFeature, nearestNative: entry.nearestNative };
    }) })) }, null, 2));
assert.equal(report.result, 'passed', 'Eyewear intersects or comes within 0.8 mm of real native head/camera geometry; inspect the precise per-feature report.');
