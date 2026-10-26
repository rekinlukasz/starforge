// Minimal PNG encoder (8-bit RGB/RGBA, adaptive "Paeth/Sub/Up" row filters)
// using node:zlib. Enough for generated textures; no external dependency.
import { deflateSync } from 'node:zlib';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

// pixels: { width, height, data: RGBA Uint8 array }; alpha=false drops the A channel.
export function encodePng({ width, height, data }, { alpha = true } = {}) {
  const bpp = alpha ? 4 : 3;
  const stride = width * bpp;
  const raw = Buffer.alloc((stride + 1) * height);
  const row = Buffer.alloc(stride);
  const prev = Buffer.alloc(stride);
  const cand = [Buffer.alloc(stride), Buffer.alloc(stride), Buffer.alloc(stride), Buffer.alloc(stride)];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let k = 0; k < bpp; k++) row[x * bpp + k] = data[(y * width + x) * 4 + k];
    }
    // Try filters 1 (Sub), 2 (Up), 4 (Paeth) and none; keep the smallest sum.
    let best = 0; let bestSum = Infinity;
    [0, 1, 2, 4].forEach((f, ci) => {
      const out = cand[ci];
      let sum = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? row[i - bpp] : 0; const b = prev[i]; const c = i >= bpp ? prev[i - bpp] : 0;
        const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : paeth(a, b, c);
        const v = (row[i] - pred) & 0xff;
        out[i] = v;
        sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) { bestSum = sum; best = ci; }
    });
    raw[y * (stride + 1)] = [0, 1, 2, 4][best];
    cand[best].copy(raw, y * (stride + 1) + 1);
    row.copy(prev);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = alpha ? 6 : 2; // RGBA : RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
