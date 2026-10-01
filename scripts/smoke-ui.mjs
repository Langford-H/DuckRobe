import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { unzipSync } from 'fflate';
import { DOMParser } from '@xmldom/xmldom';

const url = process.env.DUCKROBE_URL || 'http://localhost:5173';
const output = path.resolve(process.env.DUCKROBE_QA_OUTPUT || 'test-results');
const slots = ['hat', 'eyewear', 'body', 'accessory', 'legwear'];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(90000); page.setDefaultNavigationTimeout(90000);
const monocleOnly = process.argv.includes('--monocle-focus');
const focused = monocleOnly || process.argv.includes('--final-focus');
const errors = [];
const warnings = [];
const results = [];
const screenshots = [];
for (const target of [page]) {
  target.on('pageerror', error => errors.push(error.message));
  target.on('console', message => { if (message.type() === 'error') errors.push(message.text()); if (message.type() === 'warning') warnings.push(message.text()); });
}
async function check(name, action) {
  try { await action(); results.push({ name, status: 'passed' }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, status: 'failed', error: error.stack || error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}
async function ready(target = page) {
  await target.waitForFunction(() => window.duckrobe?.ready && Array.isArray(window.duckrobe.ITEMS) && window.duckrobe.OUTFITS.length === 24, null, { timeout: 180000 });
}
async function selection(target = page) { return target.evaluate(() => ({ ...window.duckrobe.state.selection })); }
async function colors(target = page) { return target.evaluate(() => ({ ...window.duckrobe.rig.metadata.bodyColors })); }
async function selectLook(id, target = page) { await target.locator(`[data-outfit="${id}"] .card-open`).click(); }
async function selectItem(id, target = page) { await target.locator(`[data-item="${id}"] .card-open`).click(); }
async function switchSlot(slot, target = page) { await target.locator(`#slot-controls [data-slot="${slot}"]`).click(); }
async function lookCards(expected, target = page) { assert.equal(await target.locator('[data-outfit]').count(), expected); }
async function frames(count = 24) {
  return page.evaluate(async count => {
    const observations = [];
    for (let frame = 0; frame < count; frame++) {
      await new Promise(requestAnimationFrame);
      const { rig } = window.duckrobe;
      observations.push({ position: rig.group.position.toArray(), rotation: rig.group.rotation.toArray().slice(0, 3), joints: Object.fromEntries([...rig.joints].map(([name, joint]) => [name, joint.angle])), behavior: rig.behavior?.getState() });
    }
    return observations;
  }, count);
}
function extent(values) { return Math.max(...values) - Math.min(...values); }
async function setColor(id, value) {
  await page.locator(id).evaluate((input, value) => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); }, value);
}
async function noOverflow(target = page) {
  const dimensions = await target.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth, buttons: [...document.querySelectorAll('button')].filter(element => getComputedStyle(element).display !== 'none' && element.scrollWidth > element.clientWidth + 2).map(element => ({ text: element.innerText, width: element.clientWidth, content: element.scrollWidth })) }));
  assert(dimensions.document <= dimensions.width + 1 && dimensions.body <= dimensions.width + 1, JSON.stringify(dimensions));
  assert.deepEqual(dimensions.buttons, [], 'Button labels must fit their controls');
}
async function shot(name, target = page, options = {}) {
  await target.screenshot({ path: path.join(output, name), timeout: 90000, ...options }); screenshots.push(name);
}
function assertSameOtherSlots(before, after, changedSlot) {
  assert.deepEqual(Object.fromEntries(slots.filter(slot => slot !== changedSlot).map(slot => [slot, after[slot]])), Object.fromEntries(slots.filter(slot => slot !== changedSlot).map(slot => [slot, before[slot]])));
}

