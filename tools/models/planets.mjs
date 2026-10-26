// Planet GLBs: textured globe (+ relief normal map), optional cloud shell and
// rings. Textures come from the same generators the game uses as a fallback
// (www/js/render3d/textures.js), so GLB and fallback look alike.
//
// Node tree:  <planetId> (extras: type, atmosphere, atmosphereIntensity, radius)
//               ├─ Surface   unit sphere, PBR, baseColor + normal texture
//               ├─ Clouds    sphere r = 1.015, alpha-blended (cloudy types)
//               └─ Rings     flat annulus 1.35–2.1, alpha-blended (gas giants)
// The game scales the root to the planet radius and adds the atmosphere glow,
// city lights and moon at runtime (they depend on game state / shaders).
import * as THREE from 'three';
import { GltfBuilder } from './gltf.mjs';
import { encodePng } from './png.mjs';
import { planetSurfacePixels, cloudPixels, normalPixels, ringPixels } from '../../www/js/render3d/textures.js';
import { PLANET_LOOK } from '../../www/js/render3d/layout.js';

const SPHERE_SEGMENTS = [64, 32];

function streamOf(geometry) {
  return {
    positions: [...geometry.attributes.position.array],
    normals: [...geometry.attributes.normal.array],
    uvs: [...geometry.attributes.uv.array],
    indices: [...geometry.index.array],
  };
}

// Flat annulus in the XZ plane with u = radial position (for band textures).
function ringStream(inner, outer, segments = 128) {
  const positions = []; const normals = []; const uvs = []; const indices = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const c = Math.cos(a); const s = Math.sin(a);
    for (const [r, u] of [[inner, 0], [outer, 1]]) {
      positions.push(c * r, 0, s * r);
      normals.push(0, 1, 0);
      uvs.push(u, i / segments);
    }
    if (i < segments) {
      const k = i * 2;
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  return { positions, normals, uvs, indices };
}

const quatFromEuler = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)).toArray();

// Returns { bytes, info } for one planet (optionally a terraforming stage).
export function buildPlanet(planet, { name = planet.id, terraformStage = 0, textureWidth = 1024 } = {}) {
  const look = PLANET_LOOK[planet.type] ?? PLANET_LOOK.rocky;
  const b = new GltfBuilder();
  const children = [];

  // Surface
  const surface = planetSurfacePixels(planet.type, planet.id, { width: textureWidth, terraformStage });
  const surfaceMat = {
    name: 'Surface',
    pbrMetallicRoughness: {
      baseColorTexture: { index: b.texture(encodePng(surface, { alpha: false })) },
      metallicFactor: 0,
      roughnessFactor: look.roughness,
    },
  };
  if (look.relief > 0) {
    const normalWidth = textureWidth / 2; // relief is low-frequency: half resolution is enough
    const lowRes = planetSurfacePixels(planet.type, planet.id, { width: normalWidth, terraformStage });
    surfaceMat.normalTexture = { index: b.texture(encodePng(normalPixels(lowRes, look.relief), { alpha: false })), scale: 1 };
  }
  const sphere = new THREE.SphereGeometry(1, ...SPHERE_SEGMENTS);
  const surfaceMesh = b.mesh('Surface', [b.primitive(streamOf(sphere), b.material(surfaceMat))]);
  children.push(b.node({ name: 'Surface', mesh: surfaceMesh }));

  // Clouds
  const cloudy = look.clouds || terraformStage > 0;
  if (cloudy) {
    const cloudMat = b.material({
      name: 'Clouds',
      alphaMode: 'BLEND',
      pbrMetallicRoughness: {
        baseColorTexture: { index: b.texture(encodePng(cloudPixels(planet.id, textureWidth / 2))) },
        baseColorFactor: [1, 1, 1, planet.type === 'toxic' ? 0.6 : 0.85],
        metallicFactor: 0,
        roughnessFactor: 1,
      },
    });
    const shell = new THREE.SphereGeometry(1.015, ...SPHERE_SEGMENTS);
    children.push(b.node({ name: 'Clouds', mesh: b.mesh('Clouds', [b.primitive(streamOf(shell), cloudMat)]) }));
  }

  // Rings
  if (look.rings) {
    const ringMat = b.material({
      name: 'Rings',
      alphaMode: 'BLEND',
      doubleSided: true,
      pbrMetallicRoughness: {
        baseColorTexture: { index: b.texture(encodePng(ringPixels(planet.id)), { wrapS: 33071, wrapT: 10497 }) },
        metallicFactor: 0,
        roughnessFactor: 1,
      },
    });
    children.push(b.node({
      name: 'Rings',
      mesh: b.mesh('Rings', [b.primitive(ringStream(1.35, 2.1), ringMat)]),
      rotation: quatFromEuler(Math.PI / 2.3 - Math.PI / 2, 0, 0),
    }));
  }

  b.node({
    name,
    children,
    rotation: quatFromEuler(0, 0, 0.35), // axial tilt
    extras: {
      planet: planet.id,
      type: planet.type,
      terraformStage,
      radius: look.radius ?? 4.6,
      atmosphere: look.atmosphere,
      atmosphereIntensity: look.atmosphereIntensity,
    },
  }, { root: true });
  const bytes = b.encode();
  return { bytes, info: { textures: b.json.textures.length, triangles: b.json.accessors.filter((a) => a.type === 'SCALAR').reduce((s, a) => s + a.count / 3, 0) } };
}
