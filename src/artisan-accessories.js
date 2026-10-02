import * as THREE from 'three';
import { PI, mat, add, ellipsoid, tube as openTube, disk, softBox, facePatch } from './garment-primitives.js';

export const ARTISAN_KINDS = new Set([
  'lotus-brooch', 'orbit-brooch', 'instant-camera', 'aviator-satchel',
  'acorn-purse', 'picnic-hamper', 'music-box', 'maps-case',
]);

// Stitches and handles have sealed ends, so their complete solids survive
// export and can participate in containment checks just like the larger parts.
function tube(g, material, points, radius = .0006, name = 'seam', segments = 24, closed = false) {
  const mesh = openTube(g, material, points, radius, name, segments, closed);
  mesh.userData.expectedClosedSolid = true;
  if (closed) return mesh;
  const geometry = mesh.geometry, position = geometry.getAttribute('position');
  const vertices = [...position.array, ...points[0], ...points.at(-1)];
  const indices = [...geometry.index.array], firstCenter = position.count, lastCenter = firstCenter + 1;
  const radial = geometry.parameters.radialSegments, lastRing = segments * (radial + 1);
  for (let i = 0; i < radial; i++) indices.push(firstCenter, i, i + 1, lastCenter, lastRing + i + 1, lastRing + i);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  const uv = geometry.getAttribute('uv');
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([...uv.array, .5, .5, .5, .5], 2));
  geometry.setIndex(indices);
  // TubeGeometry's original normals do not include the new cap centres.
  geometry.deleteAttribute('normal'); geometry.computeVertexNormals();
  return mesh;
}

// Local metres: +X is the outward face, Y is lateral, +Z is up. The caller
// applies the stable native anchor and the same fit translation for OBJ export.
// Every curved panel has two faces and closed edges; none relies on a sprite.
function thickPanel(g, material, sample, name, rows = 12, columns = 8, wrapsColumns = false) {
  const vertices = [], indices = [], n = columns + 1, layerSize = (rows + 1) * n;
  for (let layer = 0; layer < 2; layer++) {
    for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
      vertices.push(...sample(row / rows, col / columns, layer));
    }
  }
  for (let layer = 0; layer < 2; layer++) {
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      const a = layer * layerSize + row * n + col, b = a + n;
      indices.push(...(layer ? [a, b, a + 1, a + 1, b, b + 1] : [a, a + 1, b, a + 1, b + 1, b]));
    }
  }
  for (const row of [0, rows]) for (let col = 0; col < columns; col++) {
    const a = row * n + col;
    indices.push(...(row === 0 ? [a, a + layerSize, a + 1, a + 1, a + layerSize, a + layerSize + 1] : [a, a + 1, a + layerSize, a + 1, a + layerSize + 1, a + layerSize]));
  }
  if (!wrapsColumns) for (const col of [0, columns]) for (let row = 0; row < rows; row++) {
    const a = row * n + col, b = a + n;
    indices.push(...(col === 0 ? [a, b, a + layerSize, b, b + layerSize, a + layerSize] : [a, a + layerSize, b, b, a + layerSize, b + layerSize]));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const mesh = add(g, geometry, material, [0, 0, 0], [0, 0, 0], [1, 1, 1], name);
  mesh.userData.expectedClosedSolid = true;
  return mesh;
}

function rim(g, material, center, ry, rz, radius, name, tilt = 0) {
  return tube(g, material, Array.from({ length: 64 }, (_, i) => {
    const t = i * PI / 32, y = ry * Math.cos(t), z = rz * Math.sin(t);
    return [center[0] + Math.sin(tilt) * z, center[1] + y, center[2] + Math.cos(tilt) * z];
  }), radius, name, 64, true);
}

function stitch(g, material, x, halfWidth, top, bottom, name) {
  const points = [[x, -halfWidth, top], [x, -halfWidth, bottom + .002], [x, 0, bottom], [x, halfWidth, bottom + .002], [x, halfWidth, top]];
  tube(g, material, points, .00023, name, 32);
}

function pin(g, metal, width = .012) {
  softBox(g, metal, [-.001, 0, -.002], [.001, width, .003], .0006, 'concealed-body-pin');
  for (const y of [-width * .35, width * .35]) disk(g, metal, [-.0015, y, -.002], .0011, .0006, 'pin-rivet');
}

