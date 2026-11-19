const TAU = Math.PI * 2;

export const SIZES = [
  { id: 'square', label: 'Square', w: 1080, h: 1080 },
  { id: 'portrait', label: 'Portrait', w: 1080, h: 1350 },
  { id: 'wide', label: 'Wide', w: 1920, h: 1080 },
];

export const LAYOUTS = {
  quad: { label: 'Collage', count: 4 },
  hero: { label: 'Hero Cut', count: 4 },
  split: { label: 'Split Cut', count: 4 },
  tilt: { label: 'Tilted Snaps', count: 4 },
  nine: { label: 'Nine Mosaic', count: 9 },
  single: { label: 'Full Bleed', count: 1 },
};

export const GRADE_ORDER = ['hot', 'cool', 'gold', 'neon'];

export const GRADES = {
  hot: {
    label: 'Hot Amber',
    swatch: 'linear-gradient(100deg, #150410, #6d1335 42%, #ef5b25 76%, #ffe3a3)',
    accent: '#ff7a2f',
    glow: '#ffb347',
    stops: [
      [0, '#150410'],
      [0.22, '#3a0a2a'],
      [0.48, '#8b1d3d'],
      [0.72, '#e35525'],
      [0.89, '#ffa94b'],
      [1, '#ffe6b0'],
    ],
  },
  cool: {
    label: 'Cool Indigo',
    swatch: 'linear-gradient(100deg, #150410, #331032 42%, #a44654 76%, #ffe4c0)',
    accent: '#e87986',
    glow: '#f4b27a',
    stops: [
      [0, '#150410'],
      [0.24, '#2b0d2e'],
      [0.5, '#4b2350'],
      [0.74, '#a44654'],
      [0.9, '#f19a5c'],
      [1, '#ffe4c0'],
    ],
  },
  gold: {
    label: 'Gold Violet',
    swatch: 'linear-gradient(100deg, #150410, #35102f 42%, #c76539 76%, #ffedb4)',
    accent: '#e0a13c',
    glow: '#ffd27a',
    stops: [
      [0, '#150410'],
      [0.25, '#35102f'],
      [0.5, '#7a2850'],
      [0.72, '#c76539'],
      [0.89, '#f7b658'],
      [1, '#ffedb4'],
    ],
  },
  neon: {
    label: 'Cyan Neon',
    swatch: 'linear-gradient(100deg, #150410, #3b1236 42%, #bb3f68 74%, #ffe8cf)',
    accent: '#e85a8a',
    glow: '#f2a27e',
    saturation: 0.8,
    stops: [
      [0, '#150410'],
      [0.22, '#290c2c'],
      [0.48, '#642050'],
      [0.7, '#bb3f68'],
      [0.87, '#e58c72'],
      [1, '#ffe8cf'],
    ],
  },
};

const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);

const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const parseHex = (hex) => {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
};

