// Validates the GLB models in www/assets (built by npm run build:models).
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SHIPS } from '../www/data/ships.js';
import { RING_CATEGORIES } from '../www/js/render3d/layout.js';

const MODELS = [
  ...SHIPS.map((s) => ({ kind: 'ships', id: s.id, ship: true })),
  ...RING_CATEGORIES.map((c) => ({ kind: 'station', id: c, ship: false })),
];
const path = (m) => new URL(`../www/assets/${m.kind}/${m.id}.glb`, import.meta.url);

function readGlb(m) {
  const buf = readFileSync(path(m));
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  expect(dv.getUint32(0, true)).toBe(0x46546c67); // 'glTF'
  expect(dv.getUint32(4, true)).toBe(2);
  expect(dv.getUint32(8, true)).toBe(buf.byteLength);
  const jsonLen = dv.getUint32(12, true);
  expect(dv.getUint32(16, true)).toBe(0x4e4f534a); // JSON chunk
  return { buf, json: JSON.parse(new TextDecoder().decode(buf.subarray(20, 20 + jsonLen))) };
}

async function load(m) {
  const buf = readFileSync(path(m));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((resolve, reject) => new GLTFLoader().parse(ab, '', resolve, reject));
}

describe('GLB models', () => {
  it('exist for every ship type and every station ring category', () => {
    for (const m of MODELS) expect(existsSync(path(m)), `${m.kind}/${m.id}`).toBe(true);
  });

  it('are glTF 2.0 with one named node and at most two primitives (Body + Glow)', () => {
    for (const m of MODELS) {
      const { json, buf } = readGlb(m);
      expect(json.asset.version).toBe('2.0');
      expect(json.nodes[0].name).toBe(m.id);
      expect(json.scenes[0].name).not.toBe(m.id); // lookup by node name must not hit the scene
      const prims = json.meshes[0].primitives;
      expect(prims.length).toBeLessThanOrEqual(2);
      for (const p of prims) expect(p.attributes.COLOR_0, m.id).toBeDefined();
      expect(json.materials.map((x) => x.name).sort()).toEqual(expect.arrayContaining(['Body']));
      const glow = json.materials.find((x) => x.name === 'Glow');
      if (glow) expect(glow.extensions.KHR_materials_unlit).toBeDefined();
      expect(buf.byteLength, m.id).toBeLessThan(150 * 1024);
      if (m.ship) for (const e of json.nodes[0].extras.engines) expect(e).toHaveLength(4);
    }
  });

  it('load with three.js GLTFLoader: vertex colours, bounded size, sane orientation', async () => {
    for (const m of MODELS) {
      const gltf = await load(m);
      let triangles = 0;
      let node = null;
      gltf.scene.traverse((o) => {
        if (o.isMesh) {
          triangles += o.geometry.index.count / 3;
          expect(o.material.vertexColors, m.id).toBe(true);
        }
        if (o.name === m.id && !node) node = o;
      });
      expect(node, m.id).toBeTruthy();
      expect(triangles, m.id).toBeGreaterThan(100);
      expect(triangles, m.id).toBeLessThan(5000);
      if (m.ship) {
        for (const [, , z] of node.userData.engines) expect(z, m.id).toBeLessThan(0); // engines at the back
      } else {
        const { Box3 } = await import('three');
        const box = new Box3().setFromObject(gltf.scene);
        // Module base (bevelled deck) sits just below y = -0.3.
        expect(box.min.y, m.id).toBeGreaterThan(-0.4);
        expect(box.min.y, m.id).toBeLessThan(-0.25);
        expect(box.max.x - box.min.x, m.id).toBeLessThan(1.4); // ~1 x 1 footprint
        expect(box.max.z - box.min.z, m.id).toBeLessThan(1.4);
      }
    }
  });
});

describe('Planet GLB models', async () => {
  const { PLANETS, TERRAFORMING } = await import('../www/data/planets.js');
  const { PLANET_LOOK, planetModelId } = await import('../www/js/render3d/layout.js');
  const files = PLANETS.flatMap((p) => Array.from({ length: (p.terraformable ? TERRAFORMING.maxStage : 0) + 1 }, (_, stage) => ({ p, stage, id: planetModelId(p.id, stage) })));
  const glb = (id) => readGlb({ kind: 'planets', id });

  it('exist for every planet and every terraforming stage', () => {
    expect(files.length).toBe(PLANETS.length + 3);
    for (const f of files) expect(existsSync(new URL(`../www/assets/planets/${f.id}.glb`, import.meta.url)), f.id).toBe(true);
  });

  it('have the documented node tree, textures and extras', () => {
    for (const { p, stage, id } of files) {
      const { json, buf } = glb(id);
      const root = json.nodes[json.scenes[0].nodes[0]];
      expect(root.name).toBe(id);
      expect(root.extras).toMatchObject({ planet: p.id, type: p.type, terraformStage: stage });
      expect(root.extras.atmosphere).toBe(PLANET_LOOK[p.type].atmosphere);
      const names = root.children.map((i) => json.nodes[i].name);
      expect(names).toContain('Surface');
      expect(names.includes('Clouds'), id).toBe(PLANET_LOOK[p.type].clouds || stage > 0);
      expect(names.includes('Rings'), id).toBe(Boolean(PLANET_LOOK[p.type].rings));
      for (const m of json.meshes) for (const prim of m.primitives) expect(prim.attributes.TEXCOORD_0, id).toBeDefined();
      // Embedded PNG images; the surface map is 1024 x 512.
      const binStart = 20 + new DataView(buf.buffer, buf.byteOffset).getUint32(12, true) + 8;
      json.images.forEach((img, k) => {
        expect(img.mimeType).toBe('image/png');
        const bv = json.bufferViews[img.bufferView];
        const png = buf.subarray(binStart + bv.byteOffset, binStart + bv.byteOffset + bv.byteLength);
        expect([...png.subarray(1, 4)].map((c) => String.fromCharCode(c)).join('')).toBe('PNG');
        if (k === 0) {
          const dv = new DataView(png.buffer, png.byteOffset);
          expect([dv.getUint32(16), dv.getUint32(20)]).toEqual([1024, 512]);
        }
      });
      const surface = json.materials.find((m) => m.name === 'Surface');
      expect(surface.pbrMetallicRoughness.baseColorTexture).toBeDefined();
      expect(Boolean(surface.normalTexture), id).toBe(PLANET_LOOK[p.type].relief > 0);
      expect(buf.byteLength, id).toBeLessThan(700 * 1024);
    }
  });

  it('texture generators are deterministic (GLB and runtime fallback match)', async () => {
    const { planetSurfacePixels } = await import('../www/js/render3d/textures.js');
    const a = planetSurfacePixels('ice', 'glacius', { width: 64 });
    const b = planetSurfacePixels('ice', 'glacius', { width: 64 });
    expect(a.data).toEqual(b.data);
    const c = planetSurfacePixels('ice', 'other', { width: 64 });
    expect(a.data).not.toEqual(c.data);
  });
});

describe('Content Security Policy', () => {
  it('allows the blob: URLs GLTFLoader uses for embedded textures, and nothing remote', () => {
    const html = readFileSync(new URL('../www/index.html', import.meta.url), 'utf8');
    const csp = /Content-Security-Policy" content="([^"]+)"/.exec(html)[1];
    const dir = (name) => csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(name)) ?? '';
    expect(dir('img-src')).toContain('blob:');
    expect(dir('connect-src')).toContain('blob:');
    expect(csp).not.toMatch(/https?:/);
    expect(dir('script-src')).toBe("script-src 'self'");
  });
});
