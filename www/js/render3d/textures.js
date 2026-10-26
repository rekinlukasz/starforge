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

// Returns a canvas with the surface map of a planet type.
export function planetSurfaceCanvas(type, seed, { width = 512, terraformStage = 0 } = {}) {
  const key = `${type}:${seed}:${width}:${terraformStage}`;
  if (cache.has(key)) return cache.get(key);
  const height = width / 2;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(width, height);
  const base = makeNoise(hashSeed(seed), 4);
  const detail = makeNoise(hashSeed(`${seed}d`), 16);
  const colour = SURFACES[type] ?? SURFACES.rocky;
  const green = terraformStage / 3;
  for (let y = 0; y < height; y++) {
    const v = y / height;
    const lat = v * 2 - 1;
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const n = base(u, v);
      const d = detail(u, v, 3);
      let c = colour(n, d, lat);
      if (green > 0 && type === 'terraformable') {
        const water = n < 0.45;
        c = mix(c, water ? [30, 90, 170] : [70, 130, 70], green * 0.85);
      }
      const shade = 0.85 + d * 0.3;
      const i = (y * width + x) * 4;
      img.data[i] = Math.min(255, c[0] * shade);
      img.data[i + 1] = Math.min(255, c[1] * shade);
      img.data[i + 2] = Math.min(255, c[2] * shade);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  if (type === 'ruins') {
    // Faint lit grid of ancient cities.
    ctx.strokeStyle = 'rgba(220, 210, 255, 0.35)';
    const r = rng(hashSeed(`${seed}r`));
    for (let k = 0; k < 40; k++) {
      const cx = r() * width; const cy = height * (0.2 + r() * 0.6); const s = 4 + r() * 10;
      ctx.strokeRect(cx, cy, s, s * 0.6);
    }
  }
  cache.set(key, canvas);
  return canvas;
}

// Cloud layer (white with alpha) for planets with weather.
export function cloudCanvas(seed, width = 512) {
  const key = `clouds:${seed}:${width}`;
  if (cache.has(key)) return cache.get(key);
  const height = width / 2;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(width, height);
  const noise = makeNoise(hashSeed(`${seed}c`), 6);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const n = noise(x / width, y / height, 5);
      const a = clamp01((n - 0.52) * 3.2);
      const i = (y * width + x) * 4;
      img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255;
      img.data[i + 3] = a * 210;
    }
  }
  ctx.putImageData(img, 0, 0);
  cache.set(key, canvas);
  return canvas;
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