const hexToRgba = (hex, alpha) => {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const roundRectPath = (ctx, x, y, w, h, r) => {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

const buildLut = (stops) => {
  const parsed = stops.map(([at, color]) => [at, parseHex(color)]);
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = parsed[0];
    let b = parsed[parsed.length - 1];
    for (let s = 0; s < parsed.length - 1; s++) {
      if (t >= parsed[s][0] && t <= parsed[s + 1][0]) {
        a = parsed[s];
        b = parsed[s + 1];
        break;
      }
    }
    const span = Math.max(0.00001, b[0] - a[0]);
    const mix = clamp((t - a[0]) / span, 0, 1);
    lut[i * 3] = a[1][0] + (b[1][0] - a[1][0]) * mix;
    lut[i * 3 + 1] = a[1][1] + (b[1][1] - a[1][1]) * mix;
    lut[i * 3 + 2] = a[1][2] + (b[1][2] - a[1][2]) * mix;
  }
  return lut;
};

const lutCache = new Map();

const gradeLut = (id) => {
  if (!lutCache.has(id)) {
    const grade = GRADES[id] || GRADES.hot;
    lutCache.set(id, buildLut(grade.stops));
  }
  return lutCache.get(id);
};

let grainCache = null;

const grainCanvas = () => {
  if (grainCache) return grainCache;
  const canvas = document.createElement('canvas');
  canvas.width = 180;
  canvas.height = 180;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(canvas.width, canvas.height);
  let seed = 1337;
  for (let i = 0; i < image.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const value = 128 + ((seed >>> 16) % 128) - 64;
    image.data[i] = value;
    image.data[i + 1] = value;
    image.data[i + 2] = value;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  grainCache = canvas;
  return canvas;
};

const drawStar = (ctx, x, y, radius, points, inset) => {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? radius : radius * inset;
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
};

const place = (x, y, w, h, deg, shape, seed, W, H) => ({
  x: x * W,
  y: y * H,
  w: w * W,
  h: h * H,
  rot: (deg * Math.PI) / 180,
  shape: shape || 'rect',
  seed: seed || 0,
});

function collagePanels(W, H) {
  return [
    place(-0.035, -0.035, 0.615, 0.71, -2.6, 'rect', 1, W, H),
    place(0.565, -0.035, 0.47, 0.33, 3.6, 'torn', 2, W, H),
    place(0.645, 0.265, 0.4, 0.3, -4.2, 'rect', 3, W, H),
    place(0.08, 0.49, 0.34, 0.29, 3.1, 'rect', 4, W, H),
  ];
}

function heroPanels(W, H) {
  return [
    place(-0.05, 0.01, 0.585, 0.715, -1.9, 'rect', 5, W, H),
    place(0.55, -0.04, 0.49, 0.29, 3.2, 'rect', 6, W, H),
    place(0.63, 0.235, 0.41, 0.255, -3.7, 'torn', 7, W, H),
    place(0.535, 0.46, 0.44, 0.245, 2.3, 'rect', 8, W, H),
  ];
}

function splitPanels(W, H) {
  return [
    place(-0.05, -0.045, 0.64, 0.765, -1.4, 'diag', 9, W, H),
    place(0.45, -0.02, 0.61, 0.61, 2.2, 'torn', 10, W, H),
    place(0.055, 0.47, 0.34, 0.3, 4.5, 'rect', 11, W, H),
    place(0.665, 0.445, 0.38, 0.265, -3, 'rect', 12, W, H),
  ];
}

function tiltPanels(W, H) {
  return [
    place(-0.04, 0, 0.59, 0.69, -4.2, 'rect', 13, W, H),
    place(0.5, -0.055, 0.42, 0.36, 5, 'rect', 14, W, H),
    place(0.57, 0.265, 0.46, 0.31, -3.2, 'torn', 15, W, H),
    place(0.16, 0.425, 0.38, 0.33, 4.6, 'rect', 16, W, H),
  ];
}

function ninePanels(W, H) {
  const specs = [
    [-0.06, -0.045, 0.42, 0.3, -3.5],
    [0.3, -0.06, 0.4, 0.29, 2.8],
    [0.63, -0.03, 0.45, 0.31, -1.8],
    [-0.02, 0.21, 0.38, 0.3, 3.4],
    [0.29, 0.2, 0.42, 0.31, -2.5],
    [0.66, 0.225, 0.42, 0.29, 4.1],
    [-0.05, 0.45, 0.4, 0.32, -2.9],
    [0.33, 0.46, 0.4, 0.31, 3.6],
    [0.63, 0.44, 0.42, 0.32, -3.3],
  ];
  return specs.map(([x, y, w, h, deg], index) => place(
    x, y, w, h, deg, index === 4 ? 'torn' : 'rect', 30 + index, W, H,
  ));
}

export function computeLayout(layoutId, w, h) {
  const min = Math.min(w, h);
  const margin = Math.round(min * 0.045);
  const gap = Math.round(min * 0.016);
  const bottomStrip = Math.round(h * 0.956);
  const overlay = layoutId === 'single';
  const bandTop = Math.round(h * (overlay ? 0.585 : 0.675));
  const bandBottom = Math.round(h * 0.953);
  let panels;

  if (layoutId === 'single') panels = [{ x: 0, y: 0, w, h, rot: 0, shape: 'rect', seed: 0 }];
  else if (layoutId === 'hero') panels = heroPanels(w, h);
  else if (layoutId === 'split') panels = splitPanels(w, h);
  else if (layoutId === 'tilt') panels = tiltPanels(w, h);
  else if (layoutId === 'nine') panels = ninePanels(w, h);
  else panels = collagePanels(w, h);

  return {
    id: layoutId,
    panels,
    margin,
    gap,
    bandTop,
    bandBottom,
    overlay,
    radius: 0,
    border: Math.max(4, Math.round(min * 0.008)),
    bottomStrip,
  };
}

const buildPanelPath = (ctx, panel, w, h) => {
  const shape = panel.shape || 'rect';
  ctx.beginPath();
  if (shape === 'diag') {
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    ctx.lineTo(w, h * 0.56);
    ctx.lineTo(w * 0.63, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    return;
  }
  if (shape === 'torn') {
    const steps = 9;
    const seed = panel.seed || 0;
    ctx.moveTo(0, 0);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const wobble = i % 2 === 0 ? 0.02 : 0.1;
      const jitter = ((seed * 7 + i * 5) % 4) * 0.011;
      ctx.lineTo(w * (0.84 + wobble + jitter), h * t);
    }
    ctx.lineTo(w * 0.98, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    return;
  }
  ctx.rect(0, 0, w, h);
};

const drawPhoto = (ctx, photo, panel, w, h) => {
  ctx.save();
  ctx.fillStyle = '#12051e';
  ctx.fillRect(0, 0, w, h);
  if (!photo || !photo.image) {
    const empty = ctx.createLinearGradient(0, 0, w, h);
    empty.addColorStop(0, '#2b0b45');
    empty.addColorStop(0.55, '#611a68');
    empty.addColorStop(1, '#c33b78');
    ctx.fillStyle = empty;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255, 244, 235, 0.82)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.max(14, Math.round(w * 0.055))}px Anton, Impact, sans-serif`;
    ctx.fillText('ADD A PHOTO', w / 2, h / 2);
    ctx.restore();
    return;
  }
  const image = photo.image;
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  const zoom = clamp(panel.zoom || 1, 1, 4);
  const scale = Math.max(w / iw, h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const maxX = Math.max(0, (dw - w) / 2);
  const maxY = Math.max(0, (dh - h) / 2);
  const dx = (w - dw) / 2 + clamp(panel.offsetX || 0, -1, 1) * maxX;
  const dy = (h - dh) / 2 + clamp(panel.offsetY || 0, -1, 1) * maxY;
  ctx.drawImage(image, dx, dy, dw, dh);
  ctx.restore();
};

const applyGrade = (ctx, w, h, gradeId, strength) => {
  const strength01 = clamp(strength, 0, 1);
  if (strength01 <= 0.001) return;
  const lut = gradeLut(gradeId);
  let imageData = null;
  try {
    imageData = ctx.getImageData(0, 0, w, h);
  } catch {
    const grade = GRADES[gradeId] || GRADES.hot;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    const dark = ctx.createLinearGradient(0, 0, w, h);
    dark.addColorStop(0, grade.stops[0][1]);
    dark.addColorStop(0.58, grade.stops[2][1]);
    dark.addColorStop(1, grade.stops[3][1]);
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.42 * strength01;
    ctx.fillStyle = grade.stops[grade.stops.length - 1][1];
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    return;
  }
  const data = imageData.data;
  const grade = GRADES[gradeId] || GRADES.hot;
  const baseLut = gradeLut('hot');
  const unify = 0.4;
  const saturation = grade.saturation ?? 1;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    let l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    l = clamp((l - 0.5) * 1.14 + 0.5, 0, 1);
    const shaped = clamp(l * l * (3 - 2 * l) * 0.68 + l * 0.32, 0, 1);
    const at = (shaped * 255) | 0;
    const protect = 1 - smoothstep(0.7, 0.97, l);
    const amount = strength01 * (0.18 + 0.82 * protect);
    let rr = r + (lut[at * 3] - r) * amount;
    let gg = g + (lut[at * 3 + 1] - g) * amount;
    let bb = b + (lut[at * 3 + 2] - b) * amount;
    rr += (baseLut[at * 3] - rr) * unify;
    gg += (baseLut[at * 3 + 1] - gg) * unify;
    bb += (baseLut[at * 3 + 2] - bb) * unify;
    const y = 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
    rr = y + (rr - y) * saturation;
    gg = y + (gg - y) * saturation;
    bb = y + (bb - y) * saturation;
    const outL = (0.2126 * rr + 0.7152 * gg + 0.0722 * bb) / 255;
    if (outL > 0.74) {
      const t = clamp((outL - 0.74) / 0.26, 0, 1);
      const targetL = 0.74 + (1 - Math.pow(1 - t, 1.6)) * 0.16;
      const scale = targetL / Math.max(0.001, outL);
      rr *= scale;
      gg *= scale;
      bb *= scale;
      const warm = t * 0.35;
      rr += (255 - rr) * warm * 0.16;
      gg += (228 - gg) * warm * 0.1;
      bb += (198 - bb) * warm * 0.12;
    }
    data[i] = rr;
    data[i + 1] = gg;
    data[i + 2] = bb;
  }
  ctx.putImageData(imageData, 0, 0);
};

const drawPanelTexture = (ctx, w, h, gradeId, index) => {
  const grade = GRADES[gradeId] || GRADES.hot;
  const min = Math.min(w, h);
  const leakX = index % 2 === 0 ? w * 0.84 : w * 0.16;
  const leakY = index % 3 === 0 ? h * 0.14 : h * 0.86;
  const leak = ctx.createRadialGradient(leakX, leakY, 0, leakX, leakY, min * 0.95);
  leak.addColorStop(0, hexToRgba(grade.glow, 0.4));
  leak.addColorStop(0.45, hexToRgba(grade.accent, 0.12));
  leak.addColorStop(1, hexToRgba(grade.accent, 0));
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = leak;
  ctx.fillRect(0, 0, w, h);

  const streak = ctx.createLinearGradient(0, 0, w, h);
  streak.addColorStop(0, 'rgba(255,255,255,0)');
  streak.addColorStop(0.46, 'rgba(255, 226, 206, 0)');
  streak.addColorStop(0.53, 'rgba(255, 226, 206, 0.18)');
  streak.addColorStop(0.62, 'rgba(255, 226, 206, 0)');
  streak.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = streak;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  const vignette = ctx.createRadialGradient(w * 0.5, h * 0.46, min * 0.2, w * 0.5, h * 0.5, min * 0.82);
  vignette.addColorStop(0, 'rgba(8, 1, 18, 0)');
  vignette.addColorStop(0.62, 'rgba(8, 1, 18, 0.12)');
  vignette.addColorStop(1, 'rgba(8, 1, 18, 0.52)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.11;
  const pattern = ctx.createPattern(grainCanvas(), 'repeat');
  if (pattern) {
    ctx.translate((index * 37) % 180, (index * 61) % 180);
    ctx.fillStyle = pattern;
    ctx.fillRect(-180, -180, w + 360, h + 360);
  }
  ctx.restore();

  const glow = ctx.createLinearGradient(0, 0, 0, h);
  glow.addColorStop(0, 'rgba(255, 236, 220, 0.12)');
  glow.addColorStop(0.28, 'rgba(255, 236, 220, 0)');
  glow.addColorStop(1, 'rgba(20, 0, 30, 0.18)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
};

const paintPanel = (panel, photo, rect, gradeId, index, options) => {
  const w = Math.max(2, Math.round(rect.w));
  const h = Math.max(2, Math.round(rect.h));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  buildPanelPath(ctx, rect, w, h);
  ctx.save();
  ctx.clip();
  drawPhoto(ctx, photo, panel, w, h);
  applyGrade(ctx, w, h, gradeId, options.strength);
  drawPanelTexture(ctx, w, h, gradeId, index);
  ctx.restore();
  buildPanelPath(ctx, rect, w, h);
  ctx.lineWidth = options.border * 2;
  ctx.strokeStyle = '#050108';
  ctx.stroke();
  return canvas;
};

const composePanel = (ctx, canvas, rect, shadowScale) => {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rect.rot || 0);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.62)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = shadowScale * 0.38;
  ctx.shadowOffsetY = shadowScale * 0.55;
  ctx.drawImage(canvas, -rect.w / 2, -rect.h / 2, rect.w, rect.h);
  ctx.restore();
};

const drawBackdrop = (ctx, w, h, layout) => {
  const min = Math.min(w, h);
  const base = ctx.createLinearGradient(0, 0, w * 0.7, h);
  base.addColorStop(0, '#070313');
  base.addColorStop(0.36, '#1b062c');
  base.addColorStop(0.72, '#360b39');
  base.addColorStop(1, '#0b0318');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  const sunX = w * 0.68;
  const sunY = h * 0.36;
  const sunR = min * 0.5;
  ctx.save();
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, TAU);
  ctx.clip();
  const sun = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  sun.addColorStop(0, '#ffe28a');
  sun.addColorStop(0.38, '#ff9a4d');
  sun.addColorStop(0.72, '#ff3f8e');
  sun.addColorStop(1, '#6d1a78');
  ctx.fillStyle = sun;
  ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);
  ctx.fillStyle = 'rgba(9, 2, 17, 0.88)';
  const bands = 9;
  for (let i = 0; i < bands; i++) {
    const gap = i * min * 0.034;
    ctx.fillRect(sunX - sunR, sunY + sunR * 0.08 + gap, sunR * 2, Math.max(2, min * 0.006 + i * min * 0.002));
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = '#ff77b8';
  ctx.lineWidth = Math.max(1, min * 0.0018);
  for (let i = 0; i < 6; i++) {
    const y = h * 0.03 + i * min * 0.07;
    ctx.beginPath();
    ctx.moveTo(-w * 0.05, y + h * 0.2);
    ctx.lineTo(w * 1.05, y - h * 0.08);
    ctx.stroke();
  }
  ctx.restore();

  if (!layout.overlay) {
    const band = ctx.createLinearGradient(0, layout.bandTop, 0, h);
    band.addColorStop(0, 'rgba(17, 4, 30, 0)');
    band.addColorStop(0.24, 'rgba(21, 4, 34, 0.6)');
    band.addColorStop(1, 'rgba(8, 2, 15, 0.96)');
    ctx.fillStyle = band;
    ctx.fillRect(0, layout.bandTop, w, h - layout.bandTop);
  }
};

const drawWash = (ctx, w, h) => {
  const min = Math.min(w, h);
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  const wash = ctx.createLinearGradient(0, 0, w, h);
  wash.addColorStop(0, 'rgba(38, 104, 160, 0.42)');
  wash.addColorStop(0.4, 'rgba(120, 40, 160, 0.18)');
  wash.addColorStop(0.72, 'rgba(255, 112, 52, 0.34)');
  wash.addColorStop(1, 'rgba(255, 186, 96, 0.2)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.1;
  const pattern = ctx.createPattern(grainCanvas(), 'repeat');
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();

  const vignette = ctx.createRadialGradient(w * 0.5, h * 0.44, min * 0.26, w * 0.5, h * 0.5, min * 0.86);
  vignette.addColorStop(0, 'rgba(5, 1, 12, 0)');
  vignette.addColorStop(0.62, 'rgba(5, 1, 12, 0.16)');
  vignette.addColorStop(1, 'rgba(5, 1, 12, 0.56)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
};

const titleMetrics = (ctx, text, size, tracking, wordGap) => {
  ctx.font = `${size}px Anton, Impact, sans-serif`;
  const spaceWidth = ctx.measureText(' ').width + wordGap;
  const glyphs = Array.from(text).map((ch) => ({
    ch,
    w: ch === ' ' ? spaceWidth : ctx.measureText(ch).width,
  }));
  const width = glyphs.reduce((sum, glyph) => sum + glyph.w, 0) + tracking * Math.max(0, glyphs.length - 1);
  return { glyphs, width };
};

const wrapWords = (ctx, text, size, maxWidth, tracking, wordGap) => {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    const fits = titleMetrics(ctx, next, size, tracking, wordGap).width <= maxWidth;
    if (!line || fits) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
};

const fitTitle = (ctx, text, maxWidth, maxHeight) => {
  let best = null;
  for (let count = 1; count <= 3; count++) {
    let low = 12;
    let high = Math.max(20, Math.min(maxHeight / count / 0.94, maxWidth * 1.25));
    for (let step = 0; step < 24; step++) {
      const size = (low + high) / 2;
      const tracking = size * 0.02;
      const wordGap = size * 0.06;
      const lines = wrapWords(ctx, text, size, maxWidth, tracking, wordGap);
      const fitsWidth = lines.every((line) => titleMetrics(ctx, line, size, tracking, wordGap).width <= maxWidth);
      const fitsHeight = lines.length * size * 0.94 <= maxHeight;
      if (lines.length <= count && lines.length > 0 && fitsWidth && fitsHeight) {
        if (!best || size > best.size) best = { size, lines };
        low = size;
      } else {
        high = size;
      }
    }
  }
  if (!best) {
    const lines = wrapWords(ctx, text, 12, maxWidth, 0.24, 0.72);
    return { size: 12, lines: lines.length ? lines : [text] };
  }
  return best;
};

const drawTitleLine = (ctx, line, cx, y, size, maxWidth, gradient) => {
  const tracking = size * 0.02;
  const wordGap = size * 0.06;
  ctx.save();
  ctx.font = `${size}px Anton, Impact, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  const { glyphs, width } = titleMetrics(ctx, line, size, tracking, wordGap);
  const limit = Math.max(40, maxWidth - size * 0.14);
  const squeeze = width > limit ? limit / Math.max(1, width) : 1;
  ctx.translate(cx, y);
  ctx.scale(squeeze, 1);
  let cursor = -width / 2;
  const positions = glyphs.map(({ ch, w }) => {
    const x = cursor;
    cursor += w + tracking;
    return { ch, x };
  });
  const drawEvery = (method, dx, dy) => {
    for (const { ch, x } of positions) ctx[method](ch, x + dx, dy);
  };
  ctx.fillStyle = '#2a041d';
  drawEvery('fillText', size * 0.045, size * 0.07);
  ctx.lineWidth = Math.max(5, size * 0.125);
  ctx.strokeStyle = '#050108';
  drawEvery('strokeText', 0, 0);
  ctx.fillStyle = gradient;
  drawEvery('fillText', 0, 0);
  ctx.lineWidth = Math.max(1, size * 0.012);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.34)';
  drawEvery('strokeText', 0, 0);
  ctx.restore();
};

const drawTitle = (ctx, state, layout, w, h) => {
  const min = Math.min(w, h);
  const bandH = layout.bandBottom - layout.bandTop;
  const maxWidth = w - layout.margin * 2 - min * 0.1;
  const caption = (state.caption || 'Neon Coast').trim().toUpperCase() || 'NEON COAST';
  const titleTop = layout.bandTop + bandH * 0.225;
  const titleHeight = bandH * 0.56;
  const fit = fitTitle(ctx, caption, maxWidth, titleHeight);
  const size = fit.size;
  const lines = fit.lines.length ? fit.lines : [caption];
  const lineHeight = size * 0.94;
  const blockH = lines.length * lineHeight;
  const startY = titleTop + (titleHeight - blockH) / 2 + lineHeight / 2;
  const cx = w / 2;
  const accent = '#ff7a3d';

  const subSize = clamp(bandH * 0.14, 21, min * 0.058);
  const blockTop = startY - lineHeight / 2 - size * 0.48;
  const subtitle = (state.subtitle || 'a neon coast story').trim();
  let subY = blockTop - subSize * 0.78;
  subY = Math.max(layout.bandTop + subSize * 0.78, subY);

  ctx.save();
  ctx.font = `${subSize}px Pacifico, cursive`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const subWidth = ctx.measureText(subtitle).width;
  const subSqueeze = subWidth > maxWidth * 0.7 ? (maxWidth * 0.7) / Math.max(1, subWidth) : 1;
  ctx.save();
  ctx.translate(cx, subY);
  ctx.scale(subSqueeze, 1);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#1c0318';
  ctx.fillText(subtitle, subSize * 0.05, subSize * 0.08);
  ctx.lineWidth = Math.max(4, subSize * 0.2);
  ctx.strokeStyle = '#090110';
  ctx.strokeText(subtitle, 0, 0);
  ctx.fillStyle = '#fff6fd';
  ctx.fillText(subtitle, 0, 0);
  ctx.restore();

  ctx.strokeStyle = 'rgba(255, 198, 230, 0.76)';
  ctx.lineWidth = Math.max(1, subSize * 0.045);
  const gap = subSize * 0.55;
  const half = Math.min(subWidth, maxWidth * 0.7) / 2;
  const leftEnd = cx - half - gap - subSize * 0.3;
  const rightStart = cx + half + gap + subSize * 0.3;
  if (leftEnd > layout.margin + min * 0.02) {
    ctx.beginPath();
    ctx.moveTo(layout.margin + min * 0.02, subY);
    ctx.lineTo(leftEnd - subSize * 0.3, subY);
    ctx.stroke();
    drawStar(ctx, leftEnd, subY, subSize * 0.13, 4, 0.36);
    ctx.fillStyle = accent;
    ctx.fill();
  }
  if (rightStart < w - layout.margin - min * 0.02) {
    ctx.beginPath();
    ctx.moveTo(rightStart + subSize * 0.3, subY);
    ctx.lineTo(w - layout.margin - min * 0.02, subY);
    ctx.stroke();
    drawStar(ctx, rightStart, subY, subSize * 0.13, 4, 0.36);
    ctx.fillStyle = accent;
    ctx.fill();
  }
  ctx.restore();

  const gradient = ctx.createLinearGradient(0, startY - size * 0.55, 0, startY + size * 0.55 + (lines.length - 1) * lineHeight);
  gradient.addColorStop(0, '#fffdf6');
  gradient.addColorStop(0.55, '#fff1dd');
  gradient.addColorStop(1, '#ffc89f');
  for (let i = 0; i < lines.length; i++) {
    drawTitleLine(ctx, lines[i], cx, startY + i * lineHeight, size, maxWidth, gradient);
  }
};

const drawPlate = (ctx, w, h, layout) => {
  const min = Math.min(w, h);
  const top = layout.bandTop;
  const accent = '#ff7a3d';
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, top + min * 0.02);
  ctx.lineTo(w * 0.18, top + min * 0.004);
  ctx.lineTo(w * 0.52, top - min * 0.006);
  ctx.lineTo(w, top + min * 0.018);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  const plate = ctx.createLinearGradient(0, top, 0, layout.bandBottom);
  plate.addColorStop(0, 'rgba(9, 3, 17, 0.97)');
  plate.addColorStop(0.5, 'rgba(13, 4, 22, 0.985)');
  plate.addColorStop(1, 'rgba(4, 1, 9, 1)');
  ctx.fillStyle = plate;
  ctx.fill();

  const bleed = ctx.createLinearGradient(0, top - min * 0.012, 0, top + min * 0.024);
  bleed.addColorStop(0, 'rgba(255, 94, 32, 0)');
  bleed.addColorStop(0.55, 'rgba(255, 94, 32, 0.8)');
  bleed.addColorStop(1, 'rgba(255, 170, 90, 0)');
  ctx.strokeStyle = bleed;
  ctx.lineWidth = Math.max(3, min * 0.006);
  ctx.beginPath();
  ctx.moveTo(0, top + min * 0.022);
  ctx.lineTo(w * 0.18, top + min * 0.006);
  ctx.lineTo(w * 0.52, top - min * 0.004);
  ctx.lineTo(w, top + min * 0.02);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 122, 61, 0.65)';
  ctx.lineWidth = Math.max(2, min * 0.003);
  ctx.beginPath();
  ctx.moveTo(layout.margin, layout.bandBottom - min * 0.012);
  ctx.lineTo(w - layout.margin, layout.bandBottom - min * 0.012);
  ctx.stroke();

  ctx.globalAlpha = 0.055;
  ctx.strokeStyle = '#ffd0a0';
  ctx.lineWidth = Math.max(1, min * 0.0015);
  for (let i = -2; i < 15; i++) {
    ctx.beginPath();
    ctx.moveTo(w * 0.02 + i * min * 0.08, h);
    ctx.lineTo(w * 0.12 + i * min * 0.08, top);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = accent;
  ctx.fillRect(0, top - min * 0.004, min * 0.04, min * 0.012);
};

