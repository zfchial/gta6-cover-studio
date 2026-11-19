import {
  SIZES,
  LAYOUTS,
  GRADES,
  GRADE_ORDER,
  renderCover,
  layoutOf,
  pointInPanel,
  tapPanels,
} from './engine.js';
import { loadPhoto, sampleUrl, filePhoto } from './photos.js';

const MIN_ZOOM = 1;
const MAX_ZOOM = 3.5;
const DEMO_CAPTION = 'Neon Coast';
const DEMO_SUBTITLE = 'a neon coast story';
const ZOOMS = [1.16, 1.34, 1.08, 1.42, 1.2, 1.3, 1.1, 1.48, 1.24];
const OFFSETS = [
  [-0.16, 0.08],
  [0.12, -0.1],
  [-0.06, 0.18],
  [0.18, 0.1],
  [-0.2, -0.12],
  [0.08, 0.16],
  [-0.1, -0.18],
  [0.2, -0.06],
  [0.04, 0.12],
];

const state = {
  size: SIZES[0],
  layout: 'quad',
  gradeStrength: 88,
  caption: DEMO_CAPTION,
  subtitle: DEMO_SUBTITLE,
  photos: [],
  panels: [],
  selected: 0,
  editor: false,
};

const canvas = document.getElementById('cover');
const captionInput = document.getElementById('caption');
const subtitleInput = document.getElementById('subtitle');
const sizesHost = document.getElementById('sizes');
const layoutsHost = document.getElementById('layouts');
const gradesHost = document.getElementById('grades');
const photoList = document.getElementById('photoList');
const photoInput = document.getElementById('photoInput');
const panelBar = document.getElementById('panelBar');
const zoomInput = document.getElementById('zoom');
const zoomValue = document.getElementById('zoomValue');
const gradeStrengthInput = document.getElementById('gradeStrength');
const gradeStrengthValue = document.getElementById('gradeStrengthValue');
const panelLabel = document.getElementById('panelLabel');
const exportButton = document.getElementById('export');
const dimsLabel = document.getElementById('dims');
const statusLabel = document.getElementById('status');
const stage = document.getElementById('stage');
const fillAllButton = document.getElementById('fillAll');
const resetCropButton = document.getElementById('resetCrop');
const centerButton = document.getElementById('centerPhoto');
const undoButton = document.getElementById('undo');
const redoButton = document.getElementById('redo');

const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);

function makePanel(photoId, index) {
  return {
    photoId: photoId || null,
    zoom: ZOOMS[index % ZOOMS.length],
    offsetX: OFFSETS[index % OFFSETS.length][0],
    offsetY: OFFSETS[index % OFFSETS.length][1],
    grade: GRADE_ORDER[index % GRADE_ORDER.length],
  };
}

function photoFor(id) {
  return state.photos.find((photo) => photo.id === id) || null;
}

function fillPanels(photos) {
  const count = LAYOUTS[state.layout].count;
  state.panels = Array.from({ length: count }, (_, index) => {
    if (!photos.length) return makePanel(null, index);
    return makePanel(photos[index % photos.length].id, index);
  });
  state.selected = Math.min(state.selected, count - 1);
}

function ensurePanels() {
  const count = LAYOUTS[state.layout].count;
  const next = tapPanels(state).slice(0, count);
  while (next.length < count) next.push(makePanel(null, next.length));
  let cursor = 0;
  for (let i = 0; i < next.length; i++) {
    if (!next[i].photoId && state.photos.length) {
      next[i] = makePanel(state.photos[cursor % state.photos.length].id, i);
      cursor += 1;
    }
    if (!next[i].grade) next[i].grade = GRADE_ORDER[i % GRADE_ORDER.length];
  }
  state.panels = next;
  state.selected = Math.min(state.selected, count - 1);
}

let past = [];
let future = [];

function snapshot() {
  return {
    size: { ...state.size },
    layout: state.layout,
    gradeStrength: state.gradeStrength,
    caption: state.caption,
    subtitle: state.subtitle,
    selected: state.selected,
    panels: state.panels.map((panel) => ({ ...panel })),
  };
}

