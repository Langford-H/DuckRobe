import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, link } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { Box3, Group, Mesh, Quaternion, Vector3 } from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { unzipSync } from 'fflate';
import { buildExportBundle } from '../src/export.js';
import { DEFAULT_POSE, DEFAULT_ROBOT_COLORS, normalizeRobotColors, robotPartColor } from '../src/robot.js';
import * as outfitModule from '../src/outfits.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(projectRoot, 'public');
const outputRoot = path.resolve(process.argv.find((argument) => argument.startsWith('--out='))?.slice(6) || '/tmp/duckrobe-export-v2-validation');
const all = process.argv.includes('--all');
globalThis.DOMParser = DOMParser;
globalThis.XMLSerializer = XMLSerializer;

// Reuse source asset bytes across cases, without an HTTP server or network.
const cache = new Map();
globalThis.fetch = async (url) => {
  const pathname = typeof url === 'string' ? url : url.url;
  const filename = path.resolve(publicRoot, `.${pathname}`);
  assert(filename.startsWith(`${publicRoot}${path.sep}`), `Unexpected asset URL ${pathname}`);
  if (!cache.has(filename)) cache.set(filename, readFile(filename));
  const buffer = await cache.get(filename);
  return {
    ok: true, status: 200,
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  };
};

const manifest = JSON.parse(await readFile(path.join(publicRoot, 'robot/manifest.json'), 'utf8'));
const kinematics = JSON.parse(await readFile(path.join(publicRoot, 'robot/web/kinematics.json'), 'utf8'));
const group = new Group();
const bodies = new Map();
for (const body of kinematics.bodies) {
  const node = new Group();
  node.position.fromArray(body.pos);
  const [w, x, y, z] = body.quat;
  node.quaternion.set(x, y, z, w).normalize();
  if (body.joint) node.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(...body.joint.axis).normalize(), DEFAULT_POSE[body.joint.name] || 0));
  bodies.set(body.name, node);
}
for (const body of kinematics.bodies) (body.parent ? bodies.get(body.parent) : group).add(bodies.get(body.name));
// Derive the same floor offset as the renderer from the native mesh geometry.
const stl = new STLLoader();
const geometries = new Map();
for (const body of kinematics.bodies) for (const geom of body.geoms || []) {
  if (geom.type !== 'mesh') continue;
  if (!geometries.has(geom.mesh)) {
    const buffer = await readFile(path.join(publicRoot, 'robot/source/assets', geom.mesh));
    geometries.set(geom.mesh, stl.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)));
  }
  const mesh = new Mesh(geometries.get(geom.mesh));
  mesh.position.fromArray(geom.pos || [0, 0, 0]);
  const [w, x, y, z] = geom.quat || [1, 0, 0, 0];
  mesh.quaternion.set(x, y, z, w).normalize();
  bodies.get(body.name).add(mesh);
}
group.updateMatrixWorld(true);
const groundOffset = -new Box3().setFromObject(group, true).min.z;
const anchorDefinitions = {};
for (const [name, body] of bodies) {
  anchorDefinitions[name] = { bodyName: name, localPosition: [0, 0, 0], localQuaternion: body.getWorldQuaternion(new Quaternion()).invert().toArray(), defaultWorldPosition: body.getWorldPosition(new Vector3()).toArray() };
}
const robot = { group, bodies, metadata: { ...manifest, kinematics, defaultPose: DEFAULT_POSE, bodyColors: DEFAULT_ROBOT_COLORS, groundOffset, anchorDefinitions } };
const slots = ['hat', 'eyewear', 'body', 'accessory', 'legwear'];
const emptySelection = Object.fromEntries(slots.map((slot) => [slot, null]));
const outfits = outfitModule.OUTFITS;
const items = outfitModule.ITEMS;
assert(Array.isArray(outfits) && outfits.length === 24, 'The curated catalog must contain exactly 24 outfits.');
assert.equal(new Set(outfits.map((outfit) => outfit.id)).size, 24, 'Outfit IDs must be unique.');
assert(Array.isArray(items) && items.length > 0, 'Independent wardrobe items are required.');
const itemIndex = new Map(items.map((item) => [item.id, item]));
assert.equal(itemIndex.size, items.length, 'Item IDs must be unique.');
for (const outfit of outfits) {
  assert.deepEqual(Object.keys(outfit.selection).sort(), [...slots].sort());
  for (const slot of slots) {
    const id = outfit.selection[slot];
    if (id === null) continue;
    assert.equal(itemIndex.get(id)?.slot, slot, `Outfit ${outfit.id} has an invalid ${slot} item.`);
    assert.notEqual(id, outfit.id, 'Selection must store item IDs, not outfit IDs.');
  }
}
const pick = (slot, index) => outfits[index].selection[slot] || items.find((item) => item.slot === slot)?.id;
const chosenOutfits = all ? outfits : outfits.filter((outfit, index) => index % 6 === 0);
const cases = chosenOutfits.map((outfit) => ({
  id: outfit.id, name: outfit.en || outfit.name, selection: { ...outfit.selection },
}));
const mixedSelection = { hat: pick('hat', 0), eyewear: pick('eyewear', 7), body: pick('body', 13), accessory: pick('accessory', 19), legwear: pick('legwear', 23) };
cases.push({ id: 'mixed-five-slots', name: 'Five-slot mix', selection: mixedSelection, multiBodyLegwear: true });
cases.push({ id: 'partial-removal', name: 'Eyewear and boots', selection: { ...emptySelection, eyewear: pick('eyewear', 10), legwear: pick('legwear', 4) }, multiBodyLegwear: true });
cases.push({ id: 'legwear-only', name: 'Boots only', selection: { ...emptySelection, legwear: pick('legwear', 18) }, multiBodyLegwear: true });
cases.push({ id: 'custom-body-colors', name: 'Sea-glass duck', selection: mixedSelection, colors: { shell: '#86b7c9', accent: '#ce7e58' } });
cases.push({ id: 'metadata-body-colors', name: 'Rose duck', selection: { ...emptySelection }, metadataColors: { shell: '#d8b6cb', accent: '#425e6f' } });
cases.push({ id: 'explicit-body-colors', name: 'Butter duck', selection: { ...outfits[2].selection }, metadataColors: { shell: '#d8b6cb', accent: '#425e6f' }, bodyColors: { shell: '#F6E4BA', accent: '#80A89A' } });
cases.push({ id: 'bare-orange-robot', name: 'Original orange Microduck', selection: { ...emptySelection } });
cases.push({ id: 'active-behavior-export', name: 'Export during motion', selection: { ...outfits[0].selection }, activeBehavior: true });
const requestedCaseIds = process.argv.find((argument) => argument.startsWith('--cases='))?.slice(8).split(',');
if (requestedCaseIds) for (const id of requestedCaseIds) assert(cases.some((testCase) => testCase.id === id), `Unknown export validation case ${id}.`);
const activeCases = requestedCaseIds ? cases.filter((testCase) => requestedCaseIds.includes(testCase.id)) : cases;