const drawBadge = (ctx, w, h, layout) => {
  const min = Math.min(w, h);
  const bw = min * 0.244;
  const bh = min * 0.066;
  const x = layout.margin * 0.72;
  const y = layout.margin * 0.66;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.035);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = min * 0.012;
  ctx.shadowOffsetY = min * 0.008;
  roundRectPath(ctx, 0, 0, bw, bh, bh * 0.24);
  ctx.fillStyle = 'rgba(7, 1, 14, 0.9)';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#ffb26b';
  ctx.lineWidth = Math.max(1.5, min * 0.0026);
  ctx.stroke();
  drawStar(ctx, bh * 0.52, bh / 2, bh * 0.28, 5, 0.42);
  ctx.fillStyle = '#ffb26b';
  ctx.fill();
  drawStar(ctx, bh * 0.52, bh / 2, bh * 0.13, 5, 0.4);
  ctx.fillStyle = '#14041e';
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff8ee';
  ctx.font = `${bh * 0.34}px Anton, Impact, sans-serif`;
  ctx.fillText('NC STUDIO', bh * 1.0, bh * 0.37);
  ctx.fillStyle = 'rgba(255, 226, 240, 0.82)';
  ctx.font = `600 ${Math.max(8, bh * 0.16)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText('ORIGINAL COVER SERIES', bh * 1.01, bh * 0.72);
  ctx.restore();
};

const drawRating = (ctx, w, h, layout) => {
  const min = Math.min(w, h);
  const size = min * 0.082;
  const x = layout.margin + min * 0.006;
  const y = layout.bandBottom - min * 0.012 - size;
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  ctx.rotate(-0.028);
  ctx.fillStyle = '#08020e';
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.strokeStyle = '#ffb26b';
  ctx.lineWidth = Math.max(2, min * 0.004);
  ctx.strokeRect(-size / 2 + 2, -size / 2 + 2, size - 4, size - 4);
  ctx.strokeStyle = 'rgba(255, 178, 107, 0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-size / 2 + min * 0.009, -size / 2 + min * 0.009, size - min * 0.018, size - min * 0.018);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffb26b';
  ctx.font = `${size * 0.17}px Anton, Impact, sans-serif`;
  ctx.fillText('NC', -size / 2 + size * 0.12, -size / 2 + size * 0.22);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff7ec';
  ctx.font = `${size * 0.54}px Anton, Impact, sans-serif`;
  ctx.fillText('18', 0, size * 0.08);
  ctx.fillStyle = 'rgba(255, 247, 236, 0.72)';
  ctx.font = `700 ${size * 0.12}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText('COAST RATED', 0, size * 0.36);
  ctx.restore();
};