function updateHistoryButtons() {
  undoButton.disabled = past.length === 0;
  redoButton.disabled = future.length === 0;
}

function pushHistory() {
  const next = snapshot();
  const last = past[past.length - 1];
  if (last && JSON.stringify(last) === JSON.stringify(next)) return;
  past.push(next);
  if (past.length > 80) past.shift();
  future = [];
  updateHistoryButtons();
}

function applySnapshot(data) {
  state.size = { ...data.size };
  state.layout = data.layout;
  state.gradeStrength = data.gradeStrength;
  state.caption = data.caption;
  state.subtitle = data.subtitle;
  state.selected = data.selected;
  state.panels = data.panels.map((panel) => ({ ...panel }));
  captionInput.value = state.caption;
  subtitleInput.value = state.subtitle;
  gradeStrengthInput.value = String(state.gradeStrength);
  syncSelection();
  syncPanelBar();
  scheduleDraw();
}

function undo() {
  if (!past.length) return;
  future.push(snapshot());
  applySnapshot(past.pop());
  updateHistoryButtons();
}

function redo() {
  if (!future.length) return;
  past.push(snapshot());
  applySnapshot(future.pop());
  updateHistoryButtons();
}

let textTimer = 0;
let textEditing = false;

function noteTextChange() {
  if (!textEditing) {
    pushHistory();
    textEditing = true;
  }
  clearTimeout(textTimer);
  textTimer = window.setTimeout(() => {
    textEditing = false;
  }, 750);
}

let zoomTimer = 0;
let zoomEditing = false;

function noteZoomChange() {
  if (!zoomEditing) {
    pushHistory();
    zoomEditing = true;
  }
  clearTimeout(zoomTimer);
  zoomTimer = window.setTimeout(() => {
    zoomEditing = false;
  }, 450);
}

function buildControls() {
  sizesHost.innerHTML = SIZES.map((size) => (
    `<button type="button" class="size-card" data-size="${size.id}">
      <span class="size-name">${size.label}</span>
      <span class="size-dims">${size.w} × ${size.h}</span>
    </button>`
  )).join('');

  layoutsHost.innerHTML = Object.entries(LAYOUTS).map(([id, layout]) => (
    `<button type="button" class="layout-card" data-layout="${id}">
      <span class="layout-mini ${id}">${'<i></i>'.repeat(layout.count)}</span>
      <span class="layout-name">${layout.label}</span>
    </button>`
  )).join('');

  gradesHost.innerHTML = GRADE_ORDER.map((id) => {
    const grade = GRADES[id];
    return `<button type="button" class="grade-card" data-grade="${id}">
      <span class="grade-swatch" style="background:${grade.swatch}"></span>
      <span class="grade-name">${grade.label}</span>
    </button>`;
  }).join('');
}

function syncSelection() {
  for (const card of sizesHost.querySelectorAll('[data-size]')) {
    card.classList.toggle('is-active', card.dataset.size === state.size.id);
  }
  for (const card of layoutsHost.querySelectorAll('[data-layout]')) {
    card.classList.toggle('is-active', card.dataset.layout === state.layout);
  }
  const panel = state.panels[state.selected];
  for (const card of gradesHost.querySelectorAll('[data-grade]')) {
    card.classList.toggle('is-active', Boolean(panel) && card.dataset.grade === panel.grade);
  }
  if (panel) {
    zoomInput.value = String(panel.zoom || 1);
    zoomValue.textContent = `${Math.round((panel.zoom || 1) * 100)}%`;
  }
  gradeStrengthInput.value = String(state.gradeStrength);
  gradeStrengthValue.textContent = `${Math.round(state.gradeStrength)}%`;
  const count = LAYOUTS[state.layout].count;
  panelLabel.textContent = `${String(state.selected + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`;
  dimsLabel.textContent = `${state.size.w} × ${state.size.h}`;
  canvas.style.aspectRatio = `${state.size.w} / ${state.size.h}`;
  syncPhotoList();
}

