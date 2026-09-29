// ─────────────────────────────────────────────────────────────────────────────
// Procedural materials — canvas-generated colour + bump maps.
//
// No network assets: every surface is painted at runtime from tileable value
// noise. The painted canvases are near-white luminance patterns, so a single
// canvas serves many materials — the MeshStandardMaterial `color` does the
// tinting (map is multiplied by color).
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { QUALITY } from './quality.js';

const S = QUALITY.texSize;

// ─── Noise ───────────────────────────────────────────────────────────────────

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tileable value noise: low-res lattice sampled with smoothstep, wraps on edges.
function valueNoise(size, cells, rnd) {
  const g = new Float32Array(cells * cells);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const out = new Float32Array(size * size);
  const scale = cells / size;
  for (let y = 0; y < size; y++) {
    const fy = y * scale, y0 = Math.floor(fy), ty = fy - y0;
    const sy = ty * ty * (3 - 2 * ty);
    const r0 = (y0 % cells) * cells, r1 = ((y0 + 1) % cells) * cells;
    for (let x = 0; x < size; x++) {
      const fx = x * scale, x0 = Math.floor(fx), tx = fx - x0;
      const sx = tx * tx * (3 - 2 * tx);
      const c0 = x0 % cells, c1 = (x0 + 1) % cells;
      const top = g[r0 + c0] + (g[r0 + c1] - g[r0 + c0]) * sx;
      const bot = g[r1 + c0] + (g[r1 + c1] - g[r1 + c0]) * sx;
      out[y * size + x] = top + (bot - top) * sy;
    }
  }
  return out;
}

function fbm(size, rnd, octaves = 4, cells = 5) {
  const out = new Float32Array(size * size);
  let amp = 1, total = 0, c = cells;
  for (let o = 0; o < octaves && c <= size; o++) {
    const n = valueNoise(size, c, rnd);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    total += amp; amp *= 0.5; c *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

// ─── Canvas plumbing ─────────────────────────────────────────────────────────

function toCanvases(size, rgba, height) {
  const color = document.createElement('canvas');
  color.width = color.height = size;
  color.getContext('2d').putImageData(new ImageData(rgba, size, size), 0, 0);

  const bump = document.createElement('canvas');
  bump.width = bump.height = size;
  const bd = new Uint8ClampedArray(size * size * 4);
  for (let i = 0, p = 0; i < height.length; i++, p += 4) {
    bd[p] = bd[p + 1] = bd[p + 2] = height[i];
    bd[p + 3] = 255;
  }
  bump.getContext('2d').putImageData(new ImageData(bd, size, size), 0, 0);

  return { color, bump };
}

// ─── Surface painters (near-white; tinted later by material.color) ───────────

const BASE = 244;

// Troweled render / plaster / concrete: broad mottling + fine grit.
function paintStucco(size, seed, { mottle = 0.14, grit = 20, cells = 5 } = {}) {
  const n = fbm(size, mulberry32(seed), 4, cells);
  const g = mulberry32(seed ^ 0x9e3779b9);
  const rgba = new Uint8ClampedArray(size * size * 4);
  const h = new Uint8ClampedArray(size * size);
  for (let i = 0, p = 0; i < n.length; i++, p += 4) {
    const m = (n[i] - 0.5) * 2 * mottle;
    const s = (g() - 0.5) * grit;
    const v = BASE * (1 + m) + s;
    rgba[p] = v; rgba[p + 1] = v * 0.995; rgba[p + 2] = v * 0.985; rgba[p + 3] = 255;
    h[i] = 128 + m * 190 + s * 1.6;
  }
  return toCanvases(size, rgba, h);
}

// Sawn planks running along U, with seams, per-plank tone and grain lines.
function paintPlanks(size, seed, rows = 5) {
  const rnd = mulberry32(seed);
  const n = fbm(size, rnd, 3, 8);
  const g = mulberry32(seed ^ 0x51ab7c);
  const tone = Array.from({ length: rows }, () => 0.86 + rnd() * 0.26);
  const rowH = size / rows;
  const rgba = new Uint8ClampedArray(size * size * 4);
  const h = new Uint8ClampedArray(size * size);
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / rowH);
    const inRow = y - row * rowH;
    const seam = inRow < 1.6 || inRow > rowH - 1.6;
    // sample the noise squashed in Y so the grain runs along the plank
    const gy = (Math.floor(y * 3) % size) * size;
    for (let x = 0; x < size; x++) {
      const i = y * size + x, p = i * 4;
      const gn = n[gy + x];
      let k = tone[row] * (0.9 + gn * 0.2) + (g() - 0.5) * 0.03;
      k *= 1 - 0.08 * Math.abs(Math.sin(x * 0.11 + gn * 9));
      if (seam) k *= 0.58;
      rgba[p] = BASE * k; rgba[p + 1] = BASE * k * 0.98; rgba[p + 2] = BASE * k * 0.95;
      rgba[p + 3] = 255;
      h[i] = seam ? 30 : 100 + gn * 100;
    }
  }
  return toCanvases(size, rgba, h);
}