const drawPriceSticker = (ctx, w, h, layout) => {
  const min = Math.min(w, h);
  const pw = min * 0.176;
  const ph = min * 0.082;
  const x = w - layout.margin - pw - min * 0.004;
  const y = layout.bandBottom - ph - min * 0.026;
  ctx.save();
  ctx.translate(x + pw / 2, y + ph / 2);
  ctx.rotate(-0.09);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = min * 0.007;
  ctx.shadowOffsetY = min * 0.009;
  ctx.fillStyle = '#fff4dd';
  ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#0a020c';
  ctx.lineWidth = Math.max(2, min * 0.0032);
  ctx.strokeRect(-pw / 2, -ph / 2, pw, ph);
  ctx.strokeStyle = 'rgba(196, 44, 74, 0.8)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-pw / 2 + min * 0.008, -ph / 2 + min * 0.008, pw - min * 0.016, ph - min * 0.016);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#10030a';
  ctx.font = `400 ${ph * 0.48}px Anton, Impact, sans-serif`;
  ctx.fillText('$6.99', 0, -ph * 0.08);
  ctx.fillStyle = 'rgba(20, 3, 10, 0.62)';
  ctx.font = `700 ${ph * 0.15}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText('TAX FREE', 0, ph * 0.3);
  ctx.restore();
};

const drawStrip = (ctx, w, h, layout) => {
  const min = Math.min(w, h);
  const stripTop = layout.bottomStrip;
  const stripH = h - stripTop;
  const x = layout.margin;
  const sw = w - layout.margin * 2;
  ctx.fillStyle = 'rgba(5, 1, 10, 0.98)';
  ctx.fillRect(0, stripTop, w, stripH);
  const grad = ctx.createLinearGradient(0, 0, sw, 0);
  grad.addColorStop(0, '#ff7a3d');
  grad.addColorStop(0.35, 'rgba(255, 240, 230, 0.9)');
  grad.addColorStop(0.7, '#ff4fa3');
  grad.addColorStop(1, 'rgba(255, 160, 210, 0.7)');
  ctx.fillStyle = grad;
  ctx.fillRect(x, stripTop, sw, Math.max(1, min * 0.002));
  ctx.textBaseline = 'middle';
  const textY = stripTop + stripH * 0.56;
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255, 246, 236, 0.9)';
  ctx.font = `${Math.max(11, Math.min(stripH * 0.32, min * 0.016))}px Anton, Impact, sans-serif`;
  ctx.fillText('NEON COAST STUDIO', x + min * 0.014, textY);
  ctx.fillStyle = 'rgba(255, 238, 228, 0.72)';
  ctx.textAlign = 'right';
  ctx.font = `700 ${Math.max(10, Math.min(stripH * 0.28, min * 0.015))}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText('OFFLINE ORIGINAL  ·  DIGITAL DELUXE', x + sw - min * 0.014, textY);
};

