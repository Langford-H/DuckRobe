import { Euler, Matrix3, Matrix4, Quaternion, SRGBColorSpace, Vector3 } from 'three';
import { strToU8, zipSync } from 'fflate';
import { ACCESSORY_REGIONS, SLOT_IDS, createOutfitParts, normalizeSelection, selectedItemIds } from './outfits.js';
import { normalizeRobotColors, robotAssetUrl, robotPartColor } from './robot.js';

const encoder = new TextEncoder();
const slots = SLOT_IDS;
const xmlEscape = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
}[character]));
const number = (value) => Math.abs(value) < 1e-14 ? '0' : Number(value.toPrecision(15)).toString();
const vector = (values) => Array.from(values).map(number).join(' ');
const values = (text, fallback = []) => text ? text.trim().split(/\s+/).map(Number) : fallback;
const children = (element, tag) => Array.from(element?.childNodes || [])
  .filter((child) => child.nodeType === 1 && (!tag || child.tagName === tag));
const first = (element, tag) => children(element, tag)[0];
const attributeMap = (element) => Object.fromEntries(Array.from(element?.attributes || [])
  .map((attribute) => [attribute.name, attribute.value]));

function parseXml(source) {
  if (typeof DOMParser === 'undefined') throw new Error('XML parser is unavailable.');
  const document = new DOMParser().parseFromString(source, 'application/xml');
  if (document.getElementsByTagName('parsererror').length || document.documentElement.tagName !== 'mujoco') {
    throw new Error('Microduck source MJCF is invalid.');
  }
  return document;
}

// MJCF quaternions are w,x,y,z; Three.js uses x,y,z,w. URDF uses fixed-axis RPY.
function orientation(element) {
  if (element.hasAttribute('quat')) {
    const [w, x, y, z] = values(element.getAttribute('quat'));
    return new Quaternion(x, y, z, w).normalize();
  }
  if (element.hasAttribute('euler')) {
    const angles = values(element.getAttribute('euler'));
    return new Quaternion().setFromEuler(new Euler(...angles, 'XYZ'));
  }
  return new Quaternion();
}

function rpy(quaternion) {
  // ZYX intrinsic rotation equals URDF fixed XYZ; XYZ intrinsic would be wrong.
  const rotation = new Euler().setFromQuaternion(quaternion, 'ZYX');
  return vector([rotation.x, rotation.y, rotation.z]);
}

function origin(element, offset = [0, 0, 0]) {
  const position = new Vector3(...values(element.getAttribute('pos'), [0, 0, 0]));
  position.add(new Vector3(...offset).applyQuaternion(orientation(element)));
  return `<origin xyz="${vector(position.toArray())}" rpy="${rpy(orientation(element))}"/>`;
}

function defaultsByClass(root) {
  const defaults = new Map();
  function visit(element, inherited = {}) {
    const defaultsHere = { ...inherited };
    for (const child of children(element).filter((child) => child.tagName !== 'default')) {
      defaultsHere[child.tagName] = { ...inherited[child.tagName], ...attributeMap(child) };
    }
    if (element.hasAttribute('class')) defaults.set(element.getAttribute('class'), defaultsHere);
    for (const child of children(element, 'default')) visit(child, defaultsHere);
  }
  for (const element of children(root, 'default')) visit(element);
  return defaults;
}