async function verifyMonocles() {
  const eyewear = await page.evaluate(() => window.duckrobe.ITEMS.filter(item => item.slot === 'eyewear').map(item => ({ id: item.id, en: item.en })));
  assert.equal(eyewear.length, 19);
  await switchSlot('eyewear');
  for (const item of eyewear) {
    await page.evaluate(id => window.duckrobe.selectItem(id), item.id);
    const details = await page.evaluate(() => { const meshes = []; window.duckrobe.rig.group.traverse(group => { if (group.userData.slot === 'eyewear') group.traverse(object => { if (object.isMesh) meshes.push({ name: object.name, vertices: object.geometry.getAttribute('position').count }); }); }); return meshes; });
    assert.equal(details.filter(mesh => mesh.name.split(':').at(-1) === 'single-eyepiece-rim').length, 1, `${item.en} needs one continuous frame`);
    assert.equal(details.filter(mesh => mesh.name.split(':').at(-1) === 'single-optical-lens').length, 1, `${item.en} needs one optical lens`);
    assert(details.every(mesh => mesh.vertices > 0));
  }
  await page.waitForFunction(() => !window.duckrobe.preview.thumbnailsPending, null, { timeout: 180000 });
  const images = await page.locator('[data-item] img').evaluateAll(images => images.map(image => image.src));
  assert.equal(images.length, 19); assert.equal(new Set(images).size, 19);
  await shot('products-eyewear.png');
}
async function verifyMonocleExport() {
  const expected = await selection();
  const downloading = page.waitForEvent('download', { timeout: 90000 }); await page.locator('#export-look').click(); const download = await downloading;
  const destination = path.join(output, 'duckrobe-single-eye.zip'); await download.saveAs(destination);
  const files = unzipSync(await readFile(destination)); const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
  assert.deepEqual(manifest.selection, expected); assert.deepEqual(manifest.bodyColors, await colors());
  const eyewear = manifest.clothing.filter(part => part.slot === 'eyewear');
  assert.equal(eyewear.filter(part => part.detailName?.split(':').at(-1) === 'single-eyepiece-rim').length, 1);
  assert.equal(eyewear.filter(part => part.detailName?.split(':').at(-1) === 'single-optical-lens').length, 1);
  assert(eyewear.every(part => files[part.path]?.length > 0 && part.vertices > 0 && part.triangles > 0));
  const parser = new DOMParser(), decoder = new TextDecoder();
  const urdf = parser.parseFromString(decoder.decode(files['microduck.urdf']), 'application/xml');
  const mjcf = parser.parseFromString(decoder.decode(files['microduck.xml']), 'application/xml');
  for (const part of eyewear) {
    assert([...urdf.getElementsByTagName('mesh')].some(mesh => mesh.getAttribute('filename') === part.path));
    assert([...mjcf.getElementsByTagName('mesh')].some(mesh => `meshes/${mesh.getAttribute('file')}` === part.path));
  }
}
async function verifyLegacySavedThumbnail() {
  const oldThumbnail = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
  const savedSelection = await selection();
  const savedColors = { shell: '#bdace3', accent: '#f2dbac' };
  const savedDate = '2026-10-01T20:00:00.000Z';
  await page.evaluate(({ selection, colors, oldThumbnail, date }) => {
    localStorage.setItem('duckrobe.wardrobe.v2', JSON.stringify({ language: 'en', selection, colors, favorites: [`item:${selection.eyewear}`], saved: [{ id: 'legacy-eyewear-qa', selection, colors, date, thumbnail: oldThumbnail, thumbnailVersion: 'microduck-single-eye-v1' }] }));
  }, { selection: savedSelection, colors: savedColors, oldThumbnail, date: savedDate });
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready();
  const migrated = await page.evaluate(() => window.duckrobe.state.saved[0]);
  assert.equal(migrated.id, 'legacy-eyewear-qa'); assert.equal(migrated.date, savedDate);
  assert.deepEqual(migrated.selection, savedSelection); assert.deepEqual(migrated.colors, savedColors);
  assert.notEqual(migrated.thumbnail, oldThumbnail, 'An old v2 snapshot must be invalidated without deleting the saved look');
  assert(await page.evaluate(() => window.duckrobe.state.favorites.has(`item:${window.duckrobe.state.selection.eyewear}`)));
  await page.locator('#saved-nav').click();
  await page.waitForFunction(() => window.duckrobe.state.saved[0].thumbnail?.startsWith('data:image/') && window.duckrobe.state.saved[0].thumbnail.length > 3000, null, { timeout: 180000 });
  const rebuilt = await page.evaluate(() => window.duckrobe.state.saved[0]);
  assert.equal(rebuilt.thumbnailVersion, 'microduck-single-eye-v2'); assert.notEqual(rebuilt.thumbnail, oldThumbnail);
  assert.equal(await page.locator('[data-saved="legacy-eyewear-qa"] img').getAttribute('src'), rebuilt.thumbnail);
  assert.match(await page.locator('[data-saved="legacy-eyewear-qa"] .card-subtitle').innerText(), /2 Oct|Oct 2/);
  await page.locator('#clear-look').click(); await setColor('#shell-color', '#ed8938');
  await page.locator('[data-saved="legacy-eyewear-qa"] .card-open').click();
  assert.deepEqual(await selection(), savedSelection); assert.deepEqual(await colors(), savedColors);
  assert.equal(await page.evaluate(() => window.duckrobe.state.saved[0].date), savedDate);
  await shot('saved-single-eye-migration.png');
  await page.locator('#wardrobe-nav').click(); await switchSlot('all');
}
async function verifyResponsiveLayouts() {
  for (const width of [390, 340]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 750 }); await noOverflow();
    await page.evaluate(() => scrollTo(0, 0)); await shot(`mobile-${width}-top.png`);
    await page.locator('#export-look').scrollIntoViewIfNeeded(); assert(await page.locator('#export-look').isVisible()); await shot(`mobile-${width}-controls.png`);
    await page.evaluate(() => scrollTo(0, document.querySelector('.closet').getBoundingClientRect().top + scrollY - 16)); await shot(`mobile-${width}-catalog.png`);
    await switchSlot('eyewear'); const id = await page.locator('[data-item]').first().getAttribute('data-item'); const before = await selection(); await selectItem(id); const after = await selection(); assert.equal(after.eyewear, id); assertSameOtherSlots(before, after, 'eyewear');
    await page.locator('[data-language="zh"]').click(); await noOverflow(); await page.locator('[data-language="en"]').click(); await switchSlot('all');
  }
  await page.setViewportSize({ width: 768, height: 1024 }); await noOverflow(); await page.evaluate(() => scrollTo(0, 0)); await shot('tablet.png');
  await page.setViewportSize({ width: 1440, height: 1100 }); await noOverflow();
}
async function verifySlowLoading() {
  const loadingContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const loadingPage = await loadingContext.newPage(); loadingPage.setDefaultTimeout(90000); loadingPage.setDefaultNavigationTimeout(90000);
  loadingPage.on('pageerror', error => errors.push(`slow loading: ${error.message}`));
  let releaseModel;
  const modelGate = new Promise(resolve => { releaseModel = resolve; });
  await loadingPage.route('**/robot/web/microduck.glb', async route => { await modelGate; await route.continue(); });
  try {
    await loadingPage.goto(url, { waitUntil: 'commit' });
    await loadingPage.locator('[data-outfit]').first().waitFor();
    assert.equal(await loadingPage.evaluate(() => Boolean(window.duckrobe?.ready)), false);
    const id = await loadingPage.locator('[data-outfit]').nth(7).getAttribute('data-outfit');
    await selectLook(id, loadingPage);
    await loadingPage.locator('#shell-color').evaluate(input => { input.value = '#bdace3'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    const expectedColors = { shell: '#bdace3', accent: await loadingPage.locator('#accent-color').inputValue() };
    await loadingPage.locator('#saved-nav').click(); assert(await loadingPage.locator('.empty-state').isVisible());
    assert.equal(await loadingPage.locator('#export-look').isDisabled(), true);
    releaseModel(); await ready(loadingPage);
    const expectedSelection = await loadingPage.evaluate(id => window.duckrobe.OUTFITS.find(look => look.id === id).selection, id);
    assert.deepEqual(await selection(loadingPage), expectedSelection); assert.deepEqual(await colors(loadingPage), expectedColors);
    assert.equal(await loadingPage.evaluate(() => window.duckrobe.state.view), 'saved');
    assert.equal(await loadingPage.locator('#viewer-loading').isVisible(), false); assert.equal(await loadingPage.locator('#export-look').isEnabled(), true);
    const attachedSlots = await loadingPage.evaluate(() => { const slots = new Set(); window.duckrobe.rig.group.traverse(object => { if (object.userData.slot) slots.add(object.userData.slot); }); return [...slots].sort(); });
    assert.deepEqual(attachedSlots, slots.filter(slot => expectedSelection[slot]).sort());
    assert(await loadingPage.evaluate(() => window.duckrobe.thumbnails.size > 0), 'Readiness must have a real seed preview even when saved view has no cards');
  } finally { releaseModel(); await loadingContext.close(); await page.bringToFront(); }
}

try {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await ready();
  const catalog = await page.evaluate(() => window.duckrobe.OUTFITS.map(({ id, name, en, theme }) => ({ id, name, en, theme })));
  const items = await page.evaluate(() => window.duckrobe.ITEMS.map(({ id, slot, name, en }) => ({ id, slot, name, en })));
  const themes = await page.evaluate(() => window.duckrobe.THEMES.map(({ id, name, en }) => ({ id, name, en })));
  if (focused) {
    await check('all 19 eyewear products have exactly one native eyepiece frame and one optical lens', verifyMonocles);
    await check('single-eye geometry exports matching frame and lens in both native formats', verifyMonocleExport);
    await check('old v2 snapshots rebuild for one eye while preserving saved choices, colors, dates and favorites', verifyLegacySavedThumbnail);
    if (!monocleOnly) {
    await check('390px and 340px layouts keep labels readable and every control accessible', verifyResponsiveLayouts);
    await check('changes made during slow model loading survive readiness, even in an empty saved wardrobe', verifySlowLoading);
    }
    await page.locator('#reset-colors').click();
    await page.evaluate(() => window.duckrobe.selectLook(window.duckrobe.OUTFITS[0].id));
    await switchSlot('all'); await page.evaluate(() => scrollTo(0, 0));
    await page.waitForFunction(() => !window.duckrobe.preview.thumbnailsPending, null, { timeout: 180000 });
    await shot('desktop.png'); await shot('desktop-ready.png');
  } else {
  await check('fresh browser defaults to English with exactly 24 curated looks', async () => {
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.equal(catalog.length, 24); assert.equal(new Set(catalog.map(look => look.id)).size, 24);
    await lookCards(24);
    assert.equal(await page.locator('.collection-stamp').count(), 0);
    assert.equal(await page.locator('[data-language="en"]').getAttribute('aria-pressed'), 'true');
    assert(!/\p{Script=Han}/u.test(await page.locator('#look-name').innerText()));
    assert(!/\p{Script=Han}/u.test(await page.locator('[data-outfit] .card-name').first().innerText()));
    assert(await page.locator('#viewer canvas').isVisible());
    await noOverflow();
  });
  await shot('desktop.png');
  await check('English and Chinese switch all core labels and preserve the selected look', async () => {
    const before = await selection();
    await page.locator('[data-language="zh"]').click();
    assert.match(await page.locator('html').getAttribute('lang'), /^zh/);
    assert(/\p{Script=Han}/u.test(await page.locator('[data-i18n="heroLead"]').innerText()));
    assert(/\p{Script=Han}/u.test(await page.locator('#look-name').innerText()));
    assert(/\p{Script=Han}/u.test(await page.locator('#slot-controls [data-slot="eyewear"]').innerText()));
    assert.deepEqual(await selection(), before); await noOverflow();
    await shot('desktop-zh.png');
    await page.locator('[data-language="en"]').click();
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert(!/\p{Script=Han}/u.test(await page.locator('#look-name').innerText()));
    assert.deepEqual(await selection(), before);
  });
  await check('each collection exposes its real curated look count', async () => {
    for (const theme of themes) {
      await page.locator(`[data-theme="${theme.id}"]`).click();
      await lookCards(catalog.filter(look => look.theme === theme.id).length);
      assert.equal(await page.locator(`[data-theme="${theme.id}"]`).getAttribute('aria-pressed'), 'true');
    }
    await page.locator('[data-theme="all"]').click(); await lookCards(24);
  });
  await check('whole looks equip valid independent item IDs', async () => {
    await switchSlot('all'); await selectLook(catalog[3].id);
    const current = await selection(); assert.deepEqual(Object.keys(current).sort(), [...slots].sort());
    for (const slot of slots) { if (current[slot]) assert(items.some(item => item.id === current[slot] && item.slot === slot), `${slot} must contain a real matching item`); }
    assert(Object.values(current).filter(Boolean).length >= 3);
    assert.equal(await page.locator(`[data-outfit="${catalog[3].id}"] .card-open`).getAttribute('aria-pressed'), 'true');
  });
  await check('five tabs show actual distinct products, equip independently, and remove only their own slot', async () => {
    const inventories = [];
    for (const slot of slots) {
      const beforeTab = await selection(); await switchSlot(slot);
      assert.deepEqual(await selection(), beforeTab, 'Browsing a category must not change a look');
      assert.equal(await page.locator('[data-outfit]').count(), 0, `${slot} must not reuse complete look cards`);
      const ids = await page.locator('[data-item]').evaluateAll(cards => cards.map(card => card.dataset.item));
      assert(ids.length > 0, `${slot} has no products`);
      assert.equal(ids.length, items.filter(item => item.slot === slot).length);
      assert(ids.every(id => items.some(item => item.id === id && item.slot === slot)));
      inventories.push(ids.join('|'));
      const id = ids.find(id => id !== beforeTab[slot]) || ids[0];
      await selectItem(id);
      const equipped = await selection(); assert.equal(equipped[slot], id); assertSameOtherSlots(beforeTab, equipped, slot);
      assert.equal(await page.locator(`[data-item="${id}"] .card-open`).getAttribute('aria-pressed'), 'true');
      assert(await page.locator(`#equipped-items [data-remove-slot="${slot}"]`).isVisible());
      const actualMeshes = await page.evaluate(slot => { let count = 0; window.duckrobe.rig.group.traverse(object => { if (object.userData.slot === slot) object.traverse(child => { if (child.isMesh) count++; }); }); return count; }, slot);
      assert(actualMeshes > 0, `${slot} must attach visible geometry to the real robot`);
      await page.locator(`#equipped-items [data-remove-slot="${slot}"]`).click();
      const removed = await selection(); assert.equal(removed[slot], null); assertSameOtherSlots(equipped, removed, slot);
      assert.equal(await page.locator(`#equipped-items [data-remove-slot="${slot}"]`).count(), 0);
      await selectItem(id); assert.equal((await selection())[slot], id);
      await shot(`products-${slot}.png`);
    }
    assert.equal(new Set(inventories).size, 5);
    await switchSlot('all'); await lookCards(24);
  });
  await check('all 19 eyewear products have exactly one native eyepiece frame and one optical lens', verifyMonocles);
  await switchSlot('all');
  const mixedSelection = await selection();
  await check('search accepts English and Chinese, empty results recover cleanly', async () => {
    const look = catalog.find(look => typeof look.en === 'string' && typeof look.name === 'string'); assert(look);
    await page.locator('#outfit-search').fill(look.en); await lookCards(1);
    assert.equal(await page.locator('[data-outfit]').getAttribute('data-outfit'), look.id);
    await page.locator('#outfit-search').fill(look.name); await lookCards(1);
    await page.locator('#outfit-search').fill('no-such-duck-qa-827'); await lookCards(0); assert(await page.locator('.empty-state').isVisible());
    await page.locator('#clear-filters').click(); await lookCards(24); assert.equal(await page.locator('#outfit-search').inputValue(), '');
  });
  await check('favorites work for looks and independent products', async () => {
    await page.locator(`[data-outfit="${catalog[5].id}"] .card-heart`).click();
    await page.locator('#filter-favorites').click(); await lookCards(1);
    assert.equal(await page.locator('[data-outfit]').getAttribute('data-outfit'), catalog[5].id);
    await page.locator('[data-outfit] .card-heart').click(); await lookCards(0);
    await page.locator('#filter-favorites').click(); await lookCards(24);
    await switchSlot('eyewear');
    const itemId = await page.locator('[data-item]').first().getAttribute('data-item');
    await page.locator(`[data-item="${itemId}"] .card-heart`).click(); await page.locator('#filter-favorites').click();
    assert.equal(await page.locator('[data-item]').count(), 1);
    assert.equal(await page.locator('[data-item]').getAttribute('data-item'), itemId);
    await page.locator('[data-item] .card-heart').click(); assert.equal(await page.locator('[data-item]').count(), 0);
    await page.locator('#filter-favorites').click(); await switchSlot('all');
  });
  await check('color presets and custom colors update the actual shell and accent materials', async () => {
    const before = await colors();
    assert.equal(await page.locator('#palette-presets button').count() > 1, true);
    await page.locator('#palette-presets button').last().click();
    assert.notDeepEqual(await colors(), before);
    await setColor('#shell-color', '#9fbc8e'); await setColor('#accent-color', '#f5cf76');
    assert.deepEqual(await colors(), { shell: '#9fbc8e', accent: '#f5cf76' });
    const materials = await page.evaluate(() => { const result = {}; window.duckrobe.rig.group.traverse(object => { if (object.userData.meshFile === 'top_head_shell.stl') result.shell = `#${object.material.color.getHexString()}`; if (object.userData.meshFile === 'jaw.stl') result.accent = `#${object.material.color.getHexString()}`; }); return result; });
    assert.deepEqual(materials, await colors());
    assert.equal(await page.locator('#shell-color').inputValue(), '#9fbc8e'); assert.equal(await page.locator('#accent-color').inputValue(), '#f5cf76');
  });
  const savedColors = await colors();
  let originalSavedId;
  await check('saved looks include color, restore all five items, and survive reload', async () => {
    await page.locator('#save-look').click(); assert.equal(await page.locator('#saved-count').textContent(), '1');
    originalSavedId = await page.evaluate(() => window.duckrobe.state.saved[0].id);
    await page.locator('#save-look').click(); assert.equal(await page.locator('#saved-count').textContent(), '1', 'An identical look is not saved twice');
    await setColor('#shell-color', '#ed8938'); await page.locator('#save-look').click(); assert.equal(await page.locator('#saved-count').textContent(), '2', 'The same pieces in a different body color are a different saved look');
    await page.locator('#clear-look').click(); assert.deepEqual(await selection(), Object.fromEntries(slots.map(slot => [slot, null])));
    await page.locator('#saved-nav').click(); assert.equal(await page.locator('[data-saved]').count(), 2);
    await page.locator(`[data-saved="${originalSavedId}"] .card-open`).click();
    assert.deepEqual(await selection(), mixedSelection); assert.deepEqual(await colors(), savedColors);
    await page.reload({ waitUntil: 'domcontentloaded' }); await ready();
    assert.deepEqual(await selection(), mixedSelection); assert.deepEqual(await colors(), savedColors);
    assert.equal(await page.locator('#saved-count').textContent(), '2');
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  });
  await check('background previews finish with 24 unique actual 3D look thumbnails', async () => {
    await page.waitForFunction(() => window.duckrobe.ready && !window.duckrobe.preview.thumbnailsPending, null, { timeout: 180000 });
    await page.locator('#wardrobe-nav').click(); await switchSlot('all'); await lookCards(24);
    await page.locator('[data-outfit] img').first().waitFor();
    const images = await page.locator('[data-outfit] img').evaluateAll(images => images.map(image => image.src));
    assert.equal(images.length, 24); assert.equal(new Set(images).size, 24);
    assert(images.every(image => image.startsWith('data:image/') && image.length > 3000));
    await shot('desktop-ready.png');
  });
  await check('pause settles the rig; manual hop, dance, and turn produce distinct grounded motion', async () => {
    await page.bringToFront();
    if (await page.locator('#motion-toggle').getAttribute('aria-pressed') === 'true') await page.locator('#motion-toggle').click();
    assert.equal(await page.locator('#motion-toggle').getAttribute('aria-pressed'), 'false');
    await frames(60);
    const resting = await frames(8);
    for (const name of Object.keys(resting[0].joints)) assert(extent(resting.map(frame => frame.joints[name])) < .006, `${name} did not settle`);
    for (const kind of ['hop', 'dance', 'turn']) {
      await page.locator(`#pet-action-menu [data-action="${kind}"]`).click();
      await page.waitForFunction(kind => window.duckrobe.rig.behavior.getState().kind === kind, kind, { timeout: 20000 });
      const observed = await frames(24);
      const movement = Math.max(...Object.keys(observed[0].joints).map(name => extent(observed.map(frame => frame.joints[name]))));
      assert(movement > .01, `${kind} must move real joints`);
      if (kind === 'turn') assert(extent(observed.map(frame => frame.rotation[2])) > .08, 'Twirl must turn the duck');
      for (const frame of observed) {
        const feet = frame.behavior.footBounds; assert(feet.left >= -1e-5 && feet.right >= -1e-5, `Feet crossed the ground in ${kind}`);
      }
      await page.waitForFunction(kind => window.duckrobe.rig.behavior.getState().kind !== kind, kind, { timeout: 45000 });
      await frames(12);
    }
    await page.locator('#jump-button').click();
    await page.waitForFunction(() => window.duckrobe.rig.behavior.getState().kind === 'hop', null, { timeout: 20000 });
    await page.waitForFunction(() => window.duckrobe.rig.behavior.getState().kind !== 'hop', null, { timeout: 45000 });
  });
  await check('pointer curiosity follows the cursor; dragging inspects the duck without fighting its motion', async () => {
    if (await page.locator('#motion-toggle').getAttribute('aria-pressed') === 'false') await page.locator('#motion-toggle').click();
    await page.locator('#viewer').scrollIntoViewIfNeeded();
    const box = await page.locator('#viewer canvas').boundingBox(); assert(box);
    await page.mouse.move(box.x + box.width * .15, box.y + box.height * .25); await frames(8);
    const first = await page.evaluate(() => window.duckrobe.rig.joints.get('head_yaw').angle);
    await page.mouse.move(box.x + box.width * .85, box.y + box.height * .25); await frames(8);
    const second = await page.evaluate(() => window.duckrobe.rig.joints.get('head_yaw').angle);
    assert(Math.abs(second - first) > .025, 'Head must respond to cursor movement');
    const cameraBefore = await page.evaluate(() => window.duckrobe.preview.camera.position.toArray());
    await page.mouse.move(box.x + box.width * .5, box.y + box.height * .55); await page.mouse.down();
    await page.mouse.move(box.x + box.width * .74, box.y + box.height * .58, { steps: 12 });
    const inspecting = await frames(14);
    assert(extent(inspecting.map(frame => frame.rotation[2])) < .035, 'The duck must not spin under a held inspection drag');
    await page.mouse.up(); await page.mouse.move(3, 3);
    const cameraAfter = await page.evaluate(() => window.duckrobe.preview.camera.position.toArray());
    assert(cameraBefore.some((value, index) => Math.abs(cameraAfter[index] - value) > .02), 'Dragging must move the inspection camera');
    await page.locator('#reset-camera').click();
  });
  await check('keyboard search, dialog focus, Escape, and open source links work', async () => {
    await page.locator('#look-name').click(); await page.keyboard.press('/'); assert(await page.locator('#outfit-search').evaluate(element => element === document.activeElement));
    await page.locator('#about-button').click(); assert(await page.locator('#info-dialog').isVisible());
    assert(await page.locator('#info-dialog').evaluate(element => element.contains(document.activeElement)));
    await page.keyboard.press('Escape'); assert(!(await page.locator('#info-dialog').isVisible()));
    assert(await page.locator('#about-button').evaluate(element => element === document.activeElement));
    await page.locator('#source-button').click(); assert(await page.locator('#info-dialog a[href*="microduck_rl"]').isVisible()); await page.locator('#dialog-close').click();
  });
  await check('the visible export action downloads both native formats, matching item IDs and colors', async () => {
    const exportedSelection = await selection(); const exportedColors = await colors();
    const downloading = page.waitForEvent('download', { timeout: 90000 }); await page.locator('#export-look').click(); const download = await downloading;
    const destination = path.join(output, download.suggestedFilename()); await download.saveAs(destination); assert.equal(await download.failure(), null);
    const zipped = unzipSync(await readFile(destination)); assert(zipped['microduck.urdf']); assert(zipped['microduck.xml']); assert(zipped['manifest.json']);
    const parser = new DOMParser(); const decoder = new TextDecoder();
    const manifest = JSON.parse(decoder.decode(zipped['manifest.json']));
    assert.deepEqual(manifest.selection, exportedSelection); assert.deepEqual(manifest.bodyColors, exportedColors);
    const urdf = parser.parseFromString(decoder.decode(zipped['microduck.urdf']), 'application/xml');
    const mjcf = parser.parseFromString(decoder.decode(zipped['microduck.xml']), 'application/xml');
    assert.equal(urdf.documentElement.tagName, 'robot'); assert.equal(mjcf.documentElement.tagName, 'mujoco');
    for (const mesh of Array.from(urdf.getElementsByTagName('mesh'))) { const filename = mesh.getAttribute('filename'); assert(zipped[filename]?.length > 0, `URDF missing ${filename}`); }
    const meshDir = mjcf.getElementsByTagName('compiler')[0].getAttribute('meshdir');
    for (const mesh of Array.from(mjcf.getElementsByTagName('mesh'))) { const filename = path.posix.join(meshDir, mesh.getAttribute('file')); assert(zipped[filename]?.length > 0, `MJCF missing ${filename}`); }
    assert(Object.keys(zipped).filter(filename => filename.startsWith('meshes/robot/')).length >= 25);
    assert(Object.keys(zipped).filter(filename => filename.startsWith('meshes/outfits/') && filename.endsWith('.obj')).length >= 5);
    assert(zipped['LICENSE-Microduck.txt']);
    console.log(`Downloaded ${download.suggestedFilename()} (${Object.keys(zipped).length} files)`);
  });
  await check('saved-look deletion and reset persist cleanly', async () => {
    await page.locator('#saved-nav').click();
    while (await page.locator('[data-saved]').count()) await page.locator('[data-saved] .card-delete').first().click();
    assert.equal(await page.locator('#saved-count').textContent(), '0');
    await page.locator('#clear-filters').click(); await lookCards(24);
    await page.locator('#reset-colors').click(); const defaults = await colors(); assert.notDeepEqual(defaults, savedColors);
    await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); assert.equal(await page.locator('#saved-count').textContent(), '0'); assert.deepEqual(await colors(), defaults);
  });
  await check('390px and 340px layouts keep labels readable and every control accessible', verifyResponsiveLayouts);
  await check('changes made during slow model loading survive readiness, even in an empty saved wardrobe', verifySlowLoading);
  }
  await check('no browser page errors or console errors', async () => { assert.deepEqual(errors, []); });
} catch (error) {
  results.push({ name: 'Browser setup and application readiness', status: 'failed', error: error.stack || error.message }); console.error(error);
} finally {
  await writeFile(path.join(output, monocleOnly ? 'ui-validation-monocle.json' : focused ? 'ui-validation-final.json' : 'ui-validation.json'), JSON.stringify({ url, results, errors, warnings, screenshots }, null, 2));
  console.log(`${results.filter(test => test.status === 'passed').length}/${results.length} checks passed. Results: ${output}`);
  if (results.some(test => test.status === 'failed')) process.exitCode = 1;
  await browser.close();
}
