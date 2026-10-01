import './style.css';
import { THEMES, OUTFITS, ITEMS, SLOT_IDS } from './outfits.js';
import { DEFAULT_ROBOT_COLORS, normalizeRobotColors } from './robot.js';
import { createPreview } from './preview.js';
import { exportLook } from './export.js';
import { t, localized, applyLanguage } from './i18n.js';

const icons = {
  duck: '<path d="M5 14V8a6 6 0 0 1 12 0v3h5l-5 4v4H5Z"/><circle cx="13" cy="7" r=".8"/><path d="M8 20v2m6-2v2M6 22h4m2 0h4"/>',
  'arrow-up-right': '<path d="M6 18 18 6M6 6h12v12"/>', 'arrow-down': '<path d="M12 5v14m-5-5 5 5 5-5"/>', 'arrow-up': '<path d="M12 19V5m-5 5 5-5 5 5"/>',
  'rotate-ccw': '<path d="M3 11a9 9 0 1 1 2.6 7M3 4v7h7"/>', move: '<path d="M12 3v18M3 12h18m-12-6 3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3"/>',
  sparkles: '<path d="m12 3 2.8 6.2L21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8Z"/><path d="M20 2v4m-2-2h4"/>', shuffle: '<path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2.3 0 4-2.5 5.5-5M14 8c1.2-1.2 2.4-2 4-2h3m-4-4 4 4-4 4"/>',
  heart: '<path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 6l-1.1-1.2a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"/>',
  layers: '<path d="m12 3 10 6-10 6L2 9Zm-10 11 10 6 10-6M2 19l10 6 10-6" transform="translate(0 -2)"/>', hat: '<path d="M4 15c0 5 16 5 16 0M7 15V8c0-6 10-6 10 0v7M3 15h18"/>', shirt: '<path d="m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4c0 4-8 4-8 0Z"/>',
  glasses: '<circle cx="6" cy="14" r="4"/><circle cx="18" cy="14" r="4"/><path d="M10 14h4M2 14l2-8m18 8-2-8"/>', boots: '<path d="M4 3h6v9l5 3v5H3V9m12-6h5v9l2 3v5h-4"/>', bookmark: '<path d="M6 3h12v18l-6-4-6 4Z"/>', download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>', search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>', x: '<path d="m6 6 12 12M6 18 18 6"/>', check: '<path d="m5 12 4 4L19 6"/>', trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.sparkles}</svg>`;
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = id => document.getElementById(id);
const slotKeys = { all: 'slotAll', hat: 'slotHat', eyewear: 'slotEyewear', body: 'slotBody', accessory: 'slotAccessory', legwear: 'slotLegwear' };
const slotIcons = { all: 'layers', hat: 'hat', eyewear: 'glasses', body: 'shirt', accessory: 'sparkles', legwear: 'boots' };
const outfitById = new Map(OUTFITS.map(item => [item.id, item]));
const itemById = new Map(ITEMS.map(item => [item.id, item]));
const themeById = new Map(THEMES.map(item => [item.id, item]));
const STORAGE_KEY = 'duckrobe.wardrobe.v2';
const THUMBNAIL_VERSION = 'microduck-single-eye-v2';
let stored = {};
try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; localStorage.removeItem('duckrobe.wardrobe.v1'); } catch { /* Browsing works without storage. */ }
const validSelection = input => Object.fromEntries(SLOT_IDS.map(slot => [slot, itemById.get(input?.[slot])?.slot === slot ? input[slot] : null]));
const state = {
  language: stored.language === 'zh' ? 'zh' : 'en', selection: validSelection(stored.selection || OUTFITS[0].selection), colors: normalizeRobotColors(stored.colors),
  slot: 'all', theme: 'all', query: '', view: 'wardrobe', favoritesOnly: false,
  favorites: new Set((Array.isArray(stored.favorites) ? stored.favorites : []).filter(key => { const [kind, id] = String(key).split(':'); return kind === 'look' ? outfitById.has(id) : kind === 'item' && itemById.has(id); })),
  saved: (Array.isArray(stored.saved) ? stored.saved : []).filter(look => look && typeof look.id === 'string' && look.selection && SLOT_IDS.every(slot => look.selection[slot] === null || itemById.get(look.selection[slot])?.slot === slot)).slice(0, 60).map(look => ({ id: look.id, selection: validSelection(look.selection), colors: normalizeRobotColors(look.colors), date: typeof look.date === 'string' ? look.date : new Date().toISOString(), thumbnail: look.thumbnailVersion === THUMBNAIL_VERSION && typeof look.thumbnail === 'string' && look.thumbnail.startsWith('data:image/') ? look.thumbnail : null, thumbnailVersion: THUMBNAIL_VERSION })),
  bouncing: !matchMedia('(prefers-reduced-motion: reduce)').matches,
};
let preview, toastTimer, reactionTimer, exporting = false;
const tr = (key, vars) => t(key, state.language, vars);
const nameOf = item => localized(item, state.language);
const selectionKey = selection => SLOT_IDS.map(slot => selection[slot] || '').join('|');
const colorKey = colors => `${colors.shell}/${colors.accent}`;
function currentLook(selection = state.selection) { return OUTFITS.find(look => selectionKey(look.selection) === selectionKey(selection)); }
function getLookName(selection = state.selection) { return currentLook(selection) ? nameOf(currentLook(selection)) : Object.values(selection).some(Boolean) ? tr('mixName') : tr('bareName'); }
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500); }
function persist() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ language: state.language, selection: state.selection, colors: state.colors, favorites: [...state.favorites], saved: state.saved })); } catch { toast(tr('storageError')); } }
function refreshLook({ geometry = false } = {}) {
  if (geometry) preview?.setSelection(state.selection);
  const look = currentLook(), hasClothes = Object.values(state.selection).some(Boolean);
  $('look-name').textContent = getLookName();
  $('look-description').textContent = look ? localized(look, state.language, 'description') : tr(hasClothes ? 'mixDescription' : 'bareDescription');
  $('look-series').textContent = look ? nameOf(themeById.get(look.theme)).toUpperCase() : tr(hasClothes ? 'mixSeries' : 'original');
  const favoriteKey = look ? `look:${look.id}` : state.slot !== 'all' && state.selection[state.slot] ? `item:${state.selection[state.slot]}` : null;
  $('favorite-look').classList.toggle('is-favorite', Boolean(favoriteKey && state.favorites.has(favoriteKey)));
  $('favorite-look').setAttribute('aria-label', tr(favoriteKey && state.favorites.has(favoriteKey) ? 'unfavorite' : 'favorite', { name: getLookName() }));
  $('favorite-look').setAttribute('aria-pressed', String(Boolean(favoriteKey && state.favorites.has(favoriteKey))));
  $('saved-count').textContent = state.saved.length;
  $('equipped-items').innerHTML = SLOT_IDS.map(slot => {
    const item = itemById.get(state.selection[slot]);
    return `<div class="equipped-chip${item ? '' : ' empty'}"><button class="equipped-name" data-choose-slot="${slot}" title="${escape(tr('viewPart', { name: tr(slotKeys[slot]) }))}">${icon(slotIcons[slot])}<span><small>${tr(slotKeys[slot])}</small>${escape(item ? nameOf(item) : tr('unfilled'))}</span></button>${item ? `<button class="equipped-remove" data-remove-slot="${slot}" aria-label="${escape(tr('remove', { name: nameOf(item) }))}">${icon('x')}</button>` : ''}</div>`;
  }).join('');
  $('equipped-items').querySelectorAll('[data-choose-slot]').forEach(button => button.addEventListener('click', () => { setView('wardrobe'); setSlot(button.dataset.chooseSlot); }));
  $('equipped-items').querySelectorAll('[data-remove-slot]').forEach(button => button.addEventListener('click', () => { state.selection[button.dataset.removeSlot] = null; refreshLook({ geometry: true }); renderCatalog(); persist(); }));
}
function selectLook(id) { const look = outfitById.get(id); if (!look) return; state.selection = validSelection(look.selection); refreshLook({ geometry: true }); renderCatalog(); persist(); }
function selectItem(id) { const item = itemById.get(id); if (!item) return; state.selection[item.slot] = id; refreshLook({ geometry: true }); renderCatalog(); persist(); }
function toggleFavorite(key) { state.favorites.has(key) ? state.favorites.delete(key) : state.favorites.add(key); refreshLook(); renderCatalog(); persist(); }
function renderSlots() {
  $('slot-controls').innerHTML = ['all', ...SLOT_IDS].map(slot => `<button class="slot-button${state.slot === slot ? ' active' : ''}" data-slot="${slot}" aria-pressed="${state.slot === slot}">${icon(slotIcons[slot])}<span>${tr(slotKeys[slot])}</span></button>`).join('');
  $('slot-controls').querySelectorAll('button').forEach(button => button.addEventListener('click', () => setSlot(button.dataset.slot)));
}
function setSlot(slot) { state.slot = slot; state.theme = 'all'; state.query = ''; $('outfit-search').value = ''; renderSlots(); renderFilters(); refreshLook(); renderCatalog(); }
function renderFilters() {
  $('theme-filters').innerHTML = [{ id: 'all', name: tr('allThemes'), en: tr('allThemes') }, ...THEMES].map(theme => `<button class="theme-chip${state.theme === theme.id ? ' active' : ''}" data-theme="${theme.id}" aria-pressed="${state.theme === theme.id}">${escape(nameOf(theme))}</button>`).join('');
  $('theme-filters').querySelectorAll('button').forEach(button => button.addEventListener('click', () => { state.theme = button.dataset.theme; renderFilters(); renderCatalog(); }));
}
function thumbnailKey(item, isPart) { return isPart ? `item:${item.id}` : `look:${item.id}:${colorKey(state.colors)}`; }
function cardImage(key, name) { const url = preview?.thumbnails.get(key); return url ? `<img src="${url}" alt="${escape(tr('previewAlt', { name }))}" loading="lazy" />` : `<span class="thumbnail-loading" aria-label="${escape(tr('generating'))}">${icon('shirt')}</span>`; }
function emptyState(kind) {
  const title = kind === 'saved' ? 'savedEmpty' : kind === 'favorites' ? 'favoriteEmpty' : 'emptyTitle';
  const text = kind === 'saved' ? 'savedEmptyText' : kind === 'favorites' ? 'favoriteEmptyText' : 'emptyText';
  return `<div class="empty-state">${icon(kind === 'saved' ? 'bookmark' : kind === 'favorites' ? 'heart' : 'search')}<h3>${tr(title)}</h3><p>${tr(text)}</p><button class="save-button" id="clear-filters">${tr(kind === 'saved' ? 'browse' : 'clearFilters')}</button></div>`;
}
function renderCatalog() {
  const saved = state.view === 'saved', grid = $('outfit-grid'), query = state.query.trim().toLowerCase(), isPart = state.slot !== 'all';
  $('wardrobe-nav').classList.toggle('active', !saved); $('saved-nav').classList.toggle('active', saved);
  $('closet-title').innerHTML = `${tr(saved ? 'savedTitle' : 'closetTitle')}<span class="title-dot">.</span>`;
  $('closet-note').textContent = tr(saved ? 'savedNote' : 'closetNote');
  $('filter-favorites').hidden = saved; $('theme-filters').hidden = saved; $('slot-controls').parentElement.hidden = saved;
  $('slot-caption').innerHTML = `${tr(isPart ? 'partHint' : 'tryHint')} ${icon('arrow-down')}`;
  $('catalog-caption').textContent = tr(state.favoritesOnly && !saved ? 'favoritesNote' : 'catalogNote');
  if (saved) {
    const looks = state.saved.filter(look => !query || `${getLookName(look.selection)} ${Object.values(look.selection).map(id => `${itemById.get(id)?.en || ''} ${itemById.get(id)?.name || ''}`).join(' ')}`.toLowerCase().includes(query));
    $('result-count').textContent = `${looks.length} ${tr('savedLabel')}`;
    grid.innerHTML = looks.length ? looks.map(look => {
      const name = getLookName(look.selection), date = new Intl.DateTimeFormat(state.language === 'zh' ? 'zh-CN' : 'en-GB', { month: 'short', day: 'numeric', timeZone: 'Asia/Shanghai' }).format(Number.isNaN(Date.parse(look.date)) ? new Date() : new Date(look.date));
      return `<article class="outfit-card saved-card" data-saved="${look.id}"><button class="card-open" aria-label="${escape(tr('tryOn', { name }))}"><div class="card-visual" data-thumbnail="saved:${escape(look.id)}" style="--card-bg:#eceee3">${look.thumbnail ? `<img src="${look.thumbnail}" alt="${escape(tr('previewAlt', { name }))}" />` : cardImage(`saved:${look.id}`, name)}<span class="card-number">MY LOOK</span></div><div class="card-info"><div><h3 class="card-name">${escape(name)}</h3><p class="card-subtitle">${escape(date)}</p></div><div class="card-swatches"><i style="background:${look.colors.shell}"></i><i style="background:${look.colors.accent}"></i></div></div></button><button class="card-delete card-heart" aria-label="${escape(tr('deleteSaved', { name }))}">${icon('trash')}</button></article>`;
    }).join('') : emptyState('saved');
    grid.querySelectorAll('[data-saved]').forEach(card => {
      const look = state.saved.find(look => look.id === card.dataset.saved);
      card.querySelector('.card-open').addEventListener('click', () => { state.selection = { ...look.selection }; state.colors = { ...look.colors }; preview?.setColors(state.colors); refreshColors(); refreshLook({ geometry: true }); persist(); toast(tr('restoredToast')); });
      card.querySelector('.card-delete').addEventListener('click', () => { state.saved = state.saved.filter(item => item.id !== look.id); persist(); refreshLook(); renderCatalog(); toast(tr('removedToast')); });
    });
    preview?.queueThumbnails(looks.filter(look => !look.thumbnail).map(look => ({ key: `saved:${look.id}`, selection: look.selection, options: { colors: look.colors } })), (key, url) => {
      const look = state.saved.find(look => `saved:${look.id}` === key);
      if (!look) return;
      look.thumbnail = url; look.thumbnailVersion = THUMBNAIL_VERSION;
      grid.querySelectorAll('[data-thumbnail]').forEach(node => { if (node.dataset.thumbnail === key && node.querySelector('.thumbnail-loading')) { const image = document.createElement('img'); image.src = url; image.alt = tr('previewAlt', { name: getLookName(look.selection) }); node.querySelector('.thumbnail-loading').replaceWith(image); } });
      persist();
    });
  } else {
    const pool = isPart ? ITEMS.filter(item => item.slot === state.slot) : OUTFITS;
    const items = pool.filter(item => (state.theme === 'all' || item.theme === state.theme) && (!state.favoritesOnly || state.favorites.has(`${isPart ? 'item' : 'look'}:${item.id}`)) && (!query || `${item.name} ${item.en} ${item.description || ''} ${item.descriptionEn || ''} ${themeById.get(item.theme)?.name} ${themeById.get(item.theme)?.en}`.toLowerCase().includes(query)));
    $('result-count').textContent = `${items.length} ${tr(isPart ? 'piecesLabel' : 'looksLabel')}`;
    grid.innerHTML = items.length ? items.map((item, index) => {
      const selected = isPart ? state.selection[item.slot] === item.id : currentLook()?.id === item.id;
      const key = `${isPart ? 'item' : 'look'}:${item.id}`, name = nameOf(item), imageKey = thumbnailKey(item, isPart);
      const slots = isPart ? [item.slot] : SLOT_IDS.filter(slot => item.selection[slot]);
      return `<article class="outfit-card${selected ? ' active equipped' : ''}${isPart ? ' item-card' : ''}" ${isPart ? 'data-item' : 'data-outfit'}="${item.id}"><button class="card-open" aria-label="${escape(tr('tryOn', { name }))}" aria-pressed="${selected}"><div class="card-visual" data-thumbnail="${escape(imageKey)}" style="--card-bg:${themeById.get(item.theme)?.color || '#efeddf'}">${cardImage(imageKey, name)}<span class="card-number">${isPart ? icon(slotIcons[item.slot]) : String(OUTFITS.indexOf(item) + 1).padStart(2, '0')}</span>${selected ? `<span class="card-selected card-equipped">${icon('check')} ${tr('wearing')}</span>` : ''}</div><div class="card-info"><div><h3 class="card-name">${escape(name)}</h3><p class="card-subtitle">${escape(nameOf(themeById.get(item.theme)))}</p></div><div class="card-swatches" aria-label="${escape(tr('accentColor'))}">${(item.palette || []).slice(0, 3).map(color => `<i style="background:${color}"></i>`).join('')}</div></div><div class="parts-tag">${slots.map(slot => `<span class="item-part" title="${tr(slotKeys[slot])}">${icon(slotIcons[slot])}</span>`).join('')}</div></button><button class="card-heart${state.favorites.has(key) ? ' is-favorite' : ''}" aria-label="${escape(tr(state.favorites.has(key) ? 'unfavorite' : 'favorite', { name }))}" aria-pressed="${state.favorites.has(key)}">${icon('heart')}</button></article>`;
    }).join('') : emptyState(state.favoritesOnly ? 'favorites' : 'search');
    grid.querySelectorAll('[data-outfit], [data-item]').forEach(card => { const part = Boolean(card.dataset.item), id = card.dataset.item || card.dataset.outfit; card.querySelector('.card-open').addEventListener('click', () => part ? selectItem(id) : selectLook(id)); card.querySelector('.card-heart').addEventListener('click', () => toggleFavorite(`${part ? 'item' : 'look'}:${id}`)); });
    preview?.queueThumbnails(items.map(item => ({ key: thumbnailKey(item, isPart), selection: isPart ? validSelection({ [item.slot]: item.id }) : item.selection, options: { item: isPart, colors: { ...state.colors } } })), (key, url) => {
      grid.querySelectorAll('[data-thumbnail]').forEach(node => { if (node.dataset.thumbnail === key && node.querySelector('.thumbnail-loading')) { const image = document.createElement('img'); image.src = url; image.alt = tr('previewAlt', { name: node.closest('article').querySelector('.card-name').textContent }); image.loading = 'lazy'; node.querySelector('.thumbnail-loading').replaceWith(image); } });
    });
  }
  $('clear-filters')?.addEventListener('click', () => { state.query = ''; state.theme = 'all'; state.favoritesOnly = false; state.view = 'wardrobe'; $('outfit-search').value = ''; $('filter-favorites').setAttribute('aria-pressed', 'false'); renderFilters(); renderCatalog(); });
}
function setView(view) { state.view = view; state.query = ''; $('outfit-search').value = ''; renderCatalog(); }
const PALETTES = [
  { key: 'paletteOrange', ...DEFAULT_ROBOT_COLORS }, { key: 'paletteCream', shell: '#f1e8d5', accent: '#d7aa72' },
  { key: 'paletteMint', shell: '#a3bea5', accent: '#e2e6bd' }, { key: 'paletteBlue', shell: '#99b8cc', accent: '#ede3d2' }, { key: 'paletteRose', shell: '#dcb0ba', accent: '#f3dfc7' },
];
function refreshColors() {
  $('shell-color').value = state.colors.shell; $('accent-color').value = state.colors.accent;
  $('palette-presets').innerHTML = PALETTES.map((palette, index) => `<button class="palette-preset${colorKey(palette) === colorKey(state.colors) ? ' active' : ''}" data-palette="${index}" style="background:linear-gradient(135deg,${palette.shell} 60%,${palette.accent} 60%)" aria-label="${escape(tr(palette.key))}" title="${escape(tr(palette.key))}" aria-pressed="${colorKey(palette) === colorKey(state.colors)}"></button>`).join('');
  $('palette-presets').querySelectorAll('button').forEach(button => button.addEventListener('click', () => setColors(PALETTES[button.dataset.palette])));
}
function setColors(colors) { state.colors = normalizeRobotColors(colors); preview?.setColors(state.colors); refreshColors(); persist(); renderCatalog(); }
function setMotion() { preview?.setMotion(state.bouncing); $('motion-toggle').classList.toggle('active', state.bouncing); $('motion-toggle').setAttribute('aria-pressed', String(state.bouncing)); $('motion-label').textContent = tr(state.bouncing ? 'motionOn' : 'motionOff'); }
function setLanguage(language) { state.language = language; applyLanguage(language); renderSlots(); renderFilters(); refreshLook(); refreshColors(); renderCatalog(); setMotion(); preview?.setLabel(tr('canvasLabel')); persist(); }
function showInfo(content) { $('dialog-content').innerHTML = content; $('info-dialog').showModal(); }
function hydrateIcons() { document.querySelectorAll('[data-icon]').forEach(node => { node.innerHTML = icon(node.dataset.icon); }); }
hydrateIcons();
$('dialog-close').addEventListener('click', () => $('info-dialog').close());
$('info-dialog').addEventListener('click', event => { if (event.target === $('info-dialog')) { const rect = event.target.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.target.close(); } });
$('about-button').addEventListener('click', () => showInfo(`<div class="dialog-kicker">HELLO, LITTLE DUCK.</div><h2>${tr('aboutTitle')}</h2><p>${tr('aboutText')}</p><p>${tr('aboutStorage')}</p><p class="dialog-note">${tr('aboutNote')}</p>`));
$('source-button').addEventListener('click', () => showInfo(`<div class="dialog-kicker">BUILT WITH OPEN SOURCE</div><h2>${tr('sourceTitle')}</h2><p>${tr('sourceText')}</p><p><a href="https://github.com/pollen-robotics/microduck_rl" target="_blank" rel="noopener noreferrer">Microduck RL ↗</a></p><p><a href="https://huggingface.co/spaces/pollen-robotics/microduck-simulator" target="_blank" rel="noopener noreferrer">Microduck simulator ↗</a></p><p class="dialog-note">${tr('sourceNote')}</p>`));
$('wardrobe-nav').addEventListener('click', () => setView('wardrobe')); $('saved-nav').addEventListener('click', () => setView('saved'));
$('outfit-search').addEventListener('input', event => { state.query = event.target.value; renderCatalog(); });
document.addEventListener('keydown', event => { if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && !$('info-dialog').open) { event.preventDefault(); $('outfit-search').focus(); } });
$('filter-favorites').addEventListener('click', () => { state.favoritesOnly = !state.favoritesOnly; $('filter-favorites').setAttribute('aria-pressed', String(state.favoritesOnly)); renderCatalog(); });
$('clear-look').addEventListener('click', () => { state.selection = validSelection({}); refreshLook({ geometry: true }); renderCatalog(); persist(); toast(tr('clearToast')); });
$('favorite-look').addEventListener('click', () => { const look = currentLook(), id = state.selection[state.slot]; if (look) toggleFavorite(`look:${look.id}`); else if (id) toggleFavorite(`item:${id}`); else toast(tr('pickFavorite')); });
$('random-button').addEventListener('click', () => { const pool = (state.slot === 'all' ? OUTFITS : ITEMS.filter(item => item.slot === state.slot)).filter(item => state.theme === 'all' || item.theme === state.theme); const choice = pool[Math.floor(Math.random() * pool.length)]; if (choice) state.slot === 'all' ? selectLook(choice.id) : selectItem(choice.id); toast(tr('randomToast')); });
$('motion-toggle').addEventListener('click', () => { state.bouncing = !state.bouncing; setMotion(); });
$('jump-button').addEventListener('click', () => preview?.trigger('hop'));
$('pet-action-menu').querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => preview?.trigger(button.dataset.action)));
$('reset-camera').addEventListener('click', () => preview?.resetCamera());
$('shell-color').addEventListener('input', event => setColors({ ...state.colors, shell: event.target.value }));
$('accent-color').addEventListener('input', event => setColors({ ...state.colors, accent: event.target.value }));
$('reset-colors').addEventListener('click', () => setColors(DEFAULT_ROBOT_COLORS));
document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => setLanguage(button.dataset.language)));
$('save-look').addEventListener('click', () => {
  if (!preview) { toast(tr('readyToast')); return; }
  if (state.saved.some(look => selectionKey(look.selection) === selectionKey(state.selection) && colorKey(look.colors) === colorKey(state.colors))) { toast(tr('duplicateToast')); return; }
  if (state.saved.length >= 60) { toast(tr('savedLimit')); return; }
  state.saved.unshift({ id: `look-${crypto.randomUUID()}`, selection: { ...state.selection }, colors: { ...state.colors }, date: new Date().toISOString(), thumbnail: preview.makeThumbnail(state.selection, { colors: state.colors }), thumbnailVersion: THUMBNAIL_VERSION });
  persist(); refreshLook(); renderCatalog(); toast(tr('savedToast'));
});
$('export-look').disabled = true;
$('export-look').addEventListener('click', async () => {
  if (!preview || exporting) return;
  exporting = true; const button = $('export-look'); button.disabled = true; button.querySelector('[data-i18n="exportLook"]').textContent = tr('exporting');
  try { await exportLook({ robot: preview.rig, selection: { ...state.selection }, colors: { ...state.colors }, outfitName: getLookName() }); toast(tr('exported')); }
  catch (error) { console.error(error); toast(tr('exportError', { message: error.message })); }
  finally { exporting = false; button.disabled = false; button.querySelector('[data-i18n="exportLook"]').textContent = tr('exportLook'); }
});
setLanguage(state.language);
createPreview({ viewer: $('viewer'), colors: state.colors, selection: state.selection, onReaction: () => {
  const bubble = $('pet-reaction'); bubble.hidden = false; bubble.textContent = ['♡', '✦', '♪'][Math.floor(Math.random() * 3)]; clearTimeout(reactionTimer); reactionTimer = setTimeout(() => { bubble.hidden = true; }, 1700);
} }).then(result => {
  preview = result;
  // Controls remain usable during asset loading; apply their latest values.
  preview.setColors(state.colors); preview.setSelection(state.selection); preview.setLabel(tr('canvasLabel')); setMotion();
  const look = currentLook();
  preview.thumbnails.set(look ? thumbnailKey(look, false) : 'initial-preview', preview.makeThumbnail(state.selection, { colors: state.colors }));
  $('viewer-loading').hidden = true; $('export-look').disabled = false; renderCatalog();
  window.duckrobe = { ready: true, state, rig: preview.rig, OUTFITS, ITEMS, THEMES, SLOT_IDS, selectLook, selectItem, preview, thumbnails: preview.thumbnails, getLookName };
}).catch(error => {
  console.error(error);
  $('viewer-loading').innerHTML = `${icon('duck')}<strong>${tr('renderError')}</strong><span>${escape(error.message)}</span><button class="save-button" id="retry-viewer">${tr('retry')}</button>`;
  $('retry-viewer').addEventListener('click', () => location.reload());
});