function urdfFromMjcf(document, clothing) {
  const root = document.documentElement;
  const classes = defaultsByClass(root);
  const asset = first(root, 'asset');
  const meshes = new Map(children(asset, 'mesh').map((mesh) => [
    mesh.getAttribute('name') || mesh.getAttribute('file').split('/').pop().replace(/\.[^.]+$/, ''), mesh,
  ]));
  const materials = new Map(children(asset, 'material').map((material) => [
    material.getAttribute('name'), values(material.getAttribute('rgba'), [0.8, 0.8, 0.8, 1]),
  ]));
  const actuators = new Map(children(first(root, 'actuator')).map((actuator) => {
    const attributes = { ...classes.get(actuator.getAttribute('class'))?.[actuator.tagName], ...attributeMap(actuator) };
    return [actuator.getAttribute('joint'), attributes];
  }));
  const links = ['  <link name="world"/>'];
  const joints = [];
  const jointManifest = [];
  const name = xmlEscape(root.getAttribute('model') || 'microduck');

  function visit(body, parentName, inheritedClass) {
    const bodyName = body.getAttribute('name');
    if (!bodyName) throw new Error('Cannot export an unnamed robot body.');
    const bodyClass = body.getAttribute('childclass') || inheritedClass;
    const bodyJoints = [...children(body, 'joint'), ...children(body, 'freejoint')];
    if (bodyJoints.length > 1) throw new Error(`Body ${bodyName} has multiple joints; a serial URDF conversion is required.`);
    const joint = bodyJoints[0];
    const jointOffset = joint ? values(joint.getAttribute('pos'), [0, 0, 0]) : [0, 0, 0];
    // URDF joint frames are at their pivots. This additional fixed frame keeps
    // a nonzero MJCF pivot without shifting the body's meshes or inertial tensor.
    const displacedPivot = jointOffset.some((value) => Math.abs(value) > 1e-12);
    const pivotName = displacedPivot ? `${bodyName}__pivot` : bodyName;
    if (displacedPivot) links.push(`  <link name="${xmlEscape(pivotName)}"/>`);

    if (!joint) {
      joints.push(`  <joint name="${xmlEscape(`${parentName}_to_${bodyName}`)}" type="fixed"><parent link="${xmlEscape(parentName)}"/><child link="${xmlEscape(bodyName)}"/>${origin(body)}</joint>`);
    } else {
      const attributes = { ...classes.get(joint.getAttribute('class') || bodyClass)?.joint, ...attributeMap(joint) };
      const sourceType = joint.tagName === 'freejoint' ? 'free' : (attributes.type || 'hinge');
      const range = values(attributes.range);
      const type = ({ free: 'floating', slide: 'prismatic', hinge: range.length ? 'revolute' : 'continuous' })[sourceType];
      if (!type) throw new Error(`Unsupported joint type ${sourceType} in ${bodyName}.`);
      const jointName = attributes.name || `${bodyName}_joint`;
      const actuator = actuators.get(jointName);
      const forceRange = values(actuator?.forcerange);
      const effort = forceRange.length ? Math.max(...forceRange.map(Math.abs)) : 0;
      let jointXml = `  <joint name="${xmlEscape(jointName)}" type="${type}"><parent link="${xmlEscape(parentName)}"/><child link="${xmlEscape(pivotName)}"/>${origin(body, jointOffset)}`;
      if (sourceType !== 'free') {
        const axis = values(attributes.axis, [0, 0, 1]);
        jointXml += `<axis xyz="${vector(axis)}"/>`;
        jointXml += `<limit ${range.length ? `lower="${number(range[0])}" upper="${number(range[1])}" ` : ''}effort="${number(effort)}" velocity="10"/>`;
        jointXml += `<dynamics damping="${number(Number(attributes.damping || 0))}" friction="${number(Number(attributes.frictionloss || 0))}"/>`;
        jointManifest.push({ name: jointName, body: bodyName, type: sourceType, axis, range, effort, velocity: 10, armature: Number(attributes.armature || 0) });
      }
      joints.push(`${jointXml}</joint>`);
      if (displacedPivot) joints.push(`  <joint name="${xmlEscape(`${bodyName}_pivot_to_body`)}" type="fixed"><parent link="${xmlEscape(pivotName)}"/><child link="${xmlEscape(bodyName)}"/><origin xyz="${vector(jointOffset.map((value) => -value))}" rpy="0 0 0"/></joint>`);
    }

    const contents = [];
    const inertial = first(body, 'inertial');
    if (inertial) {
      const full = values(inertial.getAttribute('fullinertia'));
      const diagonal = values(inertial.getAttribute('diaginertia'));
      const tensor = full.length ? full : [...diagonal, 0, 0, 0];
      const [ixx, iyy, izz, ixy, ixz, iyz] = tensor;
      contents.push(`    <inertial>${origin(inertial)}<mass value="${inertial.getAttribute('mass')}"/><inertia ixx="${number(ixx)}" iyy="${number(iyy)}" izz="${number(izz)}" ixy="${number(ixy)}" ixz="${number(ixz)}" iyz="${number(iyz)}"/></inertial>`);
    }
    for (const geom of children(body, 'geom')) {
      const attributes = { ...classes.get(geom.getAttribute('class') || bodyClass)?.geom, ...attributeMap(geom) };
      const mesh = meshes.get(attributes.mesh);
      if (!mesh) throw new Error(`Missing mesh ${attributes.mesh} for URDF conversion.`);
      const isVisual = Number(attributes.group) === 2 || geom.getAttribute('class') === 'visual';
      const kind = isVisual ? 'visual' : 'collision';
      const path = `meshes/${mesh.getAttribute('file')}`;
      const scale = mesh.getAttribute('scale') || '1 1 1';
      const rgba = values(attributes.rgba, materials.get(attributes.material) || [0.8, 0.8, 0.8, 1]);
      contents.push(`    <${kind}>${origin(geom)}<geometry><mesh filename="${xmlEscape(path)}" scale="${xmlEscape(scale)}"/></geometry>${isVisual ? `<material name="${xmlEscape(attributes.material || `${bodyName}_material`)}"><color rgba="${vector(rgba)}"/></material>` : ''}</${kind}>`);
    }
    links.push(`  <link name="${xmlEscape(bodyName)}">\n${contents.join('\n')}\n  </link>`);
    for (const child of children(body, 'body')) visit(child, bodyName, bodyClass);
  }
  for (const body of children(first(root, 'worldbody'), 'body')) visit(body, 'world', null);
  for (const [index, part] of clothing.entries()) {
    const linkName = `duckrobe_${part.slot}_${index}`;
    links.push(`  <link name="${linkName}"><visual><origin xyz="0 0 0" rpy="0 0 0"/><geometry><mesh filename="${part.path}"/></geometry><material name="${part.materialName}"><color rgba="${vector(part.rgba)}"/></material></visual></link>`);
    joints.push(`  <joint name="${linkName}_mount" type="fixed"><parent link="${xmlEscape(part.bodyName)}"/><child link="${linkName}"/><origin xyz="0 0 0" rpy="0 0 0"/></joint>`);
  }
  return {
    xml: `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Metres, radians. Visual clothing is massless. MJCF retains the native actuator model. -->\n<robot name="${name}">\n${links.join('\n')}\n${joints.join('\n')}\n</robot>\n`,
    joints: jointManifest,
  };
}

