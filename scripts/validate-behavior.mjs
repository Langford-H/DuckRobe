import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { loadRobot, DEFAULT_ROBOT_COLORS, normalizeRobotColors } from '../src/robot.js';
import { createBehaviorController } from '../src/behavior.js';

// Load the exact browser GLB and body tree without WebGL or an HTTP server.
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
  const bytes = await readFile(filename);
  return new Response(bytes, { status: 200, headers: { 'content-length': String(bytes.length) } });
};

const rig = await loadRobot();
const immutable = JSON.stringify({ defaultPose: rig.metadata.defaultPose, anchorDefinitions: rig.metadata.anchorDefinitions, native: rig.metadata.native });
assert.deepEqual(rig.metadata.bodyColors, DEFAULT_ROBOT_COLORS);
assert.deepEqual(normalizeRobotColors({ shell: '#BADbad', accent: 'red' }), { shell: '#badbad', accent: DEFAULT_ROBOT_COLORS.accent });
rig.setColors({ shell: '#76A999', accent: '#ffc36b' });
assert.deepEqual(rig.metadata.bodyColors, { shell: '#76a999', accent: '#ffc36b' });
assert.equal(rig.group.getObjectByName('jaw_soft:top_head_shell.stl').material.color.getHexString(), '76a999');
assert.equal(rig.group.getObjectByName('jaw_soft:jaw.stl').material.color.getHexString(), 'ffc36b');
assert.equal(rig.group.getObjectByName('jaw_soft:lens.stl').material.color.getHexString(), '111b20');

function exactSoleBottom() {
  let minimum = Infinity;
  rig.group.updateMatrixWorld(true);
  for (const bodyName of ['ankle_left', 'ankle_right']) rig.bodies.get(bodyName).traverse(mesh => {
    if (!mesh.isMesh || !mesh.visible) return;
    const positions = mesh.geometry.getAttribute('position');
    const e = mesh.matrixWorld.elements;
    for (let i = 0; i < positions.count; i++) minimum = Math.min(minimum, positions.getX(i) * e[2] + positions.getY(i) * e[6] + positions.getZ(i) * e[10] + e[14]);
  });
  return minimum;
}

let time = 0, frames = 0, smallestGap = Infinity, biggestGap = 0, animate = rig.animate;
function frame(options = { enabled: true }) {
  const state = animate(time, options); time += 1 / 60; frames++;
  for (const [name, joint] of rig.joints) {
    assert(Number.isFinite(joint.angle), `Nonfinite joint ${name}`);
    if (joint.range) assert(joint.angle >= joint.range[0] - 1e-10 && joint.angle <= joint.range[1] + 1e-10, `Joint exceeds source range: ${name}`);
  }
  assert.deepEqual(rig.group.scale.toArray(), [1, 1, 1], 'Robot geometry must not squash');
  assert(Math.hypot(rig.group.position.x, rig.group.position.y) <= .035001, 'Turn walked off the central stage');
  if (frames % 9 === 0) {
    const bottom = exactSoleBottom(); smallestGap = Math.min(smallestGap, bottom); biggestGap = Math.max(biggestGap, bottom);
    assert(bottom >= -1e-8, `Foot or footwear penetrates the floor by ${bottom}`);
  }
  return state;
}

frame({ enabled: false });
const actions = {};
for (const kind of ['hop', 'dance', 'turn', 'greet', 'observe']) {
  assert(rig.trigger(kind));
  let maximumLift = 0;
  let minimumYaw = Infinity, maximumYaw = -Infinity, maximumFootGap = 0;
  const observed = new Set();
  for (let i = 0; i < 280; i++) {
    const state = frame({ enabled: false }); observed.add(state.kind); maximumLift = Math.max(maximumLift, state.lift);
    minimumYaw = Math.min(minimumYaw, rig.group.rotation.z); maximumYaw = Math.max(maximumYaw, rig.group.rotation.z);
    maximumFootGap = Math.max(maximumFootGap, Math.abs(state.footBounds.left - state.footBounds.right));
  }
  assert(observed.has(kind), `${kind} never played`);
  assert.equal(rig.behavior.getState().kind, 'rest');
  actions[kind] = { maximumLift, yawTravel: maximumYaw - minimumYaw, maximumFootGap, observed: [...observed] };
}
assert(actions.hop.maximumLift > .015 && actions.hop.maximumLift < .022);
assert(actions.turn.yawTravel > 6.2, 'Turn never completed a full revolution');
assert(actions.turn.maximumFootGap > .008 && actions.dance.maximumFootGap > .008, 'Stepping never lifted either foot');

// New shoes participate in support queries even when attached after loading.
const syntheticFootwear = [];
for (const [bodyName, side] of [['ankle_left', 1], ['ankle_right', -1]]) {
  const shoe = new Group();
  const sole = new Mesh(new BoxGeometry(.052, .044, .006), new MeshStandardMaterial());
  sole.position.set(.007, side * -.0165, -.028); shoe.add(sole);
  rig.anchors.get(bodyName).add(shoe);
  syntheticFootwear.push(shoe);
}
rig.trigger('dance');
for (let i = 0; i < 240; i++) frame({ enabled: false });
assert(exactSoleBottom() >= -1e-8);

