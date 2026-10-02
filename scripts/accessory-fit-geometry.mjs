import assert from 'node:assert/strict';
import { Box3, Ray, Triangle, Vector3 } from 'three';

function meshTriangles(mesh, transform) {
  const positions = mesh.geometry.getAttribute('position'), index = mesh.geometry.index;
  assert(positions?.count >= 3, `Empty accessory or native mesh ${mesh.name}`);
  const count = index?.count || positions.count, triangles = [];
  assert(count % 3 === 0, `Non-triangle index count in ${mesh.name}`);
  const normals = mesh.geometry.getAttribute('normal');
  if (normals) assert.equal(normals.count, positions.count, `Vertex/normal count mismatch in ${mesh.name}`);
  if (normals) for (let i = 0; i < normals.count; i++) assert([normals.getX(i), normals.getY(i), normals.getZ(i)].every(Number.isFinite), `Non-finite normal in ${mesh.name}`);
  for (let i = 0; i < count; i += 3) {
    const vertices = [0, 1, 2].map(offset => {
      const vertex = index ? index.getX(i + offset) : i + offset;
      assert(Number.isInteger(vertex) && vertex >= 0 && vertex < positions.count, `Invalid triangle index in ${mesh.name}`);
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
    // |u × v|² avoids subtracting almost equal Gram products. Compare with
    // the segment scale: an absolute cutoff treats tiny crossing edges as
    // parallel and can miss submillimetre coplanar intersections.
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    const denominator = cx * cx + cy * cy + cz * cz;
    if (denominator > a * c * Number.EPSILON ** 2) s = clamp((b * e - c * d) / denominator);
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

export function topology(triangles) {
  const edges = new Map(); let degenerateFaces = 0, signedVolume = 0;
  const cross = new Vector3();
  const key = p => p.toArray().map(value => Math.round(value * 1e8)).join(',');
  for (const { triangle } of triangles) {
    const vertices = [triangle.a, triangle.b, triangle.c].map(key);
    if (new Set(vertices).size < 3 || triangle.getArea() < 1e-16) { degenerateFaces++; continue; }
    signedVolume += triangle.a.dot(cross.crossVectors(triangle.b, triangle.c)) / 6;
    for (let i=0;i<3;i++) {
      const from = vertices[i], to = vertices[(i+1)%3], edge = [from,to].sort().join(';');
      const value = edges.get(edge) || { count: 0, orientation: 0 };
      value.count++; value.orientation += from < to ? 1 : -1; edges.set(edge,value);
    }
  }
  const boundaryEdges=[...edges.values()].filter(value=>value.count===1).length;
  const nonManifoldEdges=[...edges.values()].filter(value=>value.count>2).length;
  const inconsistentWindingEdges=[...edges.values()].filter(value=>value.count===2 && value.orientation!==0).length;
  return { closed:edges.size>0 && !boundaryEdges && !nonManifoldEdges, edges:edges.size, boundaryEdges, nonManifoldEdges, inconsistentWindingEdges, degenerateFaces, signedVolume };
}
export function uniquePoints(triangles) {
  const points=new Map();
  for(const {triangle}of triangles) for(const point of [triangle.a,triangle.b,triangle.c]) points.set(point.toArray().map(value=>Math.round(value*1e8)).join(','),point);
  return [...points.values()];
}
export { meshTriangles, buildTree, boxDistanceSquared, triangleDistanceSquared, closestTriangle, closestPair, insideNative, collectRayHits };