function materialRgba(material) {
  const color = material.color?.clone();
  if (!color) return [0.8, 0.8, 0.8, 1];
  const rgb = {};
  color.getRGB(rgb, SRGBColorSpace);
  return [rgb.r, rgb.g, rgb.b, material.opacity ?? 1];
}

function objFromMesh(mesh, transform, name, materialName, materialIndex = null, standingBodyMatrix = null) {
  const geometry = mesh.geometry;
  const positions = geometry.getAttribute('position');
  if (!positions) throw new Error(`Clothing mesh ${name} has no vertices.`);
  const index = geometry.getIndex();
  const count = index ? index.count : positions.count;
  const determinant = transform.determinant();
  const lines = [`# DuckRobe visual clothing; metres; body-local coordinates`, 'mtllib ../../materials.mtl', `o ${name}`, `usemtl ${materialName}`];
  const position = new Vector3();
  const worldPosition = new Vector3();
  let standingMinZ = Infinity;
  for (let i = 0; i < positions.count; i += 1) {
    position.fromBufferAttribute(positions, i).applyMatrix4(transform);
    lines.push(`v ${vector(position.toArray())}`);
    if (standingBodyMatrix) {
      worldPosition.copy(position).applyMatrix4(standingBodyMatrix);
      standingMinZ = Math.min(standingMinZ, worldPosition.z);
    }
  }
  const normals = geometry.getAttribute('normal');
  if (normals) {
    const normalMatrix = new Matrix3().getNormalMatrix(transform);
    for (let i = 0; i < normals.count; i += 1) {
      position.fromBufferAttribute(normals, i).applyNormalMatrix(normalMatrix);
      lines.push(`vn ${vector(position.toArray())}`);
    }
  }
  // Split multi-material meshes into per-material OBJ assets so MJCF has the
  // same color boundaries as Three.js. A material applies to the whole geom.
  const groups = materialIndex === null ? [{ start: 0, count }] : geometry.groups.filter((group) => group.materialIndex === materialIndex);
  let faces = 0;
  const a = new Vector3(); const b = new Vector3(); const c = new Vector3();
  for (const group of groups) {
    const end = Math.min(group.start + group.count, count);
    for (let i = group.start; i + 2 < end; i += 3) {
      const indices = [0, 1, 2].map((offset) => (index ? index.getX(i + offset) : i + offset));
      a.fromBufferAttribute(positions, indices[0]);
      b.fromBufferAttribute(positions, indices[1]);
      c.fromBufferAttribute(positions, indices[2]);
      if (b.sub(a).cross(c.sub(a)).lengthSq() < 1e-24) continue;
      if (determinant < 0) [indices[1], indices[2]] = [indices[2], indices[1]];
      lines.push(`f ${indices.map((vertex) => normals ? `${vertex + 1}//${vertex + 1}` : vertex + 1).join(' ')}`);
      faces += 1;
    }
  }
  if (!faces) throw new Error(`Clothing mesh ${name} has no usable triangles.`);
  return { text: `${lines.join('\n')}\n`, vertices: positions.count, triangles: faces, standingMinZ };
}

function anchorDefinition(metadata, bodyName) {
  const definitions = metadata.anchorDefinitions;
  const definition = definitions instanceof Map ? definitions.get(bodyName)
    : Array.isArray(definitions) ? definitions.find((item) => item.bodyName === bodyName)
      : definitions?.[bodyName];
  if (!definition) throw new Error(`The clothing anchor ${bodyName} is missing.`);
  return definition;
}

function anchorMatrix(metadata, bodyName) {
  const definition = anchorDefinition(metadata, bodyName);
  // anchorDefinitions use Three.js quaternion order x,y,z,w.
  const quaternion = new Quaternion(...(definition.localQuaternion || definition.localQuat || [0, 0, 0, 1]));
  return new Matrix4().compose(new Vector3(...(definition.localPosition || [0, 0, 0])), quaternion, new Vector3(1, 1, 1));
}

function clothingMeshes(parts, metadata, files) {
  const clothing = [];
  for (const part of parts) {
    const anchor = anchorMatrix(metadata, part.bodyName);
    let standingBodyMatrix = null;
    if (['ankle_left', 'ankle_right'].includes(part.bodyName)) {
      const definition = anchorDefinition(metadata, part.bodyName);
      if (!definition.defaultWorldPosition) throw new Error(`The standing reference for ${part.bodyName} is missing.`);
      const bodyQuaternion = new Quaternion(...(definition.localQuaternion || definition.localQuat || [0, 0, 0, 1])).invert();
      standingBodyMatrix = new Matrix4().compose(new Vector3(...definition.defaultWorldPosition), bodyQuaternion, new Vector3(1, 1, 1));
    }
    part.group.updateMatrixWorld(true);
    const originalParent = part.group.parent;
    const parentInverse = originalParent ? originalParent.matrixWorld.clone().invert() : new Matrix4();
    part.group.traverse((mesh) => {
      if (!mesh.isMesh || !mesh.visible) return;
      const transform = anchor.clone().multiply(parentInverse).multiply(mesh.matrixWorld);
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const [materialIndex, material] of materials.entries()) {
        if (materials.length > 1 && !mesh.geometry.groups.some((group) => group.materialIndex === materialIndex && group.count > 0)) continue;
        const name = `duckrobe_${part.slot}_${clothing.length.toString().padStart(3, '0')}`;
        const materialName = `${name}_material`;
        const path = `meshes/outfits/${name}.obj`;
        const obj = objFromMesh(mesh, transform, name, materialName, materials.length > 1 ? materialIndex : null, standingBodyMatrix);
        files[path] = encoder.encode(obj.text);
        clothing.push({ slot: part.slot, itemId: part.itemId, ...(part.slot === 'accessory' ? { region: part.region || part.group.userData.region } : {}), detailName: mesh.name, bodyName: part.bodyName, name, path, materialName, rgba: materialRgba(material), vertices: obj.vertices, triangles: obj.triangles,
          ...(standingBodyMatrix ? { standingMinZ: obj.standingMinZ } : {}) });
      }
    });
  }
  return clothing;
}

