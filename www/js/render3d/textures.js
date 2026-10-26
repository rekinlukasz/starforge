// Procedural textures drawn on 2D canvases (no image files, works offline).
// Planet surfaces are equirectangular maps built from seeded fractal noise.

function hashSeed(str) {
  let h = 2166136261;
  for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

function rng(seed) {
  let s = seed || 1;
  return () => {
    s = Math.imul(s ^ (s >>> 15), 2246822507);
    s = Math.imul(s ^ (s >>> 13), 3266489909);
    return ((s ^= s >>> 16) >>> 0) / 4294967296;
  };
}

// Tileable (in x) 2D value noise with fBm.
function makeNoise(seed, period) {
  const rand = rng(seed);
  const size = 256;
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const at = (x, y) => grid[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  const smooth = (t) => t * t * (3 - 2 * t);
  const value = (x, y, p) => {
    const x0 = Math.floor(x); const y0 = Math.floor(y);
    const fx = smooth(x - x0); const fy = smooth(y - y0);
    const wrap = (v) => ((v % p) + p) % p;
    const a = at(wrap(x0), y0); const b = at(wrap(x0 + 1), y0);
    const c = at(wrap(x0), y0 + 1); const d = at(wrap(x0 + 1), y0 + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  return (u, v, octaves = 5) => {
    let sum = 0; let amp = 0.5; let freq = 1; let norm = 0;
    for (let o = 0; o < octaves; o++) {
      const p = period * freq;
      sum += value(u * p, v * period * freq * 0.5, p) * amp;
      norm += amp; amp *= 0.5; freq *= 2;
    }
    return sum / norm;
  };
}

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// Colour function per planet type: (noise n, detail d, latitude lat in [-1,1]) -> [r,g,b]
const SURFACES = {
  rocky: (n, d) => mix([92, 78, 64], [190, 170, 140], clamp01(n * 1.3 - 0.15 + d * 0.2)),
  terraformable: (n, d) => mix([90, 76, 66], [176, 150, 128], clamp01(n * 1.2 - 0.1 + d * 0.2)),
  desert: (n, d, lat) => mix([150, 92, 44], [246, 206, 140], clamp01(0.5 + Math.sin((n * 8 + lat * 3) * Math.PI) * 0.25 + d * 0.3)),
  oceanic: (n, d) => (n > 0.58
    ? mix([70, 120, 60], [140, 160, 90], clamp01((n - 0.58) * 4 + d * 0.2))
    : mix([10, 40, 100], [40, 120, 200], clamp01(n * 1.6))),
  ice: (n, d, lat) => mix([120, 170, 200], [245, 252, 255], clamp01(n * 1.2 + Math.abs(lat) * 0.5 + d * 0.1)),
  volcanic: (n, d) => {
    const lava = Math.abs(d - 0.5) < 0.035 ? 1 : 0;
    return lava ? [255, 140 + n * 80, 40] : mix([20, 10, 8], [90, 40, 28], clamp01(n * 1.4 - 0.2));
  },
  gas: (n, d, lat) => mix([120, 70, 35], [250, 220, 170], clamp01(0.5 + Math.sin(lat * 14 + n * 6) * 0.35 + d * 0.15)),
  toxic: (n, d, lat) => mix([30, 50, 15], [210, 240, 120], clamp01(0.5 + Math.sin(lat * 9 + n * 10) * 0.3 + d * 0.2)),
  ruins: (n, d) => mix([40, 36, 60], [170, 165, 195], clamp01(n * 1.3 - 0.1 + d * 0.15)),
  anomaly: (n, d, lat) => mix([25, 5, 50], [230, 160, 255], clamp01(0.5 + Math.sin(n * 18 + lat * 4) * 0.4 + d * 0.2)),
};

const cache = new Map();

// Impact craters per planet type (count, max radius in texture-height units).
const CRATERS = { rocky: [70, 0.09], terraformable: [40, 0.08], ruins: [30, 0.07], volcanic: [22, 0.06] };

function craterList(type, seed) {
  const spec = CRATERS[type];
  if (!spec) return [];
  const r = rng(hashSeed(`${seed}craters`));
  return Array.from({ length: spec[0] }, () => ({
    u: r(), v: 0.15 + r() * 0.7, radius: spec[1] * (0.15 + Math.pow(r(), 2) * 0.85),
  }));
}

// Height offset of all craters at (u, v): bowl below zero, bright rim above.
function craterHeight(craters, u, v) {
  let h = 0;
  const cosLat = Math.max(0.2, Math.cos((v - 0.5) * Math.PI));
  for (const c of craters) {
    let du = Math.abs(u - c.u);
    if (du > 0.5) du = 1 - du;
    const dx = du * 2 * cosLat; // equirect: 1 unit of u = 2 units of v at the equator
    const dv = v - c.v;
    if (Math.abs(dv) > c.radius * 1.4 || dx > c.radius * 1.4) continue;
    const d = Math.hypot(dx, dv) / c.radius;
    if (d < 1) h -= (1 - d * d) * 0.45;
    h += Math.exp(-(((d - 1) / 0.18) ** 2)) * 0.3;
  }
  return h;
}

// ---- pure pixel generators (no DOM; shared with tools/build-models.mjs) ----

// Equirectangular planet surface: RGBA pixels plus a height field (0..1)
// used for the relief/normal map.
export function planetSurfacePixels(type, seed, { width = 512, terraformStage = 0 } = {}) {
  const height = width / 2;
  const data = new Uint8ClampedArray(width * height * 4);
  const heights = new Float32Array(width * height);
  const base = makeNoise(hashSeed(seed), 4);
  const detail = makeNoise(hashSeed(`${seed}d`), 16);
  const colour = SURFACES[type] ?? SURFACES.rocky;
  const green = terraformStage / 3;
  const craters = craterList(type, seed);
  for (let y = 0; y < height; y++) {
    const v = y / height;
    const lat = v * 2 - 1;
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const n = base(u, v);
      const d = detail(u, v, 3);
      const crater = craters.length ? craterHeight(craters, u, v) : 0;
      let c = colour(n, d, lat);
      if (crater) c = c.map((ch) => ch * (1 + crater * 0.7));
      if (green > 0 && type === 'terraformable') {
        const water = n < 0.45;
        c = mix(c, water ? [30, 90, 170] : [70, 130, 70], green * 0.85);
      }
      const shade = 0.85 + d * 0.3;
      const i = (y * width + x) * 4;
      data[i] = Math.min(255, c[0] * shade);
      data[i + 1] = Math.min(255, c[1] * shade);
      data[i + 2] = Math.min(255, c[2] * shade);
      data[i + 3] = 255;
      heights[y * width + x] = n * 0.75 + d * 0.25 + crater * 0.6;
    }
  }
  if (type === 'ruins') {
    // Faint lit outlines of ancient cities.
    const r = rng(hashSeed(`${seed}r`));
    const scale = width / 512;
    for (let k = 0; k < 40; k++) {
      const x0 = Math.floor(r() * width); const y0 = Math.floor(height * (0.2 + r() * 0.6));
      const w = Math.max(2, Math.round((4 + r() * 10) * scale)); const hgt = Math.max(2, Math.round(w * 0.6));
      for (let t = 0; t <= w; t++) for (const yy of [y0, y0 + hgt]) blend(data, width, height, x0 + t, yy, [220, 210, 255], 0.35);
      for (let t = 0; t <= hgt; t++) for (const xx of [x0, x0 + w]) blend(data, width, height, xx, y0 + t, [220, 210, 255], 0.35);
    }
  }
  return { width, height, data, heights };
}

function blend(data, width, height, x, y, rgb, a) {
  const xx = ((x % width) + width) % width;
  if (y < 0 || y >= height) return;
  const i = (y * width + xx) * 4;
  for (let k = 0; k < 3; k++) data[i + k] = data[i + k] * (1 - a) + rgb[k] * a;
}

// Cloud layer: white with alpha.
export function cloudPixels(seed, width = 512) {
  const height = width / 2;
  const data = new Uint8ClampedArray(width * height * 4);
  const noise = makeNoise(hashSeed(`${seed}c`), 6);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const n = noise(x / width, y / height, 5);
      const i = (y * width + x) * 4;
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255;
      data[i + 3] = clamp01((n - 0.52) * 3.2) * 210;
    }
  }
  return { width, height, data };
}

// Tangent-space normal map (RGB) from a height field, wrapping in x.
export function normalPixels({ width, height, heights }, strength = 2.5) {
  const data = new Uint8ClampedArray(width * height * 4);
  const h = (x, y) => heights[Math.min(height - 1, Math.max(0, y)) * width + (((x % width) + width) % width)];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * strength * (width / 512);
      const dy = (h(x, y + 1) - h(x, y - 1)) * strength * (width / 512);
      const len = Math.hypot(dx, dy, 1);
      const i = (y * width + x) * 4;
      data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255; // glTF: +Y up in texture space, rows go down
      data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

// Planet ring texture (1D radial bands, RGBA), as a 256 x 8 strip.
export function ringPixels(seed, width = 256) {
  const height = 8;
  const data = new Uint8ClampedArray(width * height * 4);
  const r = rng(hashSeed(`${seed}ring`));
  const bands = Array.from({ length: 24 }, () => r());
  for (let x = 0; x < width; x++) {
    const t = x / width;
    const band = bands[Math.floor(t * bands.length)];
    const edge = Math.min(1, t * 8, (1 - t) * 6);
    const a = clamp01((0.25 + band * 0.6) * edge);
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4;
      data[i] = 232; data[i + 1] = 207 - band * 30; data[i + 2] = 160 - band * 40; data[i + 3] = a * 255;
    }
  }
  return { width, height, data };
}

// ---- canvas wrappers (runtime fallback when a planet GLB is unavailable) ----

function toCanvas({ width, height, data }) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(width, height);
  img.data.set(data);
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function planetSurfaceCanvas(type, seed, { width = 512, terraformStage = 0 } = {}) {
  const key = `${type}:${seed}:${width}:${terraformStage}`;
  if (!cache.has(key)) cache.set(key, toCanvas(planetSurfacePixels(type, seed, { width, terraformStage })));
  return cache.get(key);
}

export function cloudCanvas(seed, width = 512) {
  const key = `clouds:${seed}:${width}`;
  if (!cache.has(key)) cache.set(key, toCanvas(cloudPixels(seed, width)));
  return cache.get(key);
}

// Soft radial glow used for stars, sector nodes and engine trails.
export function glowCanvas(size = 128, inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const key = `glow:${size}:${inner}:${outer}`;
  if (cache.has(key)) return cache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.55)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  cache.set(key, canvas);
  return canvas;
}

// Large faint nebula for the background sphere.
export function nebulaCanvas(seed = 'nebula', width = 1024) {
  const key = `nebula:${seed}:${width}`;
  if (cache.has(key)) return cache.get(key);
  const height = width / 2;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(width, height);
  const n1 = makeNoise(hashSeed(seed), 3);
  const n2 = makeNoise(hashSeed(`${seed}2`), 5);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width; const v = y / height;
      const a = clamp01((n1(u, v, 4) - 0.45) * 2.2);
      const b = clamp01((n2(u, v, 4) - 0.5) * 2.5);
      const i = (y * width + x) * 4;
      img.data[i] = 8 + a * 40 + b * 20;
      img.data[i + 1] = 10 + a * 20 + b * 60;
      img.data[i + 2] = 22 + a * 70 + b * 70;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  cache.set(key, canvas);
  return canvas;
}
