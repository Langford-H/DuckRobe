import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { OUTFITS, ITEMS, THEMES, SLOT_IDS, ACCESSORY_REGIONS, createOutfitParts, selectedItemIds, normalizeSelection } from '../src/outfits.js';

const output = path.resolve(process.env.DUCKROBE_QA_OUTPUT || 'test-results');
const byId = new Map(ITEMS.map(item => [item.id, item]));
assert.equal(OUTFITS.length, 100);
assert.equal(THEMES.length, 10);
assert.equal(new Set(OUTFITS.map(look => look.id)).size, 100);
assert.equal(byId.size, ITEMS.length);
assert(ITEMS.length > OUTFITS.length, 'Independent pieces must form a larger wardrobe than the full kits.');
for (const theme of THEMES) assert.equal(OUTFITS.filter(look => look.theme === theme.id).length, 10, theme.id);
for (const slot of SLOT_IDS) assert(ITEMS.some(item => item.slot === slot), `Empty ${slot} inventory`);
for (const region of ACCESSORY_REGIONS) assert(ITEMS.filter(item => item.slot === 'accessory' && item.region === region).length > 1, `No replaceable ${region} accessory choices`);
for (const item of ITEMS) {
  assert(item.name && item.en && item.kind && item.palette?.length, `Incomplete piece ${item.id}`);
  if (item.slot === 'accessory') assert(ACCESSORY_REGIONS.includes(item.region), `Invalid accessory position ${item.id}`);
}

// Fingerprints come from actual geometry and attachment transforms. Names,
// IDs, material colors and marketing descriptions cannot make a kit unique.
function geometrySignature(parts) {
  const records = [];
  for (const part of parts) {
    part.group.updateMatrixWorld(true);
    part.group.traverse(mesh => {
      if (!mesh.isMesh) return;
      const position = mesh.geometry.getAttribute('position');
      const index = mesh.geometry.index;
      assert(position?.count > 2, 'Empty garment mesh');
      const normal = mesh.geometry.getAttribute('normal');
      if (normal) for (let i = 0; i < normal.count; i++) assert([normal.getX(i), normal.getY(i), normal.getZ(i)].every(Number.isFinite), 'Non-finite garment normal');
      if (index) for (let i = 0; i < index.count; i++) assert(Number.isInteger(index.getX(i)) && index.getX(i) >= 0 && index.getX(i) < position.count, 'Invalid garment triangle index');
      const points = new Int32Array(position.count * 3);
      const e = mesh.matrixWorld.elements;
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
        const transformed = [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]];
        assert(transformed.every(Number.isFinite), 'Non-finite geometry vertex');
        transformed.forEach((value, axis) => { points[i * 3 + axis] = Math.round(value * 1e6); });
      }
      const hash = createHash('sha256').update(part.bodyName).update(Buffer.from(points.buffer));
      if (index) hash.update(Buffer.from(index.array.buffer, index.array.byteOffset, index.array.byteLength));
      records.push(hash.digest('hex'));
    });
  }
  assert(records.length > 0);
  return createHash('sha256').update(records.sort().join('|')).digest('hex');
}
function dispose(parts) {
  const geometries = new Set(), materials = new Set();
  for (const part of parts) part.group.traverse(mesh => { if (mesh.isMesh) { geometries.add(mesh.geometry); for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material); } });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}
const kits = [];
for (const look of OUTFITS) {
  const ids = selectedItemIds(look.selection);
  assert.deepEqual(normalizeSelection(look.selection), look.selection, `Non-canonical kit ${look.id}`);
  assert(ids.length >= 3 && ids.every(id => byId.has(id)), `Incomplete kit ${look.id}`);
  assert(/^#[0-9a-f]{6}$/i.test(look.bodyColors.shell) && /^#[0-9a-f]{6}$/i.test(look.bodyColors.accent), `No body palette ${look.id}`);
  const parts = createOutfitParts(look.selection);
  try { kits.push({ id: look.id, theme: look.theme, pieces: ids.length, signature: geometrySignature(parts) }); }
  finally { dispose(parts); }
}
const identical = kits.filter((look, index) => kits.findIndex(other => other.signature === look.signature) !== index);
assert.deepEqual(identical, [], 'Full kits must differ physically, beyond recoloring identical geometry.');
for (const item of ITEMS) {
  const parts = createOutfitParts(normalizeSelection({ [item.slot]: item.id }));
  try {
    assert(parts.length > 0 && parts.every(part => part.itemId === item.id), `Factory failed ${item.id}`);
    geometrySignature(parts);
    if (item.slot === 'eyewear') {
      const meshes = []; for (const part of parts) part.group.traverse(object => { if (object.isMesh) meshes.push(object); });
      assert.equal(meshes.filter(mesh => mesh.name.split(':').at(-1) === 'single-eyepiece-rim').length, 1, item.id);
      assert.equal(meshes.filter(mesh => mesh.name.split(':').at(-1) === 'single-optical-lens').length, 1, item.id);
    }
  } finally { dispose(parts); }
}
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'catalog-validation.json'), JSON.stringify({ outfits: OUTFITS.length, items: ITEMS.length, themes: THEMES.map(theme => ({ id: theme.id, outfits: OUTFITS.filter(look => look.theme === theme.id).length })), uniquePhysicalKits: new Set(kits.map(kit => kit.signature)).size, eyewearItems: ITEMS.filter(item => item.slot === 'eyewear').length, kits }, null, 2));
console.log(`Catalog passed: ${OUTFITS.length} physically distinct kits, ${ITEMS.length} valid independent pieces, ${THEMES.length} × 10 collections. Report: ${output}`);
