import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, PerspectiveCamera, Vector3 } from 'three';
import { loadRobot, DEFAULT_ROBOT_COLORS, normalizeRobotColors } from '../src/robot.js';
import { ACTIONS, createBehaviorController } from '../src/behavior.js';

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
const exportReference = () => JSON.stringify({ defaultPose: rig.metadata.defaultPose, anchorDefinitions: rig.metadata.anchorDefinitions,
  native: rig.metadata.native, kinematics: rig.metadata.kinematics, groundOffset: rig.metadata.groundOffset });
const immutable = exportReference();
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
function frame(options = { enabled: true }, step = 1 / 60) {
  const previousQuaternion = rig.group.quaternion.clone();
  const state = animate(time, options); time += step; frames++;
  for (const [name, joint] of rig.joints) {
    assert(Number.isFinite(joint.angle), `Nonfinite joint ${name}`);
    if (joint.range) assert(joint.angle >= joint.range[0] - 1e-10 && joint.angle <= joint.range[1] + 1e-10, `Joint exceeds source range: ${name}`);
  }
  assert.deepEqual(rig.group.scale.toArray(), [1, 1, 1], 'Robot geometry must not squash');
  assert(Math.hypot(rig.group.position.x, rig.group.position.y) <= .035001, 'Turn walked off the central stage');
  assert(state.footBounds.left >= -1e-8 && state.footBounds.right >= -1e-8, 'Cached foot support reports penetration');
  assert(rig.group.quaternion.angleTo(previousQuaternion) < .25, 'Action transition snapped the robot orientation');
  if (frames % 37 === 0) {
    const bottom = exactSoleBottom(); smallestGap = Math.min(smallestGap, bottom); biggestGap = Math.max(biggestGap, bottom);
    assert(bottom >= -1e-8, `Foot or footwear penetrates the floor by ${bottom}`);
  }
  return state;
}

frame({ enabled: false });
assert.equal(ACTIONS.length, 16);
assert.equal(new Set(ACTIONS.map(action => action.id)).size, 16);
assert(ACTIONS.every(action => Object.isFrozen(action) && action.duration > 1 && action.duration < 5));
assert.deepEqual(ACTIONS.filter(action => action.featured).map(action => action.id), ['hop', 'dance', 'turn']);
assert.equal(rig.trigger('not-a-robot-action'), false);
const actions = {};
const signatures = new Set();
for (const action of ACTIONS) {
  const kind = action.id;
  assert(rig.trigger(kind));
  let maximumLift = 0;
  let minimumYaw = Infinity, maximumYaw = -Infinity, maximumFootGap = 0;
  const jointMin = {}, jointMax = {}, lifts = [];
  const roll = [], pitch = [];
  const observed = new Set();
  for (let i = 0; i < Math.ceil(action.duration * 60) + 90; i++) {
    const state = frame({ enabled: false }); observed.add(state.kind); maximumLift = Math.max(maximumLift, state.lift);
    minimumYaw = Math.min(minimumYaw, rig.group.rotation.z); maximumYaw = Math.max(maximumYaw, rig.group.rotation.z);
    maximumFootGap = Math.max(maximumFootGap, Math.abs(state.footBounds.left - state.footBounds.right));
    lifts.push(state.lift); roll.push(rig.group.rotation.x); pitch.push(rig.group.rotation.y);
    for (const [name, joint] of rig.joints) {
      const offset = joint.angle - rig.metadata.defaultPose[name];
      jointMin[name] = Math.min(jointMin[name] ?? Infinity, offset);
      jointMax[name] = Math.max(jointMax[name] ?? -Infinity, offset);
    }
  }
  assert(observed.has(kind), `${kind} never played`);
  assert.equal(rig.behavior.getState().active, false, `${kind} did not complete`);
  assert(Object.values(jointMax).some((value, index) => value - Object.values(jointMin)[index] > .007), `${kind} has no visible native joint motion`);
  const trace = [maximumLift, maximumFootGap, maximumYaw - minimumYaw, Math.max(...roll) - Math.min(...roll), Math.max(...pitch) - Math.min(...pitch), ...Object.keys(jointMin).flatMap(name => [jointMin[name], jointMax[name]])];
  const signature = JSON.stringify(trace.map(value => Math.round(value * 10000)));
  assert(!signatures.has(signature), `${kind} repeats another action's actual motion`); signatures.add(signature);
  const liftPeaks = lifts.filter((value, index) => value > .012 && value > lifts[index - 1] && value >= lifts[index + 1]).length;
  actions[kind] = { duration: action.duration, maximumLift, yawTravel: maximumYaw - minimumYaw, maximumFootGap, liftPeaks };
}
assert(actions.hop.maximumLift > .015 && actions.hop.maximumLift < .022);
assert.equal(actions.hop.liftPeaks, 1, 'Hop must visibly leave the ground once');
assert.equal(actions['double-hop'].liftPeaks, 2, 'Double hop must visibly leave the ground twice');
assert(actions.turn.yawTravel > 6.2, 'Turn never completed a full revolution');
assert(actions.turn.maximumFootGap > .008 && actions.dance.maximumFootGap > .008, 'Stepping never lifted either foot');
assert(actions['tiny-steps'].maximumFootGap > .008 && actions['toe-tap'].maximumFootGap > .003, 'New stepping gestures never lifted a foot');

