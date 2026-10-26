// Builds the game's 3D models as binary glTF 2.0: npm run build:models
//   www/assets/ships/<shipId>.glb       ship designs   (tools/models/ships.mjs)
//   www/assets/station/<category>.glb   ring modules   (tools/models/station.mjs)
//   www/assets/planets/<planetId>.glb   textured planets (tools/models/planets.mjs),
//                                       plus <id>-t1..t3 terraforming stages
//
// Ships and modules are one node with two primitives (two draw calls):
//   "Body" — lit PBR material, colours baked into COLOR_0
//   "Glow" — unlit (KHR_materials_unlit) lights, windows, engines
// Node extras carry gameplay data (ships: engines = [[x, y, z, size], ...]).
// Files open in Blender (vertex colours) and can be replaced by artist-made
// models with the same file name, orientation and extras.
import * as THREE from 'three';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MATERIALS } from './models/kit.mjs';
import { GltfBuilder } from './models/gltf.mjs';
import { buildPlanet } from './models/planets.mjs';
import { PLANETS } from '../www/data/planets.js';
import { TERRAFORMING } from '../www/data/planets.js';
import { planetModelId } from '../www/js/render3d/layout.js';
import { DESIGNS } from './models/ships.mjs';
import { MODULES } from './models/station.mjs';
import { SHIPS } from '../www/data/ships.js';
import { RING_CATEGORIES } from '../www/js/render3d/layout.js';

const ASSETS = fileURLToPath(new URL('../www/assets/', import.meta.url));
const BODY = { name: 'Body', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0.6, roughnessFactor: 0.45 } };
const GLOW = {
  name: 'Glow',
  pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 },
  extensions: { KHR_materials_unlit: {} },
};

function linear(hex) {
  const c = new THREE.Color(hex); // ColorManagement: sRGB hex -> linear components
  return [c.r, c.g, c.b];
}

// Bakes parts into the Body / Glow vertex streams.
export function bake(parts) {
  const groups = { Body: { positions: [], normals: [], colors: [], indices: [] }, Glow: { positions: [], normals: [], colors: [], indices: [] } };
  const m = new THREE.Matrix4();
  for (const part of parts) {
    const mat = MATERIALS[part.mat];
    if (!mat) throw new Error(`unknown material ${part.mat}`);
    const g = part.geo.clone();
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
    m.compose(
      new THREE.Vector3(...part.at),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...part.rot)),
      new THREE.Vector3(...part.scale),
    );
    g.applyMatrix4(m);
    const flip = m.determinant() < 0; // mirrored parts: restore winding
    const grp = groups[mat.glow ? 'Glow' : 'Body'];
    const base = grp.positions.length / 3;
    const [r, gr, b] = linear(mat.color);
    grp.positions.push(...g.attributes.position.array);
    grp.normals.push(...g.attributes.normal.array);
    for (let i = 0; i < g.attributes.position.count; i++) grp.colors.push(r, gr, b);
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) {
      if (flip) grp.indices.push(base + idx[i], base + idx[i + 2], base + idx[i + 1]);
      else grp.indices.push(base + idx[i], base + idx[i + 1], base + idx[i + 2]);
    }
    g.dispose();
  }
  return groups;
}

export function encodeGlb(name, parts, extras = {}) {
  const groups = bake(parts);
  const b = new GltfBuilder();
  const primitives = [];
  let triangles = 0;
  for (const [key, grp] of Object.entries(groups)) {
    if (!grp.indices.length) continue;
    primitives.push(b.primitive(grp, b.material(key === 'Glow' ? GLOW : BODY)));
    triangles += grp.indices.length / 3;
  }
  b.node({ name, mesh: b.mesh(name, primitives), extras }, { root: true });
  return { bytes: b.encode(), triangles };
}

function build(dir, name, parts, extras) {
  mkdirSync(`${ASSETS}${dir}`, { recursive: true });
  const { bytes, triangles } = encodeGlb(name, parts, extras);
  writeFileSync(`${ASSETS}${dir}/${name}.glb`, bytes);
  console.log(`${`${dir}/${name}`.padEnd(26)} ${String(triangles).padStart(5)} trójkątów  ${(bytes.length / 1024).toFixed(1)} KB`);
}

const missingShips = SHIPS.filter((s) => !DESIGNS[s.id]).map((s) => s.id);
const missingModules = RING_CATEGORIES.filter((c) => !MODULES[c]);
if (missingShips.length || missingModules.length) throw new Error(`Missing designs: ${[...missingShips, ...missingModules].join(', ')}`);

for (const s of SHIPS) {
  const d = DESIGNS[s.id]();
  build('ships', s.id, d.parts, { engines: d.engines });
}
for (const c of RING_CATEGORIES) build('station', c, MODULES[c](), { category: c });

mkdirSync(`${ASSETS}planets`, { recursive: true });
for (const p of PLANETS) {
  const stages = p.terraformable ? TERRAFORMING.maxStage : 0;
  for (let stage = 0; stage <= stages; stage++) {
    const id = planetModelId(p.id, stage);
    const { bytes, info } = buildPlanet(p, { name: id, terraformStage: stage });
    writeFileSync(`${ASSETS}planets/${id}.glb`, bytes);
    console.log(`${`planets/${id}`.padEnd(26)} ${String(info.triangles).padStart(5)} trójkątów  ${info.textures} tekstur  ${(bytes.length / 1024).toFixed(0)} KB`);
  }
}