function syncPhotoList() {
  if (state.photos.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-note';
    empty.textContent = 'No photos yet. Add one to start.';
    photoList.replaceChildren(empty);
    return;
  }
  const selected = state.panels[state.selected];
  const nodes = state.photos.map((photo) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'photo-card';
    button.dataset.photo = photo.id;
    button.title = photo.name;
    if (selected && selected.photoId === photo.id) button.classList.add('is-active');
    const image = document.createElement('img');
    image.src = photo.url;
    image.alt = '';
    const label = document.createElement('span');
    label.textContent = photo.local ? photo.name : `${photo.name} · demo`;
    button.append(image, label);
    return button;
  });
  photoList.replaceChildren(...nodes);
}

function syncPanelBar() {
  const count = LAYOUTS[state.layout].count;
  const chips = [];
  for (let i = 0; i < count; i++) {
    const panel = state.panels[i];
    const photo = panel ? photoFor(panel.photoId) : null;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'panel-chip';
    chip.dataset.panel = String(i);
    if (i === state.selected) chip.classList.add('is-active');
    const number = document.createElement('span');
    number.className = 'panel-number';
    number.textContent = String(i + 1).padStart(2, '0');
    const thumb = document.createElement('span');
    thumb.className = 'panel-thumb';
    if (photo) {
      const image = document.createElement('img');
      image.src = photo.url;
      image.alt = '';
      thumb.append(image);
    }
    chip.append(number, thumb);
    chips.push(chip);
  }
  panelBar.replaceChildren(...chips);
}

function selectPanel(index) {
  const count = LAYOUTS[state.layout].count;
  state.selected = clamp(index, 0, count - 1);
  syncSelection();
  for (const chip of panelBar.querySelectorAll('[data-panel]')) {
    chip.classList.toggle('is-active', Number(chip.dataset.panel) === state.selected);
  }
  scheduleDraw();
}

let frameRequest = 0;

function drawNow() {
  renderCover(canvas, state, { selection: state.editor });
}

function scheduleDraw() {
  if (frameRequest) return;
  frameRequest = requestAnimationFrame(() => {
    frameRequest = 0;
    drawNow();
    syncPanelBar();
  });
}

function setLayout(id) {
  if (state.layout === id) return;
  pushHistory();
  state.layout = id;
  ensurePanels();
  syncSelection();
  syncPanelBar();
  scheduleDraw();
}

function setSize(size) {
  if (state.size.id === size.id && state.size.w === size.w && state.size.h === size.h) return;
  pushHistory();
  state.size = size;
  syncSelection();
  scheduleDraw();
}

function setPanelGrade(id) {
  const panel = state.panels[state.selected];
  if (!panel || !GRADES[id] || panel.grade === id) return;
  pushHistory();
  panel.grade = id;
  syncSelection();
  scheduleDraw();
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function panelAt(point) {
  const layout = layoutOf(state.layout, state.size.w, state.size.h);
  for (let i = layout.panels.length - 1; i >= 0; i--) {
    if (pointInPanel(layout.panels[i], point.x, point.y)) return i;
  }
  return -1;
}

let drag = null;

canvas.addEventListener('pointerdown', (event) => {
  const point = canvasPoint(event);
  const index = panelAt(point);
  if (index < 0) return;
  selectPanel(index);
  const panel = state.panels[index];
  const photo = photoFor(panel.photoId);
  if (!photo) return;
  pushHistory();
  const layout = layoutOf(state.layout, state.size.w, state.size.h);
  drag = {
    index,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    offsetX: panel.offsetX || 0,
    offsetY: panel.offsetY || 0,
    rect: layout.panels[index],
    photo,
  };
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add('is-dragging');
});

canvas.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const panel = state.panels[drag.index];
  if (!panel) return;
  const bounds = canvas.getBoundingClientRect();
  const scale = canvas.width / bounds.width;
  const dx = (event.clientX - drag.startX) * scale;
  const dy = (event.clientY - drag.startY) * scale;
  const angle = -(drag.rect.rot || 0);
  const rdx = dx * Math.cos(angle) - dy * Math.sin(angle);
  const rdy = dx * Math.sin(angle) + dy * Math.cos(angle);
  const image = drag.photo.image;
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  const base = Math.max(drag.rect.w / iw, drag.rect.h / ih) * (panel.zoom || 1);
  const maxX = Math.max(1, (iw * base - drag.rect.w) / 2);
  const maxY = Math.max(1, (ih * base - drag.rect.h) / 2);
  panel.offsetX = clamp(drag.offsetX + rdx / maxX, -1, 1);
  panel.offsetY = clamp(drag.offsetY + rdy / maxY, -1, 1);
  scheduleDraw();
});

