import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadRobot, robotPartColor } from './robot.js';
import { createOutfitParts } from './outfits.js';

const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
function lights(scene) {
  scene.add(new THREE.HemisphereLight(0xfffaf0, 0x909789, 2.5));
  const sun = new THREE.DirectionalLight(0xfffaf2, 3.2);
  sun.position.set(.6, -.55, 1); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -.4, right: .4, top: .4, bottom: -.4, near: .1, far: 3 });
  sun.shadow.normalBias = .002; sun.shadow.bias = -.0001; scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 1.6); fill.position.set(-.5, .6, .5); scene.add(fill);
}
function rendererFor(thumbnail = false) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: thumbnail });
  renderer.setPixelRatio(thumbnail ? 1 : Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = !thumbnail; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}
function attach(rig, selection) {
  const parts = createOutfitParts(selection);
  for (const part of parts) {
    const anchor = rig.anchors?.get(part.bodyName) || rig.group.getObjectByName(`outfit_anchor:${part.bodyName}`);
    if (!anchor) throw new Error(`Missing clothing anchor: ${part.bodyName}`);
    anchor.add(part.group);
    part.group.traverse(mesh => { if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; } });
  }
  return parts;
}
function dispose(parts) {
  const geometries = new Set(), materials = new Set();
  for (const { group } of parts) {
    group.removeFromParent();
    group.traverse(mesh => {
      if (mesh.isMesh) { geometries.add(mesh.geometry); (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => materials.add(material)); }
    });
  }
  geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
}