// Laid units (roof tiles, stone, floor tile): grid with recessed joints.
function paintTiles(size, seed, cols = 4, rows = 4, joint = 0.62) {
  const rnd = mulberry32(seed);
  const n = fbm(size, rnd, 3, 6);
  const shade = Array.from({ length: cols * rows }, () => 0.86 + rnd() * 0.26);
  const cw = size / cols, ch = size / rows;
  const rgba = new Uint8ClampedArray(size * size * 4);
  const h = new Uint8ClampedArray(size * size);
  for (let y = 0; y < size; y++) {
    const cy = Math.floor(y / ch);
    const ey = Math.min(y - cy * ch, (cy + 1) * ch - y);
    for (let x = 0; x < size; x++) {
      const i = y * size + x, p = i * 4;
      const cx = Math.floor(x / cw);
      const ex = Math.min(x - cx * cw, (cx + 1) * cw - x);
      const inJoint = ex < 2 || ey < 2;
      let k = shade[cy * cols + cx] * (0.92 + n[i] * 0.16);
      if (inJoint) k *= joint;
      rgba[p] = BASE * k; rgba[p + 1] = BASE * k * 0.99; rgba[p + 2] = BASE * k * 0.97;
      rgba[p + 3] = 255;
      h[i] = inJoint ? 20 : 150 + n[i] * 80;
    }
  }
  return toCanvases(size, rgba, h);
}

// Coarse organic ground cover.
function paintRough(size, seed) {
  const rnd = mulberry32(seed);
  const n = fbm(size, rnd, 4, 10);
  const g = mulberry32(seed ^ 0x77aa);
  const rgba = new Uint8ClampedArray(size * size * 4);
  const h = new Uint8ClampedArray(size * size);
  for (let i = 0, p = 0; i < n.length; i++, p += 4) {
    const k = 0.72 + n[i] * 0.5 + (g() - 0.5) * 0.14;
    rgba[p] = BASE * k * 0.96; rgba[p + 1] = BASE * k; rgba[p + 2] = BASE * k * 0.82;
    rgba[p + 3] = 255;
    h[i] = 90 + n[i] * 120;
  }
  return toCanvases(size, rgba, h);
}

// Woven cloth.
function paintWeave(size, seed) {
  const n = fbm(size, mulberry32(seed), 3, 14);
  const rgba = new Uint8ClampedArray(size * size * 4);
  const h = new Uint8ClampedArray(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x, p = i * 4;
      const w = Math.sin(x * 1.55) * Math.sin(y * 1.55);
      const k = 0.94 + w * 0.05 + (n[i] - 0.5) * 0.07;
      rgba[p] = BASE * k; rgba[p + 1] = BASE * k * 0.995; rgba[p + 2] = BASE * k * 0.99;
      rgba[p + 3] = 255;
      h[i] = 128 + w * 70;
    }
  }
  return toCanvases(size, rgba, h);
}

// ─── Canvas set (painted once) ───────────────────────────────────────────────

const CV = {
  stucco:   paintStucco(S, 1181, { mottle: 0.09, grit: 24, cells: 9 }),
  smooth:   paintStucco(S, 5507, { mottle: 0.07, grit: 10, cells: 4 }),
  plank:    paintPlanks(S, 3391, 5),
  tile:     paintTiles(S, 7717, 4, 4, 0.6),
  brick:    paintTiles(S, 4409, 6, 10, 0.5),
  rough:    paintRough(S, 9133),
  weave:    paintWeave(S, 2273),
};