function keeper(g, leather, metal, z = .014) {
  // Short body keeper. Its path stays beside the bag and below the collar.
  tube(g, leather, [[-.003, .010, z - .004], [-.004, .012, z + .002], [-.0045, .012, z + .008]], .00075, 'short-side-keeper', 18);
  softBox(g, leather, [-.0045, .012, z + .009], [.002, .004, .004], .0005, 'side-keeper-tab');
  disk(g, metal, [-.0032, .012, z + .009], .0009, .0007, 'keeper-brass-rivet');
}

function lotus(g, [a, b, c], metal) {
  pin(g, metal, .012);
  const makePetal = (angle, length, width, height, color, name) => {
    const sample = (t, u, layer) => {
      const across = (u * 2 - 1) * (.00016 + width * Math.sin(PI * t) ** .8);
      const along = .001 + length * t;
      return [height + .003 * Math.sin(PI * t) + .0006 * across * across / (width * width) - layer * .00045,
        (Math.sin(angle) * along + Math.cos(angle) * across) * .90,
        -.007 + Math.cos(angle) * along - Math.sin(angle) * across];
    };
    thickPanel(g, color, sample, name, 18, 10);
    tube(g, c, Array.from({ length: 15 }, (_, i) => { const p = sample(.10 + i / 14 * .78, .5, 0); p[0] += .00018; return p; }), .00015, 'lotus-petal-vein', 24);
    for (const side of [.15, .85]) tube(g, c, Array.from({ length: 10 }, (_, i) => {
      const t = .2 + i / 9 * .5, p = sample(t, .5 + (side - .5) * Math.sin(PI * t), 0); p[0] += .00016; return p;
    }), .00011, 'fine-petal-vein', 16);
  };
  for (const angle of [-1.12, -.57, 0, .57, 1.12]) makePetal(angle, .016, .0034, .0013, a, 'outer-curved-lotus-petal');
  for (const angle of [-1.65, 1.65]) makePetal(angle, .0105, .0035, .0022, b, 'lotus-bowl-petal');
  for (const angle of [-.43, 0, .43]) makePetal(angle, .011, .0030, .0035, b, 'inner-curved-lotus-petal');
  for (let i = 0; i < 5; i++) ellipsoid(g, metal, [.0056, (i - 2) * .0012, -.0058 + Math.sin(i * .9) * .0006], [.00065, .00065, .0008], 'lotus-seed-setting');
}

function orbit(g, [a, b, c], metal) {
  pin(g, metal, .011);
  const opal = mat('#e8eadf', { roughness: .23, metalness: .16 });
  ellipsoid(g, opal, [.0034, 0, 0], [.0031, .0045, .0062], 'single-opal-cabochon');
  rim(g, c, [.0024, 0, 0], .0050, .0068, .00042, 'opal-bezel');
  rim(g, metal, [.0034, 0, 0], .0108, .0115, .00043, 'tilted-outer-orbit', .31);
  const crossed = rim(g, b, [.0038, 0, 0], .0088, .0099, .00048, 'crossed-inner-orbit', -.39);
  crossed.rotation.x = .67;
  ellipsoid(g, a, [.0065, -.0100, .0044], [.0017, .0017, .0017], 'small-orbit-satellite');
  for (const side of [-1, 1]) tube(g, metal, [[.0040, side * .0037, -.0050], [.0055, side * .0041, -.0038]], .0004, 'opal-setting-prong', 8);
}

function camera(g, [a, b, c], metal, dark, paper) {
  pin(g, metal, .015);
  softBox(g, a, [.0030, 0, .002], [.007, .026, .020], .003, 'rounded-instant-camera');
  softBox(g, b, [.0070, 0, .0065], [.0011, .025, .008], .0017, 'camera-enamel-shoulder');
  softBox(g, c, [.0072, 0, -.0037], [.0012, .025, .007], .0014, 'camera-textured-grip');
  disk(g, c, [.0077, -.0032, .0022], .006, .0020, 'single-instant-lens-barrel');
  disk(g, metal, [.0090, -.0032, .0022], .0050, .0007, 'lens-brass-rim');
  disk(g, dark, [.0095, -.0032, .0022], .0041, .0005, 'single-camera-lens');
  ellipsoid(g, mat('#849b9a', { roughness: .12, metalness: .35 }), [.00965, -.0044, .0035], [.0003, .0011, .0009], 'lens-reflection');
  softBox(g, dark, [.0079, .0087, .0084], [.0008, .0037, .0028], .0005, 'camera-viewfinder');
  softBox(g, paper, [.0082, -.0088, .0088], [.0006, .0025, .0030], .0004, 'small-camera-flash');
  disk(g, metal, [.0028, .0083, .0127], .0017, .0013, 'instant-camera-shutter', 'z');
  softBox(g, dark, [.0077, 0, -.0066], [.0007, .0195, .0015], .0005, 'real-photo-eject-slot');
  softBox(g, paper, [.0078, 0, -.0106], [.00045, .0175, .0067], .00025, 'emerging-instant-print');
  softBox(g, b, [.0082, 0, -.0100], [.00025, .0140, .0041], .0002, 'print-picture-area');
  tube(g, c, [[-.0010, -.0125, .003], [-.0010, -.0130, .008], [.0007, -.0119, .0105]], .0006, 'short-camera-keeper', 14);
}