export async function createPreview({ viewer, colors, selection, onReaction = () => {} }) {
  const renderer = rendererFor();
  renderer.domElement.setAttribute('role', 'img'); viewer.append(renderer.domElement);
  const scene = new THREE.Scene(); lights(scene);
  const camera = new THREE.PerspectiveCamera(30, 1, .01, 5); camera.up.set(0, 0, 1); camera.position.set(.52, -.67, .35);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, .135); controls.enableDamping = true; controls.enablePan = false;
  controls.minDistance = .42; controls.maxDistance = 1.8; controls.minPolarAngle = .3; controls.maxPolarAngle = Math.PI / 2 + .04; controls.saveState();
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(.16, .167, .009, 96), new THREE.MeshStandardMaterial({ color: 0xe7e6d7, roughness: .95 }));
  plinth.rotation.x = Math.PI / 2; plinth.position.z = -.006; plinth.receiveShadow = true; scene.add(plinth);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.ShadowMaterial({ opacity: .14 }));
  floor.position.z = -.011; floor.receiveShadow = true; scene.add(floor);
  const resize = () => { const { width, height } = viewer.getBoundingClientRect(); if (width && height) { renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); } };
  resize(); new ResizeObserver(resize).observe(viewer);
  const rig = await loadRobot({ colors }); scene.add(rig.group); rig.animate(0, { enabled: false });
  let activeParts = attach(rig, selection), enabled = true, dragging = false, inspectUntil = 0, lastReaction = -10;
  let pointer = { x: 0, y: 0, near: 0, active: false }, pointerMovedAt = -Infinity;
  const clock = new THREE.Clock(), robotCenter = new THREE.Vector3();
  const cameraRight = new THREE.Vector3(), cameraUp = new THREE.Vector3(), gaze = new THREE.Vector3();
  const api = {
    rig, renderer, scene, camera, controls, thumbnails: new Map(), thumbnailsPending: 0, behaviorState: null,
    setSelection(next) { dispose(activeParts); activeParts = attach(rig, next); inspectUntil = performance.now() + 1200; },
    setColors(next) { rig.setColors(next); },
    setMotion(next) { enabled = next; },
    trigger(action) { inspectUntil = 0; return rig.trigger(action); },
    resetCamera() { controls.reset(); },
    setLabel(label) { renderer.domElement.setAttribute('aria-label', label); },
  };
  controls.addEventListener('start', () => { dragging = true; rig.setInteraction(true); pointer.active = false; });
  controls.addEventListener('end', () => { dragging = false; rig.setInteraction(false); inspectUntil = performance.now() + 1400; });
  viewer.addEventListener('pointermove', event => {
    if (dragging || event.pointerType === 'touch') return;
    const rect = viewer.getBoundingClientRect(), x = (event.clientX - rect.left) / rect.width * 2 - 1, y = 1 - (event.clientY - rect.top) / rect.height * 2;
    robotCenter.set(0, 0, .145).project(camera);
    const distance = Math.hypot((x - robotCenter.x) * rect.width / rect.height, y - robotCenter.y);
    const near = THREE.MathUtils.clamp(1 - distance / .95, 0, 1);
    cameraRight.setFromMatrixColumn(camera.matrixWorld, 0); cameraUp.setFromMatrixColumn(camera.matrixWorld, 1);
    gaze.set(.35, 0, 0).applyQuaternion(rig.group.quaternion).addScaledVector(cameraRight, (x - robotCenter.x) * .14).addScaledVector(cameraUp, (y - robotCenter.y) * .10).applyQuaternion(rig.group.quaternion.clone().invert());
    pointer = { x, y, near, active: true, yaw: Math.atan2(gaze.y, gaze.x), pitch: -Math.atan2(gaze.z, Math.hypot(gaze.x, gaze.y)) };
    pointerMovedAt = performance.now();
    const now = clock.getElapsedTime();
    if (enabled && near > .65 && now - lastReaction > 5) { lastReaction = now; onReaction(); }
  });
  viewer.addEventListener('pointerleave', () => { pointer = { ...pointer, active: false, near: 0 }; });
  function animate() {
    requestAnimationFrame(animate);
    api.behaviorState = rig.animate(clock.getElapsedTime(), { enabled, pointer: { ...pointer, active: pointer.active && performance.now() - pointerMovedAt < 2400 }, interacting: dragging || performance.now() < inspectUntil });
    controls.update(); renderer.render(scene, camera);
  }
  animate();

  // A separate, neutral rig keeps product photos consistent while the pet plays.
  activeParts.forEach(({ group }) => group.removeFromParent());
  rig.animate(0, { enabled: false });
  const clone = rig.group.clone(true);
  activeParts.forEach(part => rig.anchors.get(part.bodyName).add(part.group));
  const thumbnailRig = { group: clone }, thumbScene = new THREE.Scene(); lights(thumbScene); thumbScene.add(clone);
  const thumbRenderer = rendererFor(true); thumbRenderer.setSize(320, 320);
  const thumbCamera = new THREE.PerspectiveCamera(30, 1, .001, 4); thumbCamera.up.set(0, 0, 1);
  const baseMeshes = []; clone.traverse(mesh => { if (mesh.isMesh) baseMeshes.push(mesh); });
  // Clone robot materials: saving a look with old colors must not recolor the live pet.
  const materialClones = new Map();
  baseMeshes.forEach(mesh => { if (!materialClones.has(mesh.material)) materialClones.set(mesh.material, mesh.material.clone()); mesh.material = materialClones.get(mesh.material); });
  function thumbnail(selection, { item = false, colors: palette = rig.metadata.bodyColors } = {}) {
    for (const mesh of baseMeshes) { mesh.visible = !item; mesh.material.color.set(robotPartColor(mesh.userData.meshFile, palette).color); }
    const parts = attach(thumbnailRig, selection);
    try {
      if (item) {
        clone.updateMatrixWorld(true);
        const bounds = new THREE.Box3(); parts.forEach(({ group }) => bounds.expandByObject(group, true));
        const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
        const distance = Math.max(size.x, size.y, size.z, .02) * 2.65;
        thumbCamera.position.copy(center).add(new THREE.Vector3(.72, -.93, .48).normalize().multiplyScalar(distance)); thumbCamera.lookAt(center);
      } else { thumbCamera.position.set(.48, -.62, .33); thumbCamera.lookAt(0, 0, .148); }
      thumbCamera.updateProjectionMatrix(); thumbRenderer.render(thumbScene, thumbCamera);
      return thumbRenderer.domElement.toDataURL('image/webp', .88);
    } finally { dispose(parts); }
  }
  api.makeThumbnail = thumbnail;
  const queued = new Map(); let working = false;
  api.queueThumbnails = (jobs, onReady) => {
    // Switching categories or dragging a color picker prioritizes what is
    // currently visible, instead of rendering a backlog of discarded views.
    queued.clear();
    for (const job of jobs) {
      if (api.thumbnails.has(job.key)) onReady(job.key, api.thumbnails.get(job.key));
      else queued.set(job.key, { ...job, onReady });
    }
    api.thumbnailsPending = queued.size;
    if (!working) void processQueue();
  };
  async function processQueue() {
    working = true;
    try {
      while (queued.size) {
        await frame();
        const [key, job] = queued.entries().next().value; queued.delete(key);
        const url = thumbnail(job.selection, job.options);
        api.thumbnails.set(key, url);
        if (api.thumbnails.size > 160) api.thumbnails.delete(api.thumbnails.keys().next().value);
        job.onReady(key, url); api.thumbnailsPending = queued.size;
      }
    } finally { working = false; }
  }
  return api;
}