// ─── Material factory ────────────────────────────────────────────────────────

function tex(canvas, repeat, srgb) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = QUALITY.aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// `repeat` is a scalar or [u, v]. `bump` is the bump scale in metres.
function mat(set, color, { repeat = 2, bump = 0.02, rough = 0.9, rougheny = 0, ...rest } = {}) {
  const r = Array.isArray(repeat) ? repeat : [repeat, repeat];
  const m = new THREE.MeshStandardMaterial({
    color,
    map: tex(set.color, r, true),
    bumpMap: tex(set.bump, r, false),
    bumpScale: bump,
    roughness: rough,
    metalness: 0,
    ...rest,
  });
  if (rougheny) {
    // reuse the height map to break up specular response
    m.roughnessMap = tex(set.bump, r, false);
  }
  return m;
}

export const MAT = {
  // ── Envelope ──
  adobe:     mat(CV.stucco, '#D2B279', { repeat: [6, 4], bump: 0.03, rough: 0.94, rougheny: 1 }),
  adobeSide: mat(CV.stucco, '#C7AA8A', { repeat: [6, 4], bump: 0.03, rough: 0.94, rougheny: 1 }),
  concrete:  mat(CV.smooth, '#D6CEC1', { repeat: [4, 4], bump: 0.012, rough: 0.85 }),
  ceiling:   mat(CV.smooth, '#F2E7D5', { repeat: [4, 4], bump: 0.008, rough: 0.9 }),
  stone:     mat(CV.brick,  '#988B7E', { repeat: [3, 3], bump: 0.04, rough: 0.96, rougheny: 1 }),

  // ── Wood ──
  wood:      mat(CV.plank, '#7A4B2B', { repeat: [3, 1], bump: 0.014, rough: 0.72 }),
  woodLight: mat(CV.plank, '#BA8859', { repeat: [3, 1], bump: 0.014, rough: 0.7 }),
  woodFloor: mat(CV.plank, '#C6955F', { repeat: [8, 6], bump: 0.016, rough: 0.62, rougheny: 1 }),

  // ── Finishes ──
  tile:      mat(CV.tile,  '#CE8261', { repeat: [6, 4], bump: 0.03, rough: 0.82 }),
  grass:     mat(CV.rough, '#5F8038', { repeat: [28, 28], bump: 0.03, rough: 1 }),
  fabric:    mat(CV.weave, '#DDD6C7', { repeat: [3, 3], bump: 0.008, rough: 0.96 }),
  white:     mat(CV.smooth, '#F4F1EB', { repeat: [2, 2], bump: 0.004, rough: 0.45 }),
  kitchenRed: mat(CV.smooth, '#A93A30', { repeat: [2, 2], bump: 0.004, rough: 0.42 }),
  purple:    new THREE.MeshStandardMaterial({ color: '#8B5FBF', roughness: 0.9 }),
  poolGreen: mat(CV.weave, '#2FA33B', { repeat: [6, 3], bump: 0.005, rough: 0.9 }),
  black:     new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.38, metalness: 0.15 }),
  leaf:      mat(CV.rough, '#4E7A32', { repeat: [2, 2], bump: 0.02, rough: 1 }),
  trunk:     mat(CV.plank, '#7A5A3A', { repeat: [1, 3], bump: 0.03, rough: 1 }),

  // ── Joinery ──
  frame: new THREE.MeshStandardMaterial({ color: '#1C1C1C', roughness: 0.45, metalness: 0.5 }),
  glass: new THREE.MeshPhysicalMaterial({
    color: '#CFE2EC', transparent: true, opacity: 0.22,
    roughness: 0.04, metalness: 0, depthWrite: false,
    envMapIntensity: 1.6, clearcoat: 1, clearcoatRoughness: 0.03,
  }),
  lamp: new THREE.MeshStandardMaterial({
    color: '#FFF0D0', emissive: '#FFD9A0', emissiveIntensity: 2.2, roughness: 0.4,
  }),
};

// Indoor surfaces pick up the IBL a little harder than the default.
for (const m of Object.values(MAT)) {
  if ('envMapIntensity' in m && m.envMapIntensity === 1) m.envMapIntensity = 1.15;
}
