import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';
import { loadRobot } from '../src/robot.js';
import { OUTFITS, attachOutfitParts, selectedItemIds } from '../src/outfits.js';
import { ACTIONS } from '../src/behavior.js';

const requested = new URLSearchParams(location.search).get('looks');
const lookIds = requested ? requested.split(',') : ['harbour-day', 'butter-walk', 'sunday-linen'];
if (lookIds.length !== 3) throw new Error('The cover needs three complete looks.');
const poses = [
  { action: 'tiny-steps', progress: .23, scale: .90, yaw: -.10 },
  { action: 'greet', progress: .43, scale: 1, yaw: .08 },
  { action: 'hop', progress: .52, scale: .88, yaw: .22 },
];

const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(stage.clientWidth, stage.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
stage.append(renderer.domElement);

const scene = new THREE.Scene();
const environment = new RoomEnvironment();
const pmrem = new THREE.PMREMGenerator(renderer);
const environmentMap = pmrem.fromScene(environment);
scene.environment = environmentMap.texture;
scene.environmentIntensity = .65;
scene.environmentRotation.x = Math.PI / 2;
environment.dispose();
pmrem.dispose();
const ambient = new THREE.HemisphereLight(0xfffaf0, 0xb9c3ad, .8);
ambient.position.set(0, 0, 1);
scene.add(ambient);
const key = new THREE.DirectionalLight(0xfffaf3, 2.6);
key.position.set(.6, -.5, 1.1);
scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, .9);
fill.position.set(-.5, .7, .5);
scene.add(fill);

const models = new THREE.Group();
scene.add(models);
const screenRight = new THREE.Vector3(.68, -.53, 0).normalize();
const ducks = [];
for (const [index, id] of lookIds.entries()) {
  const look = OUTFITS.find(outfit => outfit.id === id);
  if (!look) throw new Error(`Unknown cover look: ${id}`);
  const pose = poses[index];
  const rig = await loadRobot({ colors: look.bodyColors });
  const parts = attachOutfitParts(rig, look.selection);
  rig.animate(0, { enabled: false });
  if (!rig.trigger(pose.action)) throw new Error(`Unknown cover action: ${pose.action}`);
  const action = ACTIONS.find(action => action.id === pose.action);
  const frames = Math.round(action.duration * pose.progress * 60);
  for (let frame = 1; frame <= frames + 1; frame++) rig.animate(frame / 60, { enabled: false });
  const placement = new THREE.Group();
  placement.add(rig.group);
  placement.scale.setScalar(pose.scale);
  placement.rotation.z = pose.yaw;
  placement.position.copy(screenRight).multiplyScalar((index - 1) * .16);
  models.add(placement);
  let robotMeshes = 0;
  rig.group.traverse(object => { if (object.isMesh && object.userData.meshFile) robotMeshes++; });
  ducks.push({ look: look.id, selectedItemIds: selectedItemIds(look.selection), bodyColors: look.bodyColors,
    pose: { ...pose, joints: Object.fromEntries([...rig.joints].map(([name, joint]) => [name, joint.angle])) },
    garmentParts: parts.length, robotMeshes });
}
models.updateMatrixWorld(true);
const bounds = new THREE.Box3().setFromObject(models, true);
const center = bounds.getCenter(new THREE.Vector3());
const size = bounds.getSize(new THREE.Vector3());
const aspect = stage.clientWidth / stage.clientHeight;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .001, 4);
camera.up.set(0, 0, 1);
camera.position.copy(center).add(new THREE.Vector3(.53, .68, .26));
camera.lookAt(center);
camera.updateMatrixWorld(true);
const framing = new THREE.Box3();
models.traverse(mesh => {
  if (!mesh.isMesh) return;
  mesh.geometry.computeBoundingBox();
  framing.union(mesh.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld)));
});
const projectedSize = framing.getSize(new THREE.Vector3()), projectedCenter = framing.getCenter(new THREE.Vector3());
const offset = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(projectedCenter.x)
  .addScaledVector(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1), projectedCenter.y);
camera.position.add(offset);
camera.lookAt(center.clone().add(offset));
const span = Math.max(projectedSize.y * 1.22, projectedSize.x / aspect * 1.12);
Object.assign(camera, { left: -span * aspect / 2, right: span * aspect / 2, top: span / 2, bottom: -span / 2 });
camera.updateProjectionMatrix();

// Render real geometry from above, fading with height, then soften only its
// contact shadow. The robot and type remain sharp; there is no noise texture.
const shadowSpan = Math.max(size.x, size.y) + .08;
const shadowCenter = new THREE.Vector3(center.x, center.y, 0);
const shadowCamera = new THREE.OrthographicCamera(-shadowSpan / 2, shadowSpan / 2, shadowSpan / 2, -shadowSpan / 2, .001, .22);
shadowCamera.position.copy(shadowCenter).add(new THREE.Vector3(0, 0, .22));
shadowCamera.up.set(0, 1, 0);
shadowCamera.lookAt(shadowCenter);
const shadowTarget = new THREE.WebGLRenderTarget(1024, 1024);
const blurTarget = new THREE.WebGLRenderTarget(1024, 1024);
const depth = new THREE.MeshDepthMaterial();
depth.onBeforeCompile = shader => {
  shader.fragmentShader = shader.fragmentShader.replace(
    'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
    'gl_FragColor = vec4( vec3( 0.12, 0.16, 0.13 ), pow( fragCoordZ, 10.0 ) * 0.3 );',
  );
};
scene.overrideMaterial = depth;
renderer.setRenderTarget(shadowTarget);
renderer.render(scene, shadowCamera);
scene.overrideMaterial = null;
const blurScene = new THREE.Scene();
const blurCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const blurQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
blurQuad.frustumCulled = false;
blurScene.add(blurQuad);
const horizontal = new THREE.ShaderMaterial(HorizontalBlurShader);
const vertical = new THREE.ShaderMaterial(VerticalBlurShader);
horizontal.uniforms.h.value = vertical.uniforms.v.value = .0012 / shadowSpan;
for (let pass = 0; pass < 2; pass++) {
  blurQuad.material = horizontal;
  horizontal.uniforms.tDiffuse.value = shadowTarget.texture;
  renderer.setRenderTarget(blurTarget);
  renderer.render(blurScene, blurCamera);
  blurQuad.material = vertical;
  vertical.uniforms.tDiffuse.value = blurTarget.texture;
  renderer.setRenderTarget(shadowTarget);
  renderer.render(blurScene, blurCamera);
}
const floor = new THREE.Mesh(new THREE.PlaneGeometry(shadowSpan, shadowSpan), new THREE.MeshBasicMaterial({ map: shadowTarget.texture, transparent: true, depthWrite: false, toneMapped: false }));
floor.position.copy(shadowCenter);
floor.position.z -= .0001;
scene.add(floor);
renderer.setRenderTarget(null);
renderer.render(scene, camera);
await document.fonts.ready;
await document.getElementById('logo').decode();

window.brandRender = {
  ready: true,
  ducks,
  robotMeshes: ducks.reduce((total, duck) => total + duck.robotMeshes, 0),
  bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
};
