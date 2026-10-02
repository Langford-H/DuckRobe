import { MathUtils, Vector3 } from 'three';

const TAU = Math.PI * 2;
export const ACTIONS = Object.freeze([
  { id: 'hop', en: 'Little hop', zh: '蹦一下', duration: 1.25, featured: true, energy: 'lively' },
  { id: 'dance', en: 'Happy dance', zh: '快乐摇摆舞', duration: 3.6, featured: true, energy: 'lively' },
  { id: 'turn', en: 'Little twirl', zh: '转个小圈', duration: 3.4, featured: true, energy: 'lively' },
  { id: 'greet', en: 'Say hello', zh: '歪头打招呼', duration: 1.4, energy: 'quiet' },
  { id: 'observe', en: 'Curious glance', zh: '好奇瞧瞧', duration: 2.7, energy: 'quiet' },
  { id: 'rest', en: 'Take a breath', zh: '安静歇一会', duration: 4.8, energy: 'quiet' },
  { id: 'peek', en: 'A shy peek', zh: '探头偷瞄', duration: 2.3, energy: 'quiet' },
  { id: 'tilt', en: 'Little head tilts', zh: '左右歪歪头', duration: 2.4, energy: 'quiet' },
  { id: 'nod', en: 'Yes, yes!', zh: '认真点点头', duration: 2.1, energy: 'quiet' },
  { id: 'sway', en: 'Gentle sway', zh: '慢慢晃一晃', duration: 3.8, energy: 'quiet' },
  { id: 'tiny-steps', en: 'Tiny marching steps', zh: '小碎步踏踏', duration: 3.2, energy: 'lively' },
  { id: 'double-hop', en: 'Two happy hops', zh: '开心连跳两下', duration: 1.9, energy: 'lively' },
  { id: 'shimmy', en: 'Little wiggle', zh: '抖抖小身子', duration: 2.2, energy: 'lively' },
  { id: 'toe-tap', en: 'Tap a little rhythm', zh: '脚尖点拍子', duration: 3, energy: 'lively' },
  { id: 'bow', en: 'A polite bow', zh: '礼貌鞠个躬', duration: 2.6, energy: 'quiet' },
  { id: 'look-around', en: 'Look all around', zh: '环顾小世界', duration: 4.2, energy: 'quiet' },
].map(action => Object.freeze({ featured: false, ...action })));
const ACTION_BY_ID = new Map(ACTIONS.map(action => [action.id, action]));
const DURATIONS = Object.fromEntries(ACTIONS.map(action => [action.id, action.duration]));
const QUIET_ACTIONS = new Set(ACTIONS.filter(action => action.energy === 'quiet').map(action => action.id));
const IDLE_WEIGHTS = {
  rest: 7, observe: 4, peek: 2, tilt: 2, nod: 1, sway: 1, 'look-around': 2,
  hop: 1, dance: .4, turn: .3, 'tiny-steps': .6, 'double-hop': .4, 'toe-tap': .6,
};
const clamp = MathUtils.clamp;
const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const pulse = (time, start, end) => time <= start || time >= end ? 0 : Math.sin(Math.PI * (time - start) / (end - start)) ** 2;
const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

function poseFrame() { return { offsets: {}, roll: 0, pitch: 0, yaw: 0, lift: 0, jaw: 0, support: 'both' }; }
function bend(frame, side, amount) {
  const sign = side === 'left' ? 1 : -1;
  // The official knee axis opposes its hip/ankle axis. These increments
  // shorten the leg while keeping the foot parallel to its standing pose.
  frame.offsets[`${side}_hip_pitch`] = sign * amount;
  frame.offsets[`${side}_knee`] = sign * amount * 2;
  frame.offsets[`${side}_ankle`] = sign * amount;
}

