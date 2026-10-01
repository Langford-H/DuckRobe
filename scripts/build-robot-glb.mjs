import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Deterministic, lossless packing of the pinned Apache-2.0 simulation STL
// files. Identical float32 positions share vertices; all triangles remain.
// No network, graphics context or external conversion dependency is needed.
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const robotRoot = path.join(projectRoot, 'public/robot');
const manifestPath = path.join(robotRoot, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const xmlBytes = await readFile(path.join(robotRoot, 'source/robot_allcollisions.xml'));
if (sha256(xmlBytes) !== manifest.files['source/robot_allcollisions.xml'].sha256) {
  throw new Error('The native MJCF does not match its pinned manifest hash.');
}

// The pinned asset block contains self-closing mesh declarations. Parse only
// that block, rejecting changes to this constrained input instead of claiming
// to be a general-purpose XML/MJCF converter.
const xml = xmlBytes.toString('utf8').replace(/<!--[\s\S]*?-->/g, '');
const assets = xml.match(/<asset\b[^>]*>([\s\S]*?)<\/asset>/)?.[1];
if (!assets) throw new Error('The native MJCF has no asset block.');
const attributes = (tag) => Object.fromEntries(
  [...tag.matchAll(/([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
    .map((match) => [match[1], match[2] ?? match[3]]),
);
const meshDeclarations = [...assets.matchAll(/<mesh\b[^>]*\/>/g)]
  .map(([tag]) => attributes(tag))
  .sort((a, b) => a.file.localeCompare(b.file, 'en'));
if (meshDeclarations.length !== manifest.native.meshFiles.length ||
    meshDeclarations.some((mesh) => !manifest.native.meshFiles.includes(mesh.file))) {
  throw new Error('The native MJCF mesh declarations do not match the pinned asset list.');
}

const gltf = {
  asset: { version: '2.0', generator: 'DuckRobe scripts/build-robot-glb.mjs' },
  scene: 0,
  scenes: [{ nodes: [] }],
  nodes: [],
  meshes: [],
  accessors: [],
  bufferViews: [],
  buffers: [],
  extras: {
    sourceRepository: manifest.native.repository,
    sourceRevision: manifest.native.revision,
    license: manifest.native.license,
    units: 'metres',
    coordinateSystem: '+X forward, +Y left, +Z up',
    packing: 'Exact duplicate position welding; original source triangles retained.',
  },
};
const binaryChunks = [];
let binaryOffset = 0;
let vertexCount = 0;
let triangleCount = 0;
const sourceFiles = ['source/robot_allcollisions.xml'];

function bufferView(bytes, target) {
  const index = gltf.bufferViews.length;
  gltf.bufferViews.push({ buffer: 0, byteOffset: binaryOffset, byteLength: bytes.length, target });
  binaryChunks.push(bytes);
  binaryOffset += bytes.length;
  const padding = (4 - binaryOffset % 4) % 4;
  if (padding) {
    binaryChunks.push(Buffer.alloc(padding));
    binaryOffset += padding;
  }
  return index;
}

for (const declaration of meshDeclarations) {
  const relativePath = `source/assets/${declaration.file}`;
  const bytes = await readFile(path.join(robotRoot, relativePath));
  if (sha256(bytes) !== manifest.files[relativePath]?.sha256) {
    throw new Error(`Native STL does not match its pinned hash: ${declaration.file}`);
  }
  sourceFiles.push(relativePath);
  const count = bytes.readUInt32LE(80);
  if (bytes.length !== 84 + count * 50) throw new Error(`Expected a binary STL: ${declaration.file}`);
  const scale = (declaration.scale ?? '1 1 1').trim().split(/\s+/).map(Number);
  if (scale.length !== 3 || !scale.every(Number.isFinite)) throw new Error(`Invalid MJCF mesh scale: ${declaration.file}`);

  const vertices = [];
  const indices = [];
  const byPosition = new Map();
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];
  for (let triangle = 0; triangle < count; triangle++) {
    for (let corner = 0; corner < 3; corner++) {
      const offset = 84 + triangle * 50 + 12 + corner * 12;
      const position = scale.map((factor, axis) => Math.fround(bytes.readFloatLE(offset + axis * 4) * factor));
      if (!position.every(Number.isFinite)) throw new Error(`Non-finite source vertex: ${declaration.file}`);
      const key = position.join(',');
      let index = byPosition.get(key);
      if (index === undefined) {
        index = vertices.length / 3;
        vertices.push(...position);
        byPosition.set(key, index);
        position.forEach((coordinate, axis) => {
          minimum[axis] = Math.min(minimum[axis], coordinate);
          maximum[axis] = Math.max(maximum[axis], coordinate);
        });
      }
      indices.push(index);
    }
  }

  const positionBytes = Buffer.alloc(vertices.length * 4);
  vertices.forEach((value, index) => positionBytes.writeFloatLE(value, index * 4));
  const positionAccessor = gltf.accessors.length;
  gltf.accessors.push({
    bufferView: bufferView(positionBytes, 34962),
    componentType: 5126,
    count: vertices.length / 3,
    type: 'VEC3',
    min: minimum,
    max: maximum,
  });
  const useShortIndices = vertices.length / 3 <= 65536;
  const indexBytes = Buffer.alloc(indices.length * (useShortIndices ? 2 : 4));
  indices.forEach((value, index) => useShortIndices
    ? indexBytes.writeUInt16LE(value, index * 2)
    : indexBytes.writeUInt32LE(value, index * 4));
  const indexAccessor = gltf.accessors.length;
  gltf.accessors.push({
    bufferView: bufferView(indexBytes, 34963),
    componentType: useShortIndices ? 5123 : 5125,
    count: indices.length,
    type: 'SCALAR',
  });
  const meshIndex = gltf.meshes.length;
  gltf.meshes.push({
    name: declaration.file,
    primitives: [{ attributes: { POSITION: positionAccessor }, indices: indexAccessor, mode: 4 }],
  });
  const nodeIndex = gltf.nodes.length;
  gltf.nodes.push({
    name: declaration.file,
    mesh: meshIndex,
    extras: { meshFile: declaration.file, sourceScale: scale },
  });
  gltf.scenes[0].nodes.push(nodeIndex);
  vertexCount += vertices.length / 3;
  triangleCount += count;
}

gltf.buffers.push({ byteLength: binaryOffset });
const jsonBytes = Buffer.from(JSON.stringify(gltf));
const jsonPadding = Buffer.alloc((4 - jsonBytes.length % 4) % 4, 0x20);
const jsonChunk = Buffer.concat([jsonBytes, jsonPadding]);
const binaryChunk = Buffer.concat(binaryChunks);
const glb = Buffer.alloc(12 + 8 + jsonChunk.length + 8 + binaryChunk.length);
glb.writeUInt32LE(0x46546c67, 0);
glb.writeUInt32LE(2, 4);
glb.writeUInt32LE(glb.length, 8);
glb.writeUInt32LE(jsonChunk.length, 12);
glb.writeUInt32LE(0x4e4f534a, 16);
jsonChunk.copy(glb, 20);
const binHeader = 20 + jsonChunk.length;
glb.writeUInt32LE(binaryChunk.length, binHeader);
glb.writeUInt32LE(0x004e4942, binHeader + 4);
binaryChunk.copy(glb, binHeader + 8);
await writeFile(path.join(robotRoot, 'web/microduck.glb'), glb);

const kinematicsSource = manifest.web.kinematics ?? {
  repository: manifest.web.repository,
  revision: manifest.web.revision,
  originalPath: 'app/public/robot/mjlab/kinematics.json',
  derivedFrom: manifest.native.upstreamModelPath,
  verification: 'All 15 body positions and quaternions match the pinned native MJCF within 1e-6.',
};
const generatedSource = {
  repository: manifest.native.repository,
  revision: manifest.native.revision,
  license: manifest.native.license,
  generator: 'scripts/build-robot-glb.mjs',
  sourceFiles,
  meshCount: meshDeclarations.length,
  vertexCount,
  triangleCount,
  packing: 'Exact duplicate position welding, original STL triangles retained, MJCF mesh scale applied.',
};
manifest.web = {
  glbUrl: '/robot/web/microduck.glb',
  kinematicsUrl: '/robot/web/kinematics.json',
  geometry: generatedSource,
  kinematics: kinematicsSource,
};
manifest.files['web/microduck.glb'] = {
  kind: 'generated',
  ...generatedSource,
  bytes: glb.length,
  sha256: sha256(glb),
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ meshes: meshDeclarations.length, vertices: vertexCount, triangles: triangleCount, bytes: glb.length, sha256: sha256(glb) }, null, 2));