const drawFrame = (ctx, w, h) => {
  const min = Math.min(w, h);
  const inset = Math.max(3, min * 0.007);
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 232, 210, 0.34)';
  ctx.lineWidth = Math.max(1, min * 0.0016);
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  ctx.strokeStyle = 'rgba(255, 146, 86, 0.38)';
  ctx.lineWidth = Math.max(1, min * 0.0012);
  const hair = inset + Math.max(2, min * 0.004);
  ctx.strokeRect(hair, hair, w - hair * 2, h - hair * 2);
  ctx.strokeStyle = 'rgba(255, 122, 61, 0.9)';
  ctx.lineWidth = Math.max(2, min * 0.004);
  const corner = min * 0.055;
  ctx.beginPath();
  ctx.moveTo(inset, inset + corner);
  ctx.lineTo(inset, inset);
  ctx.lineTo(inset + corner, inset);
  ctx.moveTo(w - inset - corner, inset);
  ctx.lineTo(w - inset, inset);
  ctx.lineTo(w - inset, inset + corner);
  ctx.moveTo(inset, h - inset - corner);
  ctx.lineTo(inset, h - inset);
  ctx.lineTo(inset + corner, h - inset);
  ctx.moveTo(w - inset - corner, h - inset);
  ctx.lineTo(w - inset, h - inset);
  ctx.lineTo(w - inset, h - inset - corner);
  ctx.stroke();
  ctx.restore();
};