async function fetchedBytes(url) {
  url = robotAssetUrl(url);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Cannot load export asset ${url}: HTTP ${response.status}.`);
  return new Uint8Array(await response.arrayBuffer());
}

function appendElement(document, parent, name, attributes) {
  const element = document.createElement(name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  parent.appendChild(element);
  return element;
}

/** Build a self-contained ZIP of the native robot and the current mixed outfit. */
export async function buildExportBundle({ robot, selection, outfitName = 'My Microduck', colors, bodyColors, parts, createArchive = true }) {
  if (!robot?.metadata?.native) throw new Error('Microduck robot assets have not loaded yet.');
  const metadata = robot.metadata;
  const normalizedSelection = normalizeSelection(selection);
  const normalizedColors = normalizeRobotColors(bodyColors || colors || metadata.bodyColors);
  const native = metadata.native;
  const sourceBytes = await fetchedBytes(native.xmlUrl);
  const source = new TextDecoder().decode(sourceBytes);
  const document = parseXml(source);
  const root = document.documentElement;
  const compiler = first(root, 'compiler');
  const asset = first(root, 'asset');
  if (!compiler || !asset) throw new Error('Source MJCF requires compiler and asset sections.');
  compiler.setAttribute('meshdir', 'meshes');
  const files = {};
  const meshElements = children(asset, 'mesh');
  // Copy every upstream mesh, including assets currently hidden in the model.
  await Promise.all(meshElements.map(async (mesh) => {
    const sourceFile = mesh.getAttribute('file');
    if (!sourceFile || sourceFile.includes('..')) throw new Error('Invalid native mesh path.');
    const bytes = await fetchedBytes(`${native.meshBaseUrl}${sourceFile}`);
    files[`meshes/robot/${sourceFile}`] = bytes;
    mesh.setAttribute('file', `robot/${sourceFile}`);
  }));
  files['LICENSE-Microduck.txt'] = await fetchedBytes(native.licenseUrl);
  // Match the wardrobe palette without changing collision geometry, upstream
  // material assets, mesh bytes, inertial parameters, or joint definitions.
  const nativeMeshFiles = new Map(meshElements.map((mesh) => {
    const meshFile = mesh.getAttribute('file').slice('robot/'.length);
    const name = mesh.getAttribute('name') || meshFile.split('/').pop().replace(/\.[^.]+$/, '');
    return [name, meshFile];
  }));
  const palette = new Map();
  for (const geom of Array.from(root.getElementsByTagName('geom'))) {
    if (geom.getAttribute('class') !== 'visual') continue;
    const meshFile = nativeMeshFiles.get(geom.getAttribute('mesh'));
    if (!meshFile) continue;
    const { color } = robotPartColor(meshFile, normalizedColors);
    const rgb = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16) / 255);
    const rgba = [...rgb, 1];
    geom.setAttribute('rgba', vector(rgba));
    palette.set(meshFile, rgba);
  }
  const generatedParts = parts || createOutfitParts(normalizedSelection);
  let clothing;
  try {
    for (const part of generatedParts) {
      const region = part.region || part.group.userData.region;
      const selected = part.slot === 'accessory' ? normalizedSelection.accessory[region] : normalizedSelection[part.slot];
      if (part.slot === 'accessory' && !ACCESSORY_REGIONS.includes(region)) throw new Error(`Invalid accessory region ${region}.`);
      if (!slots.includes(part.slot) || !part.itemId || selected !== part.itemId) throw new Error(`Clothing ${part.itemId} does not match the selected ${part.slot}${region ? `/${region}` : ''}.`);
    }
    clothing = clothingMeshes(generatedParts, metadata, files);
  } finally {
    // Export geometries are separate from viewer instances; release them after
    // serialization. Callers supplying parts keep ownership of their objects.
    if (!parts) {
      const disposedGeometries = new Set(); const disposedMaterials = new Set();
      for (const part of generatedParts) part.group.traverse((object) => {
        if (!object.isMesh) return;
        if (!disposedGeometries.has(object.geometry)) { object.geometry.dispose(); disposedGeometries.add(object.geometry); }
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (!disposedMaterials.has(material)) { material.dispose(); disposedMaterials.add(material); }
        }
      });
    }
  }
  // Generate URDF before adding MJCF clothing geoms so each garment has exactly
  // one massless fixed-link representation in URDF.
  const urdf = urdfFromMjcf(document, clothing);
  files['microduck.urdf'] = encoder.encode(urdf.xml);
  const bodies = new Map(Array.from(root.getElementsByTagName('body')).map((body) => [body.getAttribute('name'), body]));
  for (const part of clothing) {
    const body = bodies.get(part.bodyName);
    if (!body) throw new Error(`Clothing references unknown body ${part.bodyName}.`);
    appendElement(document, asset, 'mesh', { name: part.name, file: part.path.slice('meshes/'.length), inertia: 'shell' });
    appendElement(document, asset, 'material', { name: part.materialName, rgba: vector(part.rgba) });
    appendElement(document, body, 'geom', {
      name: part.name, type: 'mesh', mesh: part.name, material: part.materialName,
      pos: '0 0 0', quat: '1 0 0 0', contype: '0', conaffinity: '0', group: '2', mass: '0', density: '0',
    });
  }
  // Preserve the model's native zero reference, while providing an optional
  // keyframe to reproduce the wardrobe's standing pose in MuJoCo.
  const rootBody = children(first(root, 'worldbody'), 'body')[0];
  let previewRootPose = null;
  const shoeMinZ = Math.min(...clothing.filter((part) => part.standingMinZ !== undefined).map((part) => part.standingMinZ));
  const previewGroundAdjustment = Number.isFinite(shoeMinZ) ? Math.max(0, -(shoeMinZ + (metadata.groundOffset || 0))) : 0;
  if (rootBody && first(rootBody, 'freejoint') && metadata.defaultPose) {
    const rootPosition = values(rootBody.getAttribute('pos'), [0, 0, 0]);
    rootPosition[2] += (metadata.groundOffset || 0) + previewGroundAdjustment;
    const rootOrientation = orientation(rootBody);
    previewRootPose = { position: rootPosition, quaternion: [rootOrientation.w, rootOrientation.x, rootOrientation.y, rootOrientation.z], quaternionOrder: 'wxyz' };
    const keyframe = first(root, 'keyframe') || appendElement(document, root, 'keyframe', {});
    appendElement(document, keyframe, 'key', {
      name: 'duckrobe_preview',
      qpos: vector([...rootPosition, rootOrientation.w, rootOrientation.x, rootOrientation.y, rootOrientation.z,
        ...urdf.joints.map((joint) => metadata.defaultPose[joint.name] || 0)]),
    });
  }
  if (typeof XMLSerializer === 'undefined') throw new Error('XML serializer is unavailable.');
  files['microduck.xml'] = encoder.encode(new XMLSerializer().serializeToString(document));
  files['materials.mtl'] = encoder.encode(clothing.map((part) => `newmtl ${part.materialName}\nKd ${vector(part.rgba.slice(0, 3))}\nd ${number(part.rgba[3])}\n`).join('\n'));
  const manifest = {
    formatVersion: 3, name: outfitName, selection: normalizedSelection, bodyColors: normalizedColors,
    wardrobeSlots: slots, accessoryRegions: ACCESSORY_REGIONS, selectedItemIds: selectedItemIds(normalizedSelection), units: { length: 'metre', angle: 'radian' },
    formats: { urdf: 'microduck.urdf', mjcf: 'microduck.xml' },
    previewKeyframe: 'duckrobe_preview',
    previewJointPositions: metadata.defaultPose,
    previewRootPose,
    previewGroundAdjustment,
    visualPaletteOverrides: Array.from(palette, ([meshFile, rgba]) => ({ meshFile, rgba })),
    nativeSource: native, rendererSources: metadata.sources || metadata.web,
    dynamics: {
      clothing: 'visual-only: zero mass, no contacts, fixed to native bodies',
      mjcf: 'native inertials, joint defaults, contacts, sensors, actuator definitions and equality constraints preserved',
      urdf: 'native kinematics, masses, full inertia tensors, axes, ranges and damping/friction; massless fixed clothing links',
      urdfVelocityLimit: '10 rad/s is an export convention because source MJCF does not specify velocity limits; not a hardware specification',
      urdfLimitations: ['URDF cannot represent MuJoCo actuator gains, joint armature, sensors or contact masks; use the included MJCF for native simulation'],
    },
    appearance: {
      clothing: 'Geometry, vertex normals, base colors and opacity match the selected items. Procedural weave shaders and texture maps are not baked into OBJ.',
      body: 'Shell and accent colors use the same normalized palette as the web preview. Collision materials retain upstream values.',
    },
    joints: urdf.joints, clothing,
    files: [...Object.keys(files), 'manifest.json', 'README.md'].sort(),
  };
  files['manifest.json'] = encoder.encode(`${JSON.stringify(manifest, null, 2)}\n`);
  files['README.md'] = strToU8(`# ${outfitName}\n\nOpen \`microduck.xml\` in MuJoCo or \`microduck.urdf\` in your URDF viewer. Keep the extracted directory structure: all mesh paths are relative. Lengths are metres and angles are radians.\n\nThe robot is based on the pinned official Microduck assets described in \`manifest.json\`. Original assets retain the license in \`LICENSE-Microduck.txt\`. Native visual colors use the same DuckRobe palette as the web preview, recorded in \`visualPaletteOverrides\`; source meshes and physical parameters are unchanged. The selected shell and accent colors are saved in \`bodyColors\`. The visible outfit is original DuckRobe geometry, attached to the native robot bodies with zero mass and no collision. It is a visual accessory, not a cloth physics model or a fabrication-ready garment.\n\nMJCF retains upstream inertials, joints, actuator settings and sensors. URDF retains the kinematic hierarchy (including the floating root), inertia tensors, axes, ranges, damping and friction, plus massless fixed clothing links. Native actuator force limits become URDF effort limits. The source does not define velocity limits; the required URDF velocity fields use an explicit 10 rad/s convention, not a hardware rating. MuJoCo-specific actuator gains, armature, sensors and contact masks remain in MJCF.\n\nFor the wardrobe standing pose, load the MJCF keyframe named \`duckrobe_preview\`:\n\n\`\`\`python\nimport mujoco\nmodel = mujoco.MjModel.from_xml_path('microduck.xml')\ndata = mujoco.MjData(model)\nkey = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_KEY, 'duckrobe_preview')\nmujoco.mj_resetDataKeyframe(model, data, key)\nmujoco.mj_forward(model, data)\n\`\`\`\n\nFor URDF, apply \`previewJointPositions\` and \`previewRootPose\` from \`manifest.json\` to show the same standing pose. The root pose is world-space, with the quaternion order recorded in the manifest. URDF joint origins retain the official CAD zero reference.\n\nThree.js clothing transforms, including chest pins fitted 2 mm outside the actual garment surface and the same side/back garment-envelope clearance used in the web preview, are flattened into body-local OBJ geometry using stable anchors calibrated in the default standing pose. Web dancing and rotation offsets are not baked into the robot. \`selection\` in the manifest records independent hat, eyewear, body and legwear item IDs plus accessory IDs in three regions: chest, side and back. Each region holds at most one item; all three may be worn together. Null means removed. Format version 3 records each accessory mesh with its region and itemId. Legacy scalar accessory selections are normalized into the appropriate region. Eyewear has one rim and one lens aligned to the single camera. Legwear can be mounted to multiple native bodies, so shoes follow the actual ankle joints. The body shell and accent colors are recorded separately in \`bodyColors\`. Geometry, normals and base colors are exported; procedural fabric weave shaders and texture maps are not baked into OBJ.\n`);
  const filename = `duckrobe-${String(outfitName).replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-|-$/g, '') || 'microduck'}.zip`;
  return { files, bytes: createArchive ? zipSync(files, { level: 6 }) : null, filename, manifest };
}

/** The default export always downloads both URDF and MJCF in one ZIP. */
export async function exportLook(options) {
  const bundle = await buildExportBundle({ ...options, createArchive: true });
  const blob = new Blob([bundle.bytes], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url; link.download = bundle.filename;
  window.document.body.append(link); link.click(); link.remove();
  // Keep the object URL alive long enough for the browser's download handoff.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return bundle;
}