// New shoes participate in support queries even when attached after loading.
const syntheticFootwear = [];
for (const [bodyName, side] of [['ankle_left', 1], ['ankle_right', -1]]) {
  const shoe = new Group();
  const sole = new Mesh(new BoxGeometry(.052, .044, .006), new MeshStandardMaterial());
  sole.position.set(.007, side * -.0165, -.028); shoe.add(sole);
  rig.anchors.get(bodyName).add(shoe);
  syntheticFootwear.push(shoe);
}
for (const action of ACTIONS) {
  assert(rig.trigger(action.id));
  for (let i = 0; i < Math.ceil(action.duration * 30) + 12; i++) frame({ enabled: false }, 1 / 30);
}
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
assert.equal(immutable, exportReference(), 'Display motion polluted export metadata');

// Camera-relative targets are respected from both sides and behind the duck.
// The controller receives projected pointer angles and never moves the camera.
for (const position of [[.52, -.67, .35], [.52, .67, .35], [-.5, .2, .28]]) {
  const camera = new PerspectiveCamera(30, 1, .01, 5);
  camera.up.set(0, 0, 1); camera.position.fromArray(position); camera.lookAt(0, 0, .145); camera.updateMatrixWorld(true);
  const cameraSnapshot = JSON.stringify({ position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), projection: camera.projectionMatrix.toArray() });
  const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const gaze = new Vector3(.35, 0, 0).applyQuaternion(rig.group.quaternion)
    .addScaledVector(right, .12).addScaledVector(up, -.08).applyQuaternion(rig.group.quaternion.clone().invert());
  const target = { active: true, near: 0, yaw: Math.atan2(gaze.y, gaze.x), pitch: -Math.atan2(gaze.z, Math.hypot(gaze.x, gaze.y)) };
  for (let i = 0; i < 100; i++) frame({ enabled: true, pointer: target });
  assert(Math.abs(rig.joints.get('head_yaw').angle - Math.max(-.42, Math.min(.42, target.yaw))) < .002);
  assert(Math.abs(rig.joints.get('head_pitch').angle - rig.metadata.defaultPose.head_pitch - Math.max(-.15, Math.min(.15, target.pitch))) < .002);
  assert.equal(JSON.stringify({ position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), projection: camera.projectionMatrix.toArray() }), cameraSnapshot);
}
for (const [target, yaw, pitch] of [
  [{ active: true, near: 0, yaw: 1.8, pitch: -1.2 }, .42, -.15],
  [{ active: true, near: 0, x: -3, y: 5 }, -.32, -.15],
  [{ active: true, near: NaN, x: NaN, y: NaN, yaw: NaN, pitch: NaN }, 0, 0],
]) {
  for (let i = 0; i < 100; i++) frame({ enabled: true, pointer: target });
  assert(Math.abs(rig.joints.get('head_yaw').angle - yaw) < .002);
  assert(Math.abs(rig.joints.get('head_pitch').angle - rig.metadata.defaultPose.head_pitch - pitch) < .002);
}

// Rapid action changes blend instead of snapping; inspecting cancels them.
for (const id of ['turn', 'peek', 'double-hop', 'bow', 'shimmy', 'nod', 'toe-tap']) {
  assert(rig.trigger(id));
  for (let i = 0; i < 13; i++) frame({ enabled: false }, i % 3 === 0 ? 1 / 30 : 1 / 60);
}
rig.setInteraction(true);
assert.equal(rig.trigger('dance'), false);
const inspectedYaw = rig.group.rotation.z;
for (let i = 0; i < 110; i++) assert.equal(frame({ enabled: true, pointer: { active: true, x: -1, y: 1, near: 1 } }).kind, 'inspect');
assert.equal(rig.group.rotation.z, inspectedYaw);
rig.setInteraction(false);
for (let i = 0; i < 180; i++) frame({ enabled: false });
assert.equal(rig.behavior.getState().active, false);
for (const [name, joint] of rig.joints) assert(Math.abs(joint.angle - rig.metadata.defaultPose[name]) < .002, `Quiet mode left ${name} dancing`);