function satchel(g, [a, b, c], metal) {
  softBox(g, a, [.0025, 0, -.004], [.014, .0265, .029], .0042, 'satchel-leather-body');
  softBox(g, b, [.0026, 0, .0104], [.011, .023, .002], .0008, 'satchel-mouth-lining');
  for (const side of [-1, 1]) {
    const sample = (t, u, layer) => [
      -.0038 + .0123 * (side === 1 ? 1 - u : u),
      side * (.0130 + .0010 * Math.sin(PI * u) * Math.sin(PI * t) - layer * .00065),
      -.017 + .0275 * t,
    ];
    thickPanel(g, b, sample, 'curved-leather-gusset', 12, 8);
    tube(g, c, [[-.0033, side * .0136, .008], [-.0033, side * .0136, -.012], [.0025, side * .0138, -.016], [.0088, side * .0136, -.012], [.0088, side * .0136, .008]], .00023, 'gusset-saddle-stitch', 28);
  }
  const flap = (t, u, layer) => {
    const y = (1 - u * 2) * .0123;
    return [.0020 + .0090 * Math.sin(t * PI / 2) - layer * .0008,
      y, .0120 - .0155 * t - .0020 * Math.sin(PI * u) * t];
  };
  thickPanel(g, b, flap, 'folded-satchel-flap', 18, 12);
  tube(g, c, Array.from({ length: 21 }, (_, i) => { const p = flap(.97, i / 20, 0); p[0] += .0002; return p; }), .00024, 'flap-fine-topstitch', 32);
  softBox(g, c, [.0116, 0, -.0020], [.0010, .0042, .0120], .0007, 'satchel-fastening-strap');
  rim(g, metal, [.0123, 0, -.0052], .0025, .0032, .00045, 'brass-satchel-buckle');
  tube(g, metal, [[.0125, 0, -.0057], [.0125, 0, -.0026]], .00032, 'buckle-tongue', 6);
  stitch(g, c, .0101, .0114, -.006, -.0161, 'satchel-front-stitch');
  tube(g, c, [[.0012, -.007, .012], [.0012, -.0065, .019], [.0012, .0065, .019], [.0012, .007, .012]], .0009, 'satchel-top-handle', 24);
  keeper(g, c, metal, .012);
}

