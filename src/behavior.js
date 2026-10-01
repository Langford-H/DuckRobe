import { MathUtils, Vector3 } from 'three';

const TAU = Math.PI * 2;
const DURATIONS = { observe: 2.7, hop: 1.25, turn: 3.4, dance: 3.6, greet: 1.4, rest: 2.4 };
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
    if (!['hop', 'dance', 'turn', 'greet', 'observe'].includes(kind) || externalInteraction) return false;
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
    const choices = ['observe', 'hop', 'dance', 'turn', 'rest', 'rest'].filter(kind => kind !== lastIdle);
    const kind = choices[Math.floor(clamp(random(), 0, .999999) * choices.length)];
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
    if (pointerActive && active && !active.manual && !['rest', 'observe', 'greet'].includes(active.kind)) {
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
      active = null; nextIdle = elapsed + 1.2 + random() * 2.3;
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
    return { kind: busy ? 'inspect' : active?.kind || (pointerActive ? 'curious' : 'rest'), support, lift: blended.lift, footBounds: { ...footBounds }, enabled: Boolean(enabled), interacting: busy };
  }

  return { animate, trigger, setInteraction, getState: () => ({ kind: active?.kind || 'rest', elapsed, support, footBounds: { ...footBounds } }) };
}