// Hover follows one target and greets once; dragging suppresses reactions.
const pointer = { active: true, x: .75, y: .5, near: .9 };
const hover = new Set();
for (let i = 0; i < 220; i++) hover.add(frame({ enabled: true, pointer }).kind);
assert(hover.has('greet') && hover.has('curious'));
assert(rig.joints.get('head_yaw').angle > .20);
const initialYaw = rig.group.rotation.z;
for (let i = 0; i < 90; i++) assert.equal(frame({ enabled: true, pointer, interacting: true }).kind, 'inspect');
assert.equal(rig.group.rotation.z, initialYaw);
assert(Math.abs(rig.joints.get('head_yaw').angle) < .002);
// A manual action must override the inspection grace period. This is what
// happens when "Hop" is pressed just after picking new clothes or orbiting.
rig.setInteraction(false);
assert(rig.trigger('hop'));
assert.equal(frame({ enabled: false }).kind, 'hop');
for (let i = 0; i < 100; i++) frame({ enabled: false });
for (let i = 0; i < 90; i++) frame({ enabled: false });
assert.equal(rig.behavior.getState().kind, 'rest');
assert(Math.abs(rig.joints.get('head_roll').angle) < .002);
assert.equal(immutable, JSON.stringify({ defaultPose: rig.metadata.defaultPose, anchorDefinitions: rig.metadata.anchorDefinitions, native: rig.metadata.native }), 'Display motion polluted export metadata');

// A deterministic idle run checks scheduling without relying on one random
// browser session, including all newly attached shoes throughout the loop.
let seed = 3127;
const idle = createBehaviorController({ group: rig.group, bodies: rig.bodies, setJoint: rig.setJoint,
  defaultPose: rig.metadata.defaultPose, groundOffset: rig.metadata.groundOffset,
  random: () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; } });
animate = idle.animate;
const idleKinds = new Set();
for (let i = 0; i < 4200; i++) idleKinds.add(frame({ enabled: true }).kind);
assert.deepEqual([...idleKinds].sort(), ['dance', 'hop', 'observe', 'rest', 'turn']);

syntheticFootwear.forEach(group => { group.removeFromParent(); group.traverse(mesh => { if (mesh.isMesh) { mesh.geometry.dispose(); mesh.material.dispose(); } }); });
const { OUTFITS, createOutfitParts } = await import('../src/outfits.js');
const catalog = [];
for (const outfit of OUTFITS) {
  rig.group.position.set(0, 0, rig.metadata.groundOffset); rig.group.rotation.set(0, 0, 0);
  for (const [name, angle] of Object.entries(rig.metadata.defaultPose)) rig.setJoint(name, angle);
  const parts = createOutfitParts(outfit.selection);
  parts.forEach(part => rig.anchors.get(part.bodyName).add(part.group));
  rig.group.updateMatrixWorld(true);
  let footwearBottom = Infinity;
  for (const part of parts.filter(part => ['ankle_left', 'ankle_right'].includes(part.bodyName))) part.group.traverse(mesh => {
    if (!mesh.isMesh) return;
    const positions = mesh.geometry.getAttribute('position'), e = mesh.matrixWorld.elements;
    for (let i = 0; i < positions.count; i++) footwearBottom = Math.min(footwearBottom, positions.getX(i) * e[2] + positions.getY(i) * e[6] + positions.getZ(i) * e[10] + e[14]);
  });
  const expectedAdjustment = Number.isFinite(footwearBottom) ? Math.max(0, -footwearBottom) : 0;
  const controller = createBehaviorController({ group: rig.group, bodies: rig.bodies, setJoint: rig.setJoint,
    defaultPose: rig.metadata.defaultPose, groundOffset: rig.metadata.groundOffset, random: () => .5 });
  animate = controller.animate;
  frame({ enabled: false });
  const actualAdjustment = rig.group.position.z - rig.metadata.groundOffset;
  assert(Math.abs(actualAdjustment - expectedAdjustment) < 1e-10, `${outfit.id}: static footwear floor differs from reference export correction`);
  for (const [kind, count] of [['hop', 100], ['dance', 245], ['turn', 230]]) {
    assert(controller.trigger(kind));
    for (let i = 0; i < count; i++) frame({ enabled: false });
  }
  catalog.push({ id: outfit.id, footwear: outfit.selection.legwear, previewGroundAdjustment: actualAdjustment });
  for (const part of parts) {
    part.group.removeFromParent();
    const geometries = new Set(), materials = new Set();
    part.group.traverse(mesh => { if (mesh.isMesh) { geometries.add(mesh.geometry); materials.add(mesh.material); } });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
  }
}
assert.equal(immutable, JSON.stringify({ defaultPose: rig.metadata.defaultPose, anchorDefinitions: rig.metadata.anchorDefinitions, native: rig.metadata.native }));
console.log(JSON.stringify({ frames, smallestGap, biggestGap, actions, idleKinds: [...idleKinds], catalog, colors: rig.metadata.bodyColors, result: 'passed' }, null, 2));