function acorn(g, [a, b, c], metal) {
  const profile = [[0, -.017], [.0032, -.0150], [.0076, -.0100], [.0105, -.002], [.0112, .005], [.0098, .011], [0, .012]];
  const purse = add(g, new THREE.LatheGeometry(profile.map(([r, z]) => new THREE.Vector2(r, z)), 48), a, [.002, 0, -.003], [PI / 2, 0, 0], [.68, 1, 1], 'shaped-acorn-leather-purse');
  purse.userData.expectedClosedSolid = true;
  // A lined, domed cap with real staggered scales, rather than a sphere cap.
  const capRadius = t => .0119 * Math.cos(t * PI / 2) + .0005;
  const cap = (t, u, layer) => {
    const theta = u * PI * 2, r = Math.max(.00012, capRadius(t) - layer * .0007);
    return [.002 + r * .68 * Math.cos(theta), r * Math.sin(theta), .0065 + .0113 * Math.sin(t * PI / 2) - layer * .0004];
  };
  thickPanel(g, b, cap, 'lined-domed-acorn-cap', 14, 48, true);
  for (let row = 0; row < 4; row++) {
    const count = 16 - row * 3;
    for (let i = 0; i < count; i++) {
      const theta = (i + row % 2 * .5) / count * PI * 2;
      const scale = (t, u, layer) => {
        const band = .06 + row * .185 + t * .235;
        const angle = theta + (u * 2 - 1) * PI / count * (.20 + .80 * Math.sin(PI * t) ** .55);
        const r = capRadius(band) + .00065 * Math.sin(PI * t) - layer * .00035;
        return [.002 + r * .68 * Math.cos(angle), r * Math.sin(angle), .0066 + .0113 * Math.sin(band * PI / 2)];
      };
      thickPanel(g, (i + row) % 3 ? b : c, scale, 'staggered-acorn-cap-scale', 8, 6);
    }
  }
  tube(g, c, [[.0017, 0, .0175], [.0018, -.001, .0215], [.0023, .0012, .0230]], .0010, 'small-acorn-stem', 14);
  const leaf = (t, u, layer) => {
    const w = (1 - u * 2) * (.00010 + .0032 * Math.sin(PI * t));
    return [.0100 + .0013 * Math.sin(PI * t) - layer * .00045, -.0014 + w + t * .0026, .0082 - t * .010];
  };
  thickPanel(g, c, leaf, 'curved-leaf-clasp', 16, 8);
  tube(g, metal, Array.from({ length: 12 }, (_, i) => { const p = leaf(i / 11, .5, 0); p[0] += .00018; return p; }), .00022, 'leaf-clasp-vein', 18);
  keeper(g, c, metal, .010);
}