function parsedXml(bytes, rootName) {
  const errors = [];
  const document = new DOMParser({ onError: (level, message) => errors.push(`${level}: ${message}`) }).parseFromString(new TextDecoder().decode(bytes), 'application/xml');
  assert.equal(errors.length, 0, `Invalid ${rootName} XML: ${errors.join('; ')}`);
  assert.equal(document.documentElement.tagName, rootName);
  return document;
}

function checkFiles(bundle, testCase) {
  assert(bundle.files['microduck.urdf'] && bundle.files['microduck.xml']);
  const urdf = parsedXml(bundle.files['microduck.urdf'], 'robot');
  const mjcf = parsedXml(bundle.files['microduck.xml'], 'mujoco');
  const meshDir = mjcf.getElementsByTagName('compiler')[0].getAttribute('meshdir');
  for (const mesh of Array.from(urdf.getElementsByTagName('mesh'))) {
    assert(bundle.files[mesh.getAttribute('filename')], `URDF mesh missing: ${mesh.getAttribute('filename')}`);
  }
  for (const mesh of Array.from(mjcf.getElementsByTagName('mesh'))) {
    const filename = path.posix.join(meshDir, mesh.getAttribute('file'));
    assert(bundle.files[filename], `MJCF mesh missing: ${filename}`);
  }
  assert.equal(bundle.manifest.joints.length, 14);
  assert.equal(mjcf.getElementsByTagName('freejoint').length, 1);
  assert.equal(Array.from(urdf.getElementsByTagName('joint')).filter((joint) => joint.getAttribute('type') === 'revolute').length, 14);
  assert.equal(bundle.manifest.formatVersion, 2);
  assert.deepEqual(Object.keys(bundle.manifest.selection).sort(), [...slots].sort());
  const expectedColors = normalizeRobotColors(testCase.bodyColors || testCase.colors || testCase.metadataColors || DEFAULT_ROBOT_COLORS);
  assert.deepEqual(bundle.manifest.bodyColors, expectedColors);
  for (const override of bundle.manifest.visualPaletteOverrides) {
    const { color } = robotPartColor(override.meshFile, expectedColors);
    const expectedRgba = [...[1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16) / 255), 1];
    assert.deepEqual(override.rgba, expectedRgba, `Body palette mismatch for ${override.meshFile}.`);
  }
  for (const part of bundle.manifest.clothing) {
    assert.equal(part.itemId, testCase.selection[part.slot]);
    assert.equal(itemIndex.get(part.itemId)?.slot, part.slot);
    assert(bodies.has(part.bodyName), `Unknown garment mount ${part.bodyName}.`);
  }
  for (const slot of slots) {
    const count = bundle.manifest.clothing.filter((part) => part.slot === slot).length;
    assert(testCase.selection[slot] ? count > 0 : count === 0, `${slot} removal/selection disagrees with exported geometry.`);
  }
  if (testCase.selection.eyewear) {
    const eyewear = bundle.manifest.clothing.filter((part) => part.slot === 'eyewear');
    assert.equal(eyewear.filter((part) => part.detailName?.endsWith(':single-eyepiece-rim')).length, 1, 'Microduck eyewear must have one eyepiece rim.');
    assert.equal(eyewear.filter((part) => part.detailName?.endsWith(':single-optical-lens')).length, 1, 'Microduck eyewear must have one optical lens.');
  }
  if (testCase.multiBodyLegwear) {
    const legBodies = new Set(bundle.manifest.clothing.filter((part) => part.slot === 'legwear').map((part) => part.bodyName));
    assert(legBodies.size >= 2, 'Legwear must follow multiple native robot bodies.');
  }
  for (const [filename, bytes] of Object.entries(bundle.files)) {
    assert(!path.posix.isAbsolute(filename) && !filename.split('/').includes('..'), `Unsafe archive entry ${filename}`);
    assert(bytes.length > 0 || filename === 'materials.mtl', `Empty asset ${filename}`);
    if (!filename.endsWith('.obj')) continue;
    const lines = new TextDecoder().decode(bytes).split('\n');
    const vertices = lines.filter((line) => line.startsWith('v '));
    const faces = lines.filter((line) => line.startsWith('f '));
    assert(vertices.length >= 3 && faces.length > 0, `Empty OBJ mesh ${filename}`);
    for (const vertex of vertices) assert(vertex.slice(2).split(' ').map(Number).every(Number.isFinite), `Non-finite vertex ${filename}`);
    for (const face of faces) {
      const indices = face.slice(2).split(' ').map((element) => Number(element.split('/')[0]));
      assert.equal(indices.length, 3);
      assert(indices.every((index) => Number.isInteger(index) && index > 0 && index <= vertices.length), `Invalid OBJ indices ${filename}`);
    }
  }
}