const drawSelection = (ctx, panel, min) => {
  const cx = panel.x + panel.w / 2;
  const cy = panel.y + panel.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(panel.rot || 0);
  ctx.translate(-panel.w / 2, -panel.h / 2);
  buildPanelPath(ctx, panel, panel.w, panel.h);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.lineWidth = Math.max(8, min * 0.014);
  ctx.stroke();
  ctx.strokeStyle = '#79f7ff';
  ctx.lineWidth = Math.max(2, min * 0.005);
  ctx.setLineDash([min * 0.022, min * 0.014]);
  ctx.stroke();
  ctx.restore();
};

export function renderCover(canvas, state, options = {}) {
  const w = state.size.w;
  const h = state.size.h;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d');
  const layout = computeLayout(state.layout, w, h);
  const min = Math.min(w, h);
  ctx.clearRect(0, 0, w, h);
  drawBackdrop(ctx, w, h, layout);

  const strength = clamp((state.gradeStrength ?? 88) / 100, 0, 1);
  const shadowScale = min * 0.028;
  layout.panels.forEach((rect, index) => {
    const panel = state.panels[index] || { photoId: null, zoom: 1, offsetX: 0, offsetY: 0 };
    const photo = state.photos.find((item) => item.id === panel.photoId) || null;
    const gradeId = GRADES[panel.grade] ? panel.grade : GRADE_ORDER[index % GRADE_ORDER.length];
    const painted = paintPanel(panel, photo, rect, gradeId, index, {
      strength,
      border: layout.border,
    });
    composePanel(ctx, painted, rect, shadowScale);
  });

  drawWash(ctx, w, h);

  if (layout.overlay) {
    const scrim = ctx.createLinearGradient(0, h * 0.34, 0, h);
    scrim.addColorStop(0, 'rgba(8, 1, 18, 0)');
    scrim.addColorStop(0.34, 'rgba(8, 1, 18, 0.28)');
    scrim.addColorStop(0.62, 'rgba(8, 1, 18, 0.7)');
    scrim.addColorStop(1, 'rgba(8, 1, 18, 0.97)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, w, h);
    const top = ctx.createLinearGradient(0, 0, 0, h * 0.24);
    top.addColorStop(0, 'rgba(8, 1, 18, 0.5)');
    top.addColorStop(1, 'rgba(8, 1, 18, 0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, w, h * 0.24);
  }

  drawPlate(ctx, w, h, layout);
  drawTitle(ctx, state, layout, w, h);
  drawRating(ctx, w, h, layout);
  drawPriceSticker(ctx, w, h, layout);
  drawBadge(ctx, w, h, layout);
  drawStrip(ctx, w, h, layout);
  drawFrame(ctx, w, h);

  if (options.selection && layout.panels[state.selected]) {
    drawSelection(ctx, layout.panels[state.selected], min);
  }
  return layout;
}

export function layoutOf(layoutId, w, h) {
  return computeLayout(layoutId, w, h);
}

export function pointInPanel(rect, x, y) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const angle = -(rect.rot || 0);
  const dx = x - cx;
  const dy = y - cy;
  const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
  const ry = dx * Math.sin(angle) + dy * Math.cos(angle);
  return Math.abs(rx) <= rect.w / 2 && Math.abs(ry) <= rect.h / 2;
}

export function tapPanels(state) {
  const layout = computeLayout(state.layout, state.size.w, state.size.h);
  const count = layout.panels.length;
  const next = [];
  for (let i = 0; i < count; i++) {
    const existing = state.panels[i];
    next.push(existing || { photoId: null, zoom: 1, offsetX: 0, offsetY: 0 });
  }
  return next;
}