function basketWall(g, material) {
  const vertices = [], indices = [], segments = 64, rows = 5, n = segments + 1;
  for (let layer = 0; layer < 2; layer++) for (let j = 0; j < rows; j++) for (let i = 0; i <= segments; i++) {
    const t = i / segments * PI * 2, z = -.012 + j / (rows - 1) * .022;
    const fullness = .90 + .10 * j / (rows - 1), rx = .0075 * fullness - layer * .0010, ry = .0128 * fullness - layer * .0010;
    vertices.push(rx * Math.cos(t), ry * Math.sin(t), z);
  }
  const inside = rows * n;
  for (let layer = 0; layer < 2; layer++) for (let j = 0; j < rows - 1; j++) for (let i = 0; i < segments; i++) {
    const a = layer * inside + j * n + i, b = a + n; indices.push(...(layer ? [a, b, a + 1, a + 1, b, b + 1] : [a, a + 1, b, a + 1, b + 1, b]));
  }
  for (const j of [0, rows - 1]) for (let i = 0; i < segments; i++) {
    const a = j * n + i;
    indices.push(...(j === 0 ? [a, a + inside, a + 1, a + 1, a + inside, a + inside + 1] : [a, a + 1, a + inside, a + 1, a + inside + 1, a + inside]));
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  const mesh = add(g, geometry, material, [0, 0, 0], [0, 0, 0], [1, 1, 1], 'hollow-wicker-basket-wall');
  mesh.userData.expectedClosedSolid = true;
}

function picnic(g, [a, b, c], metal, dark, paper) {
  basketWall(g, a);
  const bottom = disk(g, b, [0, 0, -.0120], .0115, .0015, 'woven-basket-bottom', 'z'); bottom.scale.x = .58;
  const count = 32;
  for (let i = 0; i < count; i++) {
    const theta = i / count * PI * 2;
    tube(g, i % 3 ? b : c, Array.from({ length: 23 }, (_, k) => {
      const t = k / 22, f = .90 + .10 * t, wave = Math.cos(t * PI * 12 + i * PI) * .00035;
      return [(.0075 * f + .0004 + wave) * Math.cos(theta), (.0128 * f + .0004 + wave) * Math.sin(theta), -.0118 + .0217 * t];
    }), .00035, 'interleaved-vertical-wicker', 32);
  }
  for (let row = 0; row < 7; row++) {
    const z = -.0108 + row * .0030, f = .90 + .10 * (z + .012) / .022;
    tube(g, row % 2 ? a : b, Array.from({ length: 96 }, (_, i) => {
      const theta = i / 96 * PI * 2, wave = Math.cos(theta * count / 2 + row * PI) * .00035;
      return [(.0075 * f + .00065 + wave) * Math.cos(theta), (.0128 * f + .00065 + wave) * Math.sin(theta), z];
    }), .00037, 'interleaved-horizontal-wicker', 96, true);
  }
  tube(g, paper, Array.from({ length: 64 }, (_, i) => { const t = i / 64 * PI * 2; return [.0072 * Math.cos(t), .0126 * Math.sin(t), .0100 + .0004 * Math.cos(t * 8)]; }), .0009, 'rolled-cotton-basket-lining', 64, true);
  for (let i = 0; i < 10; i++) {
    const t = i / 10 * PI * 2;
    softBox(g, c, [.0073 * Math.cos(t), .0125 * Math.sin(t), .0103], [.0006, .0014, .0012], .0002, 'lining-gingham-check');
  }
  const lid = (t, u, layer) => {
    const x = -.0074 + t * .0148, y = (1 - u * 2) * (.0120 + .0006 * Math.sin(PI * t));
    return [x, y, .0114 + .0010 * Math.sin(PI * t) * Math.sin(PI * u) + (x + .0074) * .22 - layer * .0012];
  };
  thickPanel(g, b, lid, 'slightly-open-woven-basket-lid', 16, 16);
  for (let i = 1; i < 9; i++) tube(g, a, Array.from({ length: 17 }, (_, j) => { const p = lid(j / 16, i / 9, 0); p[2] += .00025; return p; }), .00024, 'lid-woven-grain', 24);
  for (const y of [-.007, .007]) tube(g, metal, [[-.0075, y, .0088], [-.0078, y, .0115]], .0007, 'basket-lid-hinge', 8);
  tube(g, c, [[0, -.0115, .009], [0, -.0129, .024], [0, 0, .030], [0, .0129, .024], [0, .0115, .009]], .0011, 'arched-leather-basket-handle', 40);
  softBox(g, c, [.0082, 0, .0087], [.0010, .004, .008], .0008, 'hamper-lid-tab'); disk(g, metal, [.0090, 0, .009], .0013, .0007, 'hamper-brass-lock');
  keeper(g, c, metal, .010);
}

function musicBox(g, [a, b, c], metal, dark) {
  const wood = mat(a.color, { roughness: .66 });
  for (const x of [-.0061, .0061]) softBox(g, wood, [x, 0, -.0040], [.0016, .024, .017], .0008, x < 0 ? 'music-box-back-wall' : 'music-box-front-wall');
  for (const y of [-.0114, .0114]) softBox(g, wood, [0, y, -.0040], [.0112, .0016, .017], .0006, 'music-box-side-wall');
  softBox(g, wood, [0, 0, -.0122], [.0122, .024, .0018], .0007, 'music-box-floor');
  softBox(g, b, [0, 0, -.0108], [.0096, .0208, .0009], .0004, 'velvet-music-box-lining');
  for (let i = 0; i < 5; i++) tube(g, c, [[.0071, -.0103, -.010 + i * .003], [.0072, -.003, -.0095 + i * .003], [.0071, .0103, -.010 + i * .003]], .00013, 'fine-wood-grain', 24);
  add(g, new THREE.CylinderGeometry(.0032, .0032, .0138, 32), metal, [-.0008, 0, -.0041], [0, 0, 0], [1, 1, 1], 'music-box-pinned-brass-cylinder');
  for (let i = 0; i < 12; i++) {
    const angle = (i % 4) * .44, y = -.0058 + i * .00105;
    ellipsoid(g, metal, [-.0008 + Math.sin(angle) * .0033, y, -.0041 + Math.cos(angle) * .0033], [.00030, .00025, .0004], 'cylinder-melody-pin');
  }
  for (let i = 0; i < 11; i++) softBox(g, metal, [.0025, -.0058 + i * .00115, -.0028], [.0034, .00065, .0005], .00015, 'individual-music-comb-tooth');
  for (const y of [-.008, .008]) add(g, new THREE.CylinderGeometry(.0021, .0021, .0013, 24), metal, [-.0008, y, -.0041], [0, 0, 0], [1, 1, 1], 'cylinder-journal');
  const lid = new THREE.Group(); lid.name = 'hinged-music-box-lid'; lid.position.set(-.0068, 0, .0046); lid.rotation.y = -.62; g.add(lid);
  softBox(lid, wood, [.0063, 0, 0], [.0130, .0245, .0017], .0010, 'wooden-music-box-lid');
  softBox(lid, b, [.0063, 0, -.0011], [.0106, .0213, .00055], .0006, 'lid-inner-velvet');
  for (const y of [-.007, .007]) tube(g, metal, [[-.0069, y - .0018, .0047], [-.0069, y + .0018, .0047]], .00065, 'small-brass-lid-hinge', 8);
  disk(g, metal, [.0081, -.0059, -.0046], .0018, .0018, 'music-box-key-hub');
  rim(g, metal, [.0095, -.0084, -.0046], .0022, .0017, .00043, 'brass-key-first-loop');
  rim(g, metal, [.0095, -.0034, -.0046], .0022, .0017, .00043, 'brass-key-second-loop');
  tube(g, metal, [[.0097, -.0060, -.0060], [.0097, -.0060, -.0032]], .00035, 'key-center-bridge', 8);
  disk(g, c, [.0072, .0058, -.0048], .0010, .0006, 'inlaid-musical-note');
  tube(g, dark, [[.0075, .0065, -.0045], [.0075, .0065, .0002], [.0075, .0088, -.0003]], .00022, 'inlaid-note-stem', 12);
  keeper(g, c, metal, .006);
}

function mapCase(g, [a, b, c], metal, dark, paper) {
  softBox(g, a, [.0014, 0, -.0050], [.0108, .025, .0250], .0025, 'leather-map-case');
  softBox(g, b, [.0008, 0, .0072], [.0088, .0225, .0015], .0007, 'case-mouth-bound-lining');
  const foldedX = y => .0052 + .0020 * Math.abs(Math.sin((y + .0114) / .0076 * PI));
  for (let panel = 0; panel < 3; panel++) {
    const y0 = -.0114 + panel * .0076;
    const sample = (t, u, layer) => {
      const y = y0 + u * .0076;
      return [foldedX(y) - layer * .00045, y, .0045 + t * (.0178 + .0007 * Math.sin(panel * 1.6))];
    };
    thickPanel(g, paper, sample, 'real-folded-map-paper', 8, 12);
    tube(g, c, Array.from({ length: 18 }, (_, i) => { const y = y0 + .0038; return [foldedX(y) + .00008, y, .005 + i / 17 * .0167]; }), .00010, 'map-fold-rule', 20);
  }
  for (let contour = 0; contour < 7; contour++) {
    const points = Array.from({ length: 43 }, (_, i) => {
      const y = -.0107 + i / 42 * .0214;
      const z = .0096 + contour * .0016 + .00065 * Math.sin(i / 42 * PI * 3 + contour * .47) + .00034 * Math.cos(i / 42 * PI * 7);
      return [foldedX(y) + .00020, y, z];
    });
    tube(g, contour % 3 ? b : c, points, .00013, 'hand-drawn-map-contour', 64);
  }
  tube(g, c, Array.from({ length: 28 }, (_, i) => {
    const y = -.0098 + i / 27 * .0196, z = .0108 + i / 27 * .0081 + Math.sin(i / 27 * PI * 3) * .0006;
    return [foldedX(y) + .00030, y, z];
  }), .00025, 'map-walking-trail', 40);
  facePatch(g, b, [[-.012, .005], [.012, .005], [.011, -.003], [0, -.007], [-.011, -.003]], .0074, .0009, 'fold-over-map-case-flap');
  stitch(g, c, .0089, .0104, .0035, -.0147, 'map-case-saddle-stitch');
  disk(g, metal, [.0090, 0, -.0047], .0015, .0010, 'map-case-flap-snap');
  disk(g, metal, [.0090, .0070, -.0118], .0031, .0010, 'tiny-compass-setting');
  disk(g, paper, [.0097, .0070, -.0118], .0025, .0006, 'compass-ivory-face');
  facePatch(g, c, [[.0070, -.0097], [.0078, -.0119], [.0070, -.0134], [.0063, -.0117]], .0101, .00035, 'compass-point');
  keeper(g, c, metal, .008);
}

export function createArtisanAccessory(item) {
  if (!ARTISAN_KINDS.has(item.kind)) throw new Error(`Unknown artisan accessory: ${item.kind}`);
  const g = new THREE.Group(), palette = item.palette.map(color => mat(color));
  const metal = mat('#baa679', { metalness: .62, roughness: .36 });
  const dark = mat('#344047', { roughness: .30 });
  const paper = mat('#eee5d1', { roughness: .93 });
  const builders = {
    'lotus-brooch': lotus, 'orbit-brooch': orbit, 'instant-camera': camera,
    'aviator-satchel': satchel, 'acorn-purse': acorn, 'picnic-hamper': picnic,
    'music-box': musicBox, 'maps-case': mapCase,
  };
  builders[item.kind](g, palette, metal, dark, paper);
  g.userData.artisanGeometry = true;
  return g;
}