function endDrag(event) {
  if (!drag) return;
  drag = null;
  canvas.classList.remove('is-dragging');
  if (event && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}

canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const point = canvasPoint(event);
  let index = panelAt(point);
  if (index < 0) index = state.selected;
  selectPanel(index);
  const panel = state.panels[index];
  const photo = photoFor(panel.photoId);
  if (!photo) return;
  const layout = layoutOf(state.layout, state.size.w, state.size.h);
  const rect = layout.panels[index];
  const oldZoom = panel.zoom || 1;
  const nextZoom = clamp(oldZoom * Math.exp(-event.deltaY * 0.0016), MIN_ZOOM, MAX_ZOOM);
  if (Math.abs(nextZoom - oldZoom) < 0.0005) return;
  noteZoomChange();
  const image = photo.image;
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  const baseScale = Math.max(rect.w / iw, rect.h / ih);
  const baseW = iw * baseScale;
  const baseH = ih * baseScale;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const angle = -(rect.rot || 0);
  const dx = point.x - cx;
  const dy = point.y - cy;
  const lx = dx * Math.cos(angle) - dy * Math.sin(angle);
  const ly = dx * Math.sin(angle) + dy * Math.cos(angle);
  const maxX0 = Math.max(0, (baseW * oldZoom - rect.w) / 2);
  const maxY0 = Math.max(0, (baseH * oldZoom - rect.h) / 2);
  const ux = maxX0 > 0 ? (lx - (panel.offsetX || 0) * maxX0) / (baseW * oldZoom) : 0;
  const uy = maxY0 > 0 ? (ly - (panel.offsetY || 0) * maxY0) / (baseH * oldZoom) : 0;
  panel.zoom = nextZoom;
  const maxX1 = Math.max(0, (baseW * nextZoom - rect.w) / 2);
  const maxY1 = Math.max(0, (baseH * nextZoom - rect.h) / 2);
  panel.offsetX = maxX1 > 0 ? clamp((lx - ux * baseW * nextZoom) / maxX1, -1, 1) : 0;
  panel.offsetY = maxY1 > 0 ? clamp((ly - uy * baseH * nextZoom) / maxY1, -1, 1) : 0;
  zoomInput.value = String(panel.zoom);
  zoomValue.textContent = `${Math.round(panel.zoom * 100)}%`;
  scheduleDraw();
}, { passive: false });

zoomInput.addEventListener('input', () => {
  const panel = state.panels[state.selected];
  if (!panel) return;
  noteZoomChange();
  panel.zoom = clamp(Number(zoomInput.value), MIN_ZOOM, MAX_ZOOM);
  zoomValue.textContent = `${Math.round(panel.zoom * 100)}%`;
  scheduleDraw();
});

gradeStrengthInput.addEventListener('input', () => {
  noteZoomChange();
  state.gradeStrength = clamp(Number(gradeStrengthInput.value), 0, 100);
  gradeStrengthValue.textContent = `${Math.round(state.gradeStrength)}%`;
  scheduleDraw();
});

