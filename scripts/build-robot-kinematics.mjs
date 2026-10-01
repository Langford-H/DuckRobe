import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMParser } from '@xmldom/xmldom';

// Export the pinned native MJCF's body and visual-mesh frames for the Web
// renderer. Dynamics and collisions remain in the original simulation XML.
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const robotRoot = path.join(projectRoot, 'public/robot');
const manifestPath = path.join(robotRoot, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const sourcePath = 'source/robot_allcollisions.xml';
const sourceBytes = await readFile(path.join(robotRoot, sourcePath));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
if (sha256(sourceBytes) !== manifest.files[sourcePath].sha256) {
  throw new Error('Native MJCF does not match its pinned manifest hash.');
}
const document = new DOMParser().parseFromString(sourceBytes.toString('utf8'), 'application/xml');
const root = document.documentElement;
if (root.tagName !== 'mujoco' || document.getElementsByTagName('parsererror').length) {
  throw new Error('Expected a valid native MJCF document.');
}
const children = (element, tag) => Array.from(element.childNodes)
  .filter((node) => node.nodeType === 1 && (!tag || node.tagName === tag));
const first = (element, tag) => children(element, tag)[0];
const attrs = (element) => element
  ? Object.fromEntries(Array.from(element.attributes).map((attribute) => [attribute.name, attribute.value])) : {};
const vector = (value, fallback, length) => {
  const values = value ? value.trim().split(/\s+/).map(Number) : [...fallback];
  if (values.length !== length || !values.every(Number.isFinite)) throw new Error(`Invalid native frame vector: ${value}`);
  return values;
};
const compiler = first(root, 'compiler');
if (compiler?.getAttribute('angle') !== 'radian' || document.getElementsByTagName('include').length) {
  throw new Error('This exporter expects the pinned, self-contained, radian-based MJCF.');
}

// Resolve the MJCF default-class tree for mesh type, group and RGBA. Inline
// attributes override class values; material RGBA supplies visual color.
const defaults = new Map();
let globalDefaults = {};
function collectDefaults(element, inherited) {
  const own = { ...inherited };
  for (const child of children(element)) {
    if (child.tagName !== 'default') own[child.tagName] = { ...own[child.tagName], ...attrs(child) };
  }
  const name = element.getAttribute('class');
  if (name) defaults.set(name, own);
  else globalDefaults = { ...globalDefaults, ...own };
  for (const child of children(element, 'default')) collectDefaults(child, own);
}
for (const element of children(root, 'default')) collectDefaults(element, globalDefaults);
const effective = (element, type, inheritedClass) => {
  const name = element.getAttribute('class') || inheritedClass;
  return { ...globalDefaults[type], ...defaults.get(name)?.[type], ...attrs(element) };
};
const asset = first(root, 'asset');
const meshFiles = new Map(children(asset, 'mesh').map((mesh) => {
  const file = mesh.getAttribute('file');
  return [mesh.getAttribute('name') || path.basename(file, path.extname(file)), file];
}));
const materialColors = new Map(children(asset, 'material').map((material) => [
  material.getAttribute('name'), effective(material, 'material').rgba,
]));
const actuatedJoints = children(first(root, 'actuator')).map((actuator) => actuator.getAttribute('joint'));
const actuatorIndex = new Map(actuatedJoints.map((name, index) => [name, index]));
const bodies = [];
function frame(element) {
  if (['euler', 'axisangle', 'xyaxes', 'zaxis'].some((name) => element.hasAttribute(name))) {
    throw new Error('The pinned native model must use explicit quaternion frames.');
  }
  return {
    pos: vector(element.getAttribute('pos'), [0, 0, 0], 3),
    quat: vector(element.getAttribute('quat'), [1, 0, 0, 0], 4),
  };
}
function visit(element, parentName = null, inheritedClass = '') {
  const name = element.getAttribute('name');
  const childClass = element.getAttribute('childclass') || inheritedClass;
  const body = { name, parent: parentName, ...frame(element), geoms: [], joint: null };
  const joints = children(element, 'joint');
  if (joints.length > 1) throw new Error(`The pinned Web rig expects one hinge per body: ${name}`);
  if (joints.length) {
    const settings = effective(joints[0], 'joint', childClass);
    body.joint = {
      name: settings.name,
      axis: vector(settings.axis, [0, 0, 1], 3),
      type: settings.type || 'hinge',
      pos: vector(settings.pos, [0, 0, 0], 3),
      range: vector(settings.range, [0, 0], 2),
      actuator_index: actuatorIndex.get(settings.name) ?? null,
    };
  }
  for (const geom of children(element, 'geom')) {
    const settings = effective(geom, 'geom', childClass);
    if (settings.type !== 'mesh' || settings.group !== '2') continue;
    const mesh = meshFiles.get(settings.mesh);
    if (!mesh) throw new Error(`Native visual mesh asset not found: ${settings.mesh}`);
    const visual = { type: 'mesh', mesh, ...frame(geom) };
    const rgba = settings.rgba || materialColors.get(settings.material);
    if (rgba) visual.color = vector(rgba, [1, 1, 1, 1], 4);
    body.geoms.push(visual);
  }
  bodies.push(body);
  for (const child of children(element, 'body')) visit(child, name, childClass);
}
for (const body of children(first(root, 'worldbody'), 'body')) visit(body);
const visualMeshCount = bodies.reduce((count, body) => count + body.geoms.length, 0);
if (bodies.length !== 15 || actuatedJoints.length !== 14 || visualMeshCount !== 70) {
  throw new Error(`Pinned Microduck topology changed: ${bodies.length} bodies, ${actuatedJoints.length} joints, ${visualMeshCount} visuals.`);
}
const kinematics = { bodies, actuated_joints: actuatedJoints, mesh_dir: '/robot/source/assets' };
const bytes = Buffer.from(`${JSON.stringify(kinematics, null, 2)}\n`);
await writeFile(path.join(robotRoot, 'web/kinematics.json'), bytes);
const generatedSource = {
  repository: manifest.native.repository,
  revision: manifest.native.revision,
  license: manifest.native.license,
  generator: 'scripts/build-robot-kinematics.mjs',
  sourceFiles: [sourcePath],
  bodyCount: bodies.length,
  actuatedJointCount: actuatedJoints.length,
  visualMeshCount,
  frames: 'Native MJCF body-local frames in metres; quaternions [w,x,y,z].',
};
manifest.web.kinematics = generatedSource;
manifest.files['web/kinematics.json'] = {
  kind: 'generated',
  ...generatedSource,
  bytes: bytes.length,
  sha256: sha256(bytes),
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ bodies: bodies.length, actuatedJoints: actuatedJoints.length, visualMeshes: visualMeshCount, bytes: bytes.length, sha256: sha256(bytes) }, null, 2));