// A deterministic idle run checks scheduling without relying on one random
// browser session, including all newly attached shoes throughout the loop.
const idleKinds = new Set();
const idleEvents = [];
for (let seed of [3127, 822, 98761]) {
  const idle = createBehaviorController({ group: rig.group, bodies: rig.bodies, setJoint: rig.setJoint,
    defaultPose: rig.metadata.defaultPose, groundOffset: rig.metadata.groundOffset,
    random: () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; } });
  animate = idle.animate;
  let previous = { active: false }, previousEnergy = null;
  for (let i = 0; i < 3600; i++) {
    const state = frame({ enabled: true }, .05); idleKinds.add(state.kind);
    if (state.active && !previous.active) {
      const energy = ACTIONS.find(action => action.id === state.kind).energy;
      assert(!(energy === 'lively' && previousEnergy === 'lively'), 'Idle scheduled two lively actions in a row');
      previousEnergy = energy; idleEvents.push(energy);
    }
    previous = state;
  }
  for (let i = 0; i < 100; i++) frame({ enabled: false });
}
assert(idleKinds.size >= 6, 'Idle only repeated a few gestures');
const quietShare = idleEvents.filter(energy => energy === 'quiet').length / idleEvents.length;
assert(quietShare > .65, 'Idle behavior became continuously frantic');

syntheticFootwear.forEach(group => { group.removeFromParent(); group.traverse(mesh => { if (mesh.isMesh) { mesh.geometry.dispose(); mesh.material.dispose(); } }); });
const { ITEMS, OUTFITS, createOutfitParts } = await import('../src/outfits.js');
const itemById = new Map(ITEMS.map(item => [item.id, item]));
const testedFootwear = new Set();
const catalog = [];
const catalogFootwear = new Set(OUTFITS.map(outfit => itemById.get(outfit.selection.legwear)?.kind || 'bare'));
const extraFootwear = new Map(ITEMS.filter(item => item.slot === 'legwear' && !catalogFootwear.has(item.kind)).map(item => [item.kind, item]));
const fixtures = [...OUTFITS, ...[...extraFootwear.values()].map(item => ({ id: `footwear-only:${item.id}`, selection: { legwear: item.id } }))];
for (const outfit of fixtures) {
  rig.group.position.set(0, 0, rig.metadata.groundOffset); rig.group.rotation.set(0, 0, 0);
  for (const [name, angle] of Object.entries(rig.metadata.defaultPose)) rig.setJoint(name, angle);
  const parts = createOutfitParts(outfit.selection);
  if (outfit.selection.legwear) assert(parts.some(part => part.slot === 'legwear'), `${outfit.id}: selected footwear has no actual mesh parts`);
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
  const footwearKind = itemById.get(outfit.selection.legwear)?.kind || 'bare';
  // Footwear geometry is determined by kind; palette changes only material.
  // Run every gesture against each actual sole shape, and hop every full look.
  const actionCoverage = testedFootwear.has(footwearKind) ? ACTIONS.filter(action => action.id === 'hop') : ACTIONS;
  testedFootwear.add(footwearKind);
  for (const action of actionCoverage) {
    assert(controller.trigger(action.id));
    for (let i = 0; i < Math.ceil(action.duration / .05) + 8; i++) frame({ enabled: false }, .05);
  }
  catalog.push({ id: outfit.id, footwear: footwearKind, previewGroundAdjustment: actualAdjustment });
  for (const part of parts) {
    part.group.removeFromParent();
    const geometries = new Set(), materials = new Set();
    part.group.traverse(mesh => { if (mesh.isMesh) { geometries.add(mesh.geometry); materials.add(mesh.material); } });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
  }
}
assert.equal(immutable, exportReference());
console.log(JSON.stringify({ frames, smallestGap, biggestGap, actions, idleKinds: [...idleKinds], idleQuietShare: quietShare,
  catalogCount: OUTFITS.length, catalogFixtureCount: catalog.length, testedFootwear: [...testedFootwear], colors: rig.metadata.bodyColors, result: 'passed' }, null, 2));