sizesHost.addEventListener('click', (event) => {
  const card = event.target.closest('[data-size]');
  if (!card) return;
  const size = SIZES.find((item) => item.id === card.dataset.size);
  if (size) setSize(size);
});

layoutsHost.addEventListener('click', (event) => {
  const card = event.target.closest('[data-layout]');
  if (!card) return;
  setLayout(card.dataset.layout);
});

gradesHost.addEventListener('click', (event) => {
  const card = event.target.closest('[data-grade]');
  if (!card) return;
  setPanelGrade(card.dataset.grade);
});

photoList.addEventListener('click', (event) => {
  const card = event.target.closest('[data-photo]');
  if (!card) return;
  const panel = state.panels[state.selected];
  if (!panel) return;
  pushHistory();
  panel.photoId = card.dataset.photo;
  const defaults = makePanel(panel.photoId, state.selected);
  panel.zoom = defaults.zoom;
  panel.offsetX = defaults.offsetX;
  panel.offsetY = defaults.offsetY;
  panel.grade = defaults.grade;
  syncSelection();
  syncPanelBar();
  scheduleDraw();
});

panelBar.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-panel]');
  if (!chip) return;
  selectPanel(Number(chip.dataset.panel));
});

captionInput.addEventListener('input', () => {
  noteTextChange();
  state.caption = captionInput.value;
  scheduleDraw();
});

subtitleInput.addEventListener('input', () => {
  noteTextChange();
  state.subtitle = subtitleInput.value;
  scheduleDraw();
});

fillAllButton.addEventListener('click', () => {
  const panel = state.panels[state.selected];
  const source = panel && panel.photoId
    ? panel.photoId
    : state.photos[0] && state.photos[0].id;
  if (!source) {
    statusLabel.textContent = 'Add a photo first.';
    return;
  }
  pushHistory();
  state.panels.forEach((item, index) => {
    const fresh = makePanel(source, index);
    item.photoId = fresh.photoId;
    item.zoom = fresh.zoom;
    item.offsetX = fresh.offsetX;
    item.offsetY = fresh.offsetY;
    item.grade = fresh.grade;
  });
  syncSelection();
  syncPanelBar();
  scheduleDraw();
  statusLabel.textContent = 'Photo placed on every panel.';
});

resetCropButton.addEventListener('click', () => {
  const panel = state.panels[state.selected];
  if (!panel) return;
  pushHistory();
  panel.zoom = 1;
  panel.offsetX = 0;
  panel.offsetY = 0;
  zoomInput.value = '1';
  zoomValue.textContent = '100%';
  scheduleDraw();
});

centerButton.addEventListener('click', () => {
  const panel = state.panels[state.selected];
  if (!panel) return;
  pushHistory();
  panel.offsetX = 0;
  panel.offsetY = 0;
  scheduleDraw();
});

photoInput.addEventListener('change', async () => {
  const files = Array.from(photoInput.files || []).filter((file) => file.type.startsWith('image/'));
  photoInput.value = '';
  if (files.length === 0) return;
  statusLabel.textContent = `Reading ${files.length} photo${files.length === 1 ? '' : 's'}…`;
  try {
    const loaded = await Promise.all(files.map(filePhoto));
    pushHistory();
    const wasEmpty = state.photos.length === 0 && state.panels.every((panel) => !panel.photoId);
    state.photos.push(...loaded);
    if (wasEmpty) {
      state.panels.forEach((panel, index) => {
        Object.assign(panel, makePanel(loaded[index % loaded.length].id, index));
      });
    } else {
      loaded.forEach((photo, index) => {
        const target = state.panels[(state.selected + index) % state.panels.length];
        Object.assign(target, makePanel(photo.id, state.selected + index));
      });
    }
    syncSelection();
    syncPanelBar();
    scheduleDraw();
    statusLabel.textContent = `${loaded.length} photo${loaded.length === 1 ? '' : 's'} added. Nothing was uploaded.`;
  } catch {
    statusLabel.textContent = 'That photo could not be read. Try a JPG, PNG or WebP.';
  }
});