function actionFrame(kind, progress) {
  const frame = poseFrame();
  const envelope = smooth(progress / .12) * smooth((1 - progress) / .16);
  if (kind === 'observe' || kind === 'greet') {
    frame.offsets.head_yaw = Math.sin(progress * TAU) * .16 * envelope;
    frame.offsets.head_roll = Math.sin(progress * Math.PI) * (kind === 'greet' ? .19 : -.10) * envelope;
    frame.offsets.head_pitch = -.05 * envelope;
    frame.jaw = kind === 'greet' ? pulse(progress, .28, .64) * .12 : 0;
  } else if (kind === 'hop') {
    const crouch = pulse(progress, 0, .32) * .24 + pulse(progress, .66, .96) * .20;
    bend(frame, 'left', crouch); bend(frame, 'right', crouch);
    frame.lift = pulse(progress, .26, .76) * .021;
    frame.offsets.head_pitch = -.06 * envelope;
    frame.offsets.head_roll = Math.sin(progress * TAU) * .045 * envelope;
    frame.jaw = pulse(progress, .35, .61) * .09;
  } else if (kind === 'dance' || kind === 'turn') {
    const cycles = kind === 'turn' ? 4 : 3;
    const beat = Math.sin(progress * TAU * cycles);
    const leftLift = Math.max(0, beat) * .23 * envelope;
    const rightLift = Math.max(0, -beat) * .23 * envelope;
    bend(frame, 'left', leftLift); bend(frame, 'right', rightLift);
    frame.support = leftLift > .015 ? 'right' : rightLift > .015 ? 'left' : 'both';
    frame.roll = beat * .025 * envelope;
    frame.offsets.head_roll = -beat * .09 * envelope;
    frame.offsets.head_yaw = Math.sin(progress * TAU * 1.5) * .15 * envelope;
    frame.offsets.head_pitch = Math.sin(progress * TAU * cycles) * .045 * envelope;
    if (kind === 'turn') frame.yaw = TAU * smooth(progress);
    else frame.yaw = Math.sin(progress * TAU * 1.5) * .13 * envelope;
  } else if (kind === 'rest') {
    const breath = Math.sin(progress * Math.PI) * envelope;
    frame.offsets.neck_pitch = -.012 * breath;
    frame.offsets.head_pitch = .012 * breath;
  } else if (kind === 'peek') {
    const peek = pulse(progress, .06, .94);
    frame.offsets.neck_pitch = -.13 * peek;
    frame.offsets.head_pitch = .10 * peek;
    frame.offsets.head_yaw = .31 * peek;
    frame.offsets.head_roll = -.08 * peek;
  } else if (kind === 'tilt') {
    frame.offsets.head_roll = Math.sin(progress * TAU) * .22 * envelope;
    frame.offsets.head_yaw = Math.sin(progress * TAU) * -.065 * envelope;
    frame.offsets.head_pitch = -.045 * envelope;
  } else if (kind === 'nod') {
    const nod = pulse(progress, .08, .44) + pulse(progress, .48, .86);
    frame.offsets.head_pitch = .22 * nod;
    frame.offsets.neck_pitch = -.045 * nod;
    frame.jaw = pulse(progress, .69, .84) * .045;
  } else if (kind === 'sway') {
    const sway = Math.sin(progress * TAU * 1.5) * envelope;
    frame.roll = sway * .044;
    frame.offsets.head_roll = -sway * .10;
    frame.offsets.neck_pitch = -.025 * envelope;
  } else if (kind === 'tiny-steps') {
    const beat = Math.sin(progress * TAU * 3);
    const left = Math.max(0, beat) * .27 * envelope;
    const right = Math.max(0, -beat) * .27 * envelope;
    bend(frame, 'left', left); bend(frame, 'right', right);
    frame.support = left > .012 ? 'right' : right > .012 ? 'left' : 'both';
    frame.offsets.head_pitch = Math.sin(progress * TAU * 6) * .025 * envelope;
    frame.offsets.head_yaw = .06 * envelope;
  } else if (kind === 'double-hop') {
    const crouch = pulse(progress, 0, .23) * .19 + pulse(progress, .34, .57) * .22 + pulse(progress, .72, .98) * .18;
    bend(frame, 'left', crouch); bend(frame, 'right', crouch);
    frame.lift = (pulse(progress, .16, .44) + pulse(progress, .50, .82)) * .019;
    frame.offsets.head_pitch = -.05 * envelope;
    frame.jaw = (pulse(progress, .22, .37) + pulse(progress, .57, .73)) * .085;
  } else if (kind === 'shimmy') {
    const wiggle = Math.sin(progress * TAU * 4) * envelope;
    frame.yaw = wiggle * .065;
    frame.offsets.head_yaw = -wiggle * .11;
    frame.offsets.head_roll = Math.cos(progress * TAU * 4) * .045 * envelope;
    frame.offsets.left_hip_yaw = wiggle * .035;
    frame.offsets.right_hip_yaw = wiggle * .035;
  } else if (kind === 'toe-tap') {
    const left = (pulse(progress, .08, .26) + pulse(progress, .28, .46)) * .16;
    const right = (pulse(progress, .52, .70) + pulse(progress, .72, .90)) * .16;
    bend(frame, 'left', left); bend(frame, 'right', right);
    frame.offsets.left_ankle += left * .45;
    frame.offsets.right_ankle -= right * .45;
    frame.support = left > .012 ? 'right' : right > .012 ? 'left' : 'both';
    frame.offsets.head_roll = (right - left) * .35;
  } else if (kind === 'bow') {
    const bow = pulse(progress, .04, .96);
    bend(frame, 'left', bow * .11); bend(frame, 'right', bow * .11);
    frame.pitch = bow * .075;
    frame.offsets.neck_pitch = bow * .12;
    frame.offsets.head_pitch = bow * .20;
  } else if (kind === 'look-around') {
    frame.offsets.head_yaw = Math.sin(progress * TAU) * .34 * envelope;
    frame.offsets.head_pitch = Math.sin(progress * TAU - Math.PI / 2) * .10 * envelope;
    frame.offsets.head_roll = Math.sin(progress * TAU) * -.04 * envelope;
    frame.offsets.neck_pitch = -.035 * envelope;
  }
  return frame;
}