await mkdir(outputRoot, { recursive: true });
const commonFiles = new Map();
const summary = [];
for (const [index, testCase] of activeCases.entries()) {
  const testRobot = testCase.metadataColors ? { ...robot, metadata: { ...robot.metadata, bodyColors: testCase.metadataColors } } : robot;
  let referencePoseFiles;
  if (testCase.activeBehavior) {
    referencePoseFiles = (await buildExportBundle({ robot: testRobot, selection: testCase.selection, colors: testCase.colors, bodyColors: testCase.bodyColors, outfitName: testCase.name, createArchive: false })).files;
    group.position.z += 0.05;
    group.rotation.y += 0.4;
    bodies.get('jaw_soft').rotateZ(0.25);
    group.updateMatrixWorld(true);
  }
  const bundle = await buildExportBundle({ robot: testRobot, selection: testCase.selection, colors: testCase.colors, bodyColors: testCase.bodyColors, outfitName: testCase.name, createArchive: index === 0 });
  checkFiles(bundle, testCase);
  if (testCase.activeBehavior) {
    for (const filename of ['microduck.urdf', 'microduck.xml', ...Object.keys(bundle.files).filter((filename) => filename.endsWith('.obj'))]) {
      assert.deepEqual(bundle.files[filename], referencePoseFiles[filename], `Web motion was baked into ${filename}.`);
    }
  }
  if (bundle.bytes) {
    const unzipped = unzipSync(bundle.bytes);
    assert.deepEqual(Object.keys(unzipped).sort(), Object.keys(bundle.files).sort());
    for (const [filename, bytes] of Object.entries(bundle.files)) assert.deepEqual(unzipped[filename], bytes, `ZIP round-trip mismatch ${filename}`);
    await writeFile(path.join(outputRoot, 'verified-download.zip'), bundle.bytes);
  }
  const caseRoot = path.join(outputRoot, `case-${testCase.id}`);
  await mkdir(caseRoot, { recursive: true });
  for (const [filename, bytes] of Object.entries(bundle.files)) {
    const destination = path.join(caseRoot, filename);
    await mkdir(path.dirname(destination), { recursive: true });
    if (filename.startsWith('meshes/robot/') || filename === 'LICENSE-Microduck.txt') {
      if (!commonFiles.has(filename)) {
        const shared = path.join(outputRoot, '_shared', filename);
        await mkdir(path.dirname(shared), { recursive: true });
        await writeFile(shared, bytes);
        commonFiles.set(filename, shared);
      }
      try { await link(commonFiles.get(filename), destination); } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
    } else await writeFile(destination, bytes);
  }
  summary.push({ case: testCase.id, clothingMeshes: bundle.manifest.clothing.length, robotJoints: bundle.manifest.joints.length, bodyColors: bundle.manifest.bodyColors });
  if ((index + 1) % 10 === 0 || index === activeCases.length - 1) console.log(`Validated export structure ${index + 1}/${activeCases.length}.`);
}
await writeFile(path.join(outputRoot, 'export-validation.json'), JSON.stringify({ catalogCount: outfits.length, cases: summary }, null, 2));
console.log(`Export XML, relative meshes, body attachments, OBJ indices and ZIP round-trip passed: ${activeCases.length} cases, ${outfits.length} catalog outfits. Output: ${outputRoot}`);