async function exportPng() {
  exportButton.disabled = true;
  statusLabel.textContent = 'Rendering your cover…';
  try {
    await fontsReady();
  } catch {
    statusLabel.textContent = '';
  }
  renderCover(canvas, state, { selection: false });
  const { w, h } = state.size;
  const name = `neon-coast-${w}x${h}.png`;
  canvas.toBlob((blob) => {
    exportButton.disabled = false;
    drawNow();
    if (!blob) {
      statusLabel.textContent = 'Export failed. Try another size.';
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    statusLabel.textContent = `Saved ${name}`;
  }, 'image/png');
}

exportButton.addEventListener('click', exportPng);
undoButton.addEventListener('click', undo);
redoButton.addEventListener('click', redo);

document.addEventListener('keydown', (event) => {
  const tag = event.target && event.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (!(event.ctrlKey || event.metaKey)) return;
  if (event.key.toLowerCase() === 'z') {
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
  } else if (event.key.toLowerCase() === 'y') {
    event.preventDefault();
    redo();
  }
});

function parseSize(raw) {
  if (!raw) return null;
  const match = /^(\d{2,4})x(\d{2,4})$/i.exec(raw.trim());
  if (!match) return null;
  const w = Number(match[1]);
  const h = Number(match[2]);
  if (w < 320 || h < 320 || w > 4096 || h > 4096) return null;
  const known = SIZES.find((size) => size.w === w && size.h === h);
  return known || { id: 'custom', label: 'Custom', w, h };
}

async function fontsReady() {
  if (!document.fonts) return;
  await Promise.all([
    document.fonts.load('400 80px Anton'),
    document.fonts.load('400 80px Pacifico'),
  ]);
  await document.fonts.ready;
}

async function setupShot(shot, params) {
  document.body.classList.add(shot === 'cover' ? 'shot-cover' : 'shot-editor');
  state.size = parseSize(params.get('size')) || SIZES[0];
  state.caption = params.get('caption') || DEMO_CAPTION;
  state.subtitle = params.get('subtitle') || DEMO_SUBTITLE;
  state.layout = LAYOUTS[params.get('layout')] ? params.get('layout') : 'quad';
  if (params.has('strength')) {
    const strength = Number(params.get('strength'));
    if (Number.isFinite(strength)) state.gradeStrength = clamp(strength, 0, 100);
  }
  const requested = params.get('photo');
  const chosen = requested === 'boulevard' ? 'boulevard' : 'pier';
  const other = chosen === 'boulevard' ? 'pier' : 'boulevard';
  const results = await Promise.allSettled([
    loadPhoto(sampleUrl(chosen), chosen),
    loadPhoto(sampleUrl(other), other),
  ]);
  state.photos = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
  fillPanels(state.photos);
  captionInput.value = state.caption;
  subtitleInput.value = state.subtitle;
}

async function setupDemo() {
  state.size = SIZES[0];
  state.layout = 'quad';
  state.gradeStrength = 88;
  state.caption = DEMO_CAPTION;
  state.subtitle = DEMO_SUBTITLE;
  const results = await Promise.allSettled([
    loadPhoto(sampleUrl('boulevard'), 'boulevard'),
    loadPhoto(sampleUrl('pier'), 'pier'),
  ]);
  state.photos = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
  fillPanels(state.photos);
  captionInput.value = state.caption;
  subtitleInput.value = state.subtitle;
}

async function waitForPaint() {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

async function boot() {
  buildControls();
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  state.editor = shot !== 'cover';
  try {
    await fontsReady();
  } catch {
    statusLabel.textContent = 'Fonts could not be loaded; using system lettering.';
  }
  if (shot === 'cover' || shot === 'editor') await setupShot(shot, params);
  else await setupDemo();
  syncSelection();
  syncPanelBar();
  updateHistoryButtons();
  drawNow();
  if (shot) {
    await waitForPaint();
    window.__shotReady = true;
    document.documentElement.dataset.shotReady = 'true';
  }
}

boot();