/** Display behavior only: source frames, physical parameters and standing
 * metadata are never changed. All joint rotations pass through setJoint. */
export function createBehaviorController({ group, bodies, setJoint, defaultPose, groundOffset = 0, jawPivot, jawAxis, random = Math.random }) {
  let lastTime = null, elapsed = 0, active = null, pending = null, nextIdle = 1.1;
  let externalInteraction = false, recoveryUntil = 0, previousInteraction = false, previousEnabled = true;
  let lastIdle = 'rest', nearLatched = false, nearCooldown = 0;
  const values = Object.fromEntries(Object.keys(defaultPose).map(name => [name, 0]));
  const blended = { roll: 0, pitch: 0, lift: 0, jaw: 0 };
  const footNames = ['ankle_left', 'ankle_right'];
  const supportCache = new WeakMap();
  const direction = new Vector3();
  const footBounds = { left: 0, right: 0 };
  const rootTranslation = new Vector3();
  const footPosition = new Vector3();
  let footLock = null;
  let support = 'both';

  function trigger(kind = 'hop') {
    if (!ACTION_BY_ID.has(kind) || externalInteraction) return false;
    pending = kind;
    return true;
  }

  function setInteraction(interacting) { externalInteraction = Boolean(interacting); }

  function meshBottom(mesh) {
    const positions = mesh.geometry.getAttribute('position');
    if (!positions) return Infinity;
    const e = mesh.matrixWorld.elements;
    direction.set(e[2], e[6], e[10]);
    let cached = supportCache.get(mesh);
    if (!cached || cached.geometry !== mesh.geometry) {
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox;
      const radius = Math.hypot(Math.max(Math.abs(box.min.x), Math.abs(box.max.x)), Math.max(Math.abs(box.min.y), Math.abs(box.max.y)), Math.max(Math.abs(box.min.z), Math.abs(box.max.z)));
      cached = { geometry: mesh.geometry, direction: new Vector3(Infinity, 0, 0), minimum: 0, radius };
      supportCache.set(mesh, cached);
    }
    const difference = direction.distanceTo(cached.direction);
    if (difference > .00035) {
      let minimum = Infinity;
      for (let i = 0; i < positions.count; i++) minimum = Math.min(minimum, positions.getX(i) * e[2] + positions.getY(i) * e[6] + positions.getZ(i) * e[10]);
      cached.minimum = minimum; cached.direction.copy(direction);
      return minimum + e[14];
    }
    // Reuse exact support queries when the sole's orientation is stable. The
    // error bound keeps every vertex above the floor between cache refreshes.
    return cached.minimum - cached.radius * difference + e[14];
  }

  function groundFeet(lift) {
    group.updateMatrixWorld(true);
    const minima = footNames.map(name => {
      let minimum = Infinity;
      bodies.get(name)?.traverse(mesh => { if (mesh.isMesh && mesh.visible) minimum = Math.min(minimum, meshBottom(mesh)); });
      return minimum;
    });
    const minimum = Math.min(...minima);
    if (Number.isFinite(minimum)) group.position.z += -minimum + lift;
    else group.position.z = groundOffset + lift;
    group.updateMatrixWorld(true);
    footBounds.left = Number.isFinite(minima[0]) ? minima[0] - minimum + lift : lift;
    footBounds.right = Number.isFinite(minima[1]) ? minima[1] - minimum + lift : lift;
  }

  function chooseIdle() {
    const previousWasLively = ACTION_BY_ID.get(lastIdle)?.energy === 'lively';
    const choices = Object.entries(IDLE_WEIGHTS).filter(([kind]) => kind !== lastIdle && (!previousWasLively || QUIET_ACTIONS.has(kind)));
    const total = choices.reduce((sum, [, weight]) => sum + weight, 0);
    let pick = clamp(random(), 0, .999999) * total;
    const kind = choices.find(([, weight]) => { pick -= weight; return pick < 0; })?.[0] || 'rest';
    lastIdle = kind;
    active = { kind, start: elapsed, duration: DURATIONS[kind] };
  }

  function plantTurningFoot(dt) {
    if (active?.kind !== 'turn' || previousInteraction) {
      footLock = null;
      rootTranslation.multiplyScalar(Math.exp(-dt * 5));
      group.position.x = rootTranslation.x; group.position.y = rootTranslation.y;
      return;
    }
    group.updateMatrixWorld(true);
    const bodyName = support === 'left' ? 'ankle_left' : support === 'right' ? 'ankle_right' : footLock?.bodyName;
    const body = bodies.get(bodyName);
    if (!body) return;
    body.getWorldPosition(footPosition);
    if (footLock?.bodyName !== bodyName) footLock = { bodyName, point: footPosition.clone() };
    else {
      rootTranslation.x += footLock.point.x - footPosition.x;
      rootTranslation.y += footLock.point.y - footPosition.y;
      // The little steps stay within the display plinth, even after a long
      // sequence of turns. Horizontal pinning avoids a stationary spin-skate.
      if (rootTranslation.length() > .035) rootTranslation.setLength(.035);
      group.position.x = rootTranslation.x; group.position.y = rootTranslation.y;
    }
  }

  function animate(time, options = {}) {
    if (typeof options === 'boolean') options = { enabled: options };
    const { enabled = true, pointer = null, interacting = false } = options || {};
    const dt = lastTime === null ? 1 / 60 : clamp(time - lastTime, 0, .05);
    lastTime = time; elapsed += dt;
    if (!enabled && previousEnabled) active = null;
    previousEnabled = Boolean(enabled);
    const busy = Boolean(interacting || externalInteraction);
    if (busy !== previousInteraction) {
      active = null;
      if (busy) pending = null;
      else recoveryUntil = pending ? elapsed : elapsed + .8;
      previousInteraction = busy;
    }
    const recovering = elapsed < recoveryUntil;
    const pointerActive = enabled && !busy && !recovering && pointer?.active;
    const near = pointerActive ? clamp(Number(pointer.near) || 0, 0, 1) : 0;
    if (pointerActive && active && !active.manual && !QUIET_ACTIONS.has(active.kind)) {
      active = null; nextIdle = elapsed + 2;
    }
    if (near < .35) nearLatched = false;
    if (near > .66 && !nearLatched && elapsed >= nearCooldown) {
      if (!active || ['rest', 'observe'].includes(active.kind)) {
        nearLatched = true; nearCooldown = elapsed + 4; pending = 'greet';
      }
    }
    if (!enabled && !pending && active && !active.manual) active = null;
    if (pending && !busy && !recovering) {
      active = { kind: pending, start: elapsed, duration: DURATIONS[pending], manual: true };
      pending = null;
    }
    if (active && elapsed - active.start >= active.duration) {
      const lively = ACTION_BY_ID.get(active.kind)?.energy === 'lively';
      active = null; nextIdle = elapsed + (lively ? 2 : 1.3) + random() * (lively ? 3 : 2.5);
    }
    if (enabled && !busy && !recovering && !active && !pointerActive && elapsed >= nextIdle) chooseIdle();

    const frame = active && !busy ? actionFrame(active.kind, clamp((elapsed - active.start) / active.duration, 0, 1)) : poseFrame();
    support = frame.support;
    if (pointerActive) {
      // The UI may provide yaw/pitch relative to the robot after camera-space
      // projection. Normalized screen x/y are also supported for simple views.
      const yaw = Number.isFinite(pointer.yaw) ? pointer.yaw : clamp(Number(pointer.x) || 0, -1, 1) * .32;
      const pitch = Number.isFinite(pointer.pitch) ? pointer.pitch : -clamp(Number(pointer.y) || 0, -1, 1) * .15;
      frame.offsets.head_yaw = clamp(yaw, -.42, .42);
      frame.offsets.head_pitch = clamp(pitch, -.15, .15);
      frame.offsets.head_roll = (frame.offsets.head_roll || 0) + near * .055;
    }
    // Do not turn the character underneath a user who is inspecting it.
    const targetYaw = busy || recovering || (!enabled && !active) ? group.rotation.z : frame.yaw;
    group.rotation.z += angleDelta(group.rotation.z, targetYaw) * (1 - Math.exp(-dt * 15));
    const weight = 1 - Math.exp(-dt * 16);
    for (const key of Object.keys(blended)) blended[key] += (frame[key] - blended[key]) * weight;
    for (const name of Object.keys(defaultPose)) {
      values[name] += ((frame.offsets[name] || 0) - values[name]) * weight;
      let correction = 0;
      if (name.endsWith('_hip_roll')) correction = -blended.roll;
      if (name.endsWith('_ankle')) correction = (name.startsWith('left') ? -1 : 1) * blended.pitch;
      setJoint(name, defaultPose[name] + values[name] + correction);
    }
    group.rotation.x = blended.roll; group.rotation.y = blended.pitch;
    group.position.set(rootTranslation.x, rootTranslation.y, groundOffset);
    plantTurningFoot(dt);
    if (jawPivot && jawAxis) jawPivot.quaternion.setFromAxisAngle(jawAxis, blended.jaw);
    groundFeet(blended.lift);
    return { kind: busy ? 'inspect' : active?.kind || (pointerActive ? 'curious' : 'rest'), active: Boolean(active), manual: Boolean(active?.manual), support, lift: blended.lift, footBounds: { ...footBounds }, enabled: Boolean(enabled), interacting: busy };
  }

  return { animate, trigger, setInteraction, getState: () => ({ kind: active?.kind || 'rest', active: Boolean(active), manual: Boolean(active?.manual), elapsed, support, footBounds: { ...footBounds } }) };
}
