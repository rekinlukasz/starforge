import * as THREE from '../../vendor/three.module.min.js';
import { glowCanvas, nebulaCanvas } from './textures.js';

export { THREE };

const textureCache = new Map();

export function canvasTexture(key, makeCanvas, { srgb = true } = {}) {
  if (textureCache.has(key)) return textureCache.get(key);
  const tex = new THREE.CanvasTexture(makeCanvas());
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
  textureCache.set(key, tex);
  return tex;
}

export function disposeTextures() {
  for (const t of textureCache.values()) t.dispose();
  textureCache.clear();
}

// Random star field on a large sphere shell.
export function starField(count, radius = 400, seed = 7) {
  let s = seed;
  const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const tints = [[1, 1, 1], [0.75, 0.85, 1], [1, 0.9, 0.75], [0.7, 1, 0.95]];
  for (let i = 0; i < count; i++) {
    const u = rand() * 2 - 1;
    const th = rand() * Math.PI * 2;
    const r = radius * (0.85 + rand() * 0.15);
    const k = Math.sqrt(1 - u * u);
    pos.set([Math.cos(th) * k * r, u * r, Math.sin(th) * k * r], i * 3);
    const t = tints[Math.floor(rand() * tints.length)];
    const b = 0.45 + rand() * 0.55;
    col.set([t[0] * b, t[1] * b, t[2] * b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false,
    map: canvasTexture('star', () => glowCanvas(32)), alphaTest: 0.01,
  });
  return new THREE.Points(geo, mat);
}

export function nebulaSphere(radius = 450, seed = 'nebula', width = 1024) {
  const tex = canvasTexture(`neb:${seed}:${width}`, () => nebulaCanvas(seed, width));
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false });
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), mat);
}

export function glowSprite(color = 0xffffff, scale = 1, opacity = 1) {
  const mat = new THREE.SpriteMaterial({
    map: canvasTexture('glow', () => glowCanvas(128)), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(scale);
  return s;
}

// Fresnel atmosphere shell: bright at the limb, transparent at the centre.
export function atmosphere(radius, color, intensity = 1) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { glowColor: { value: new THREE.Color(color) }, intensity: { value: intensity } },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 glowColor;
      uniform float intensity;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float f = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.5);
        gl_FragColor = vec4(glowColor, f * intensity);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), mat);
}

// ---- procedural ships ------------------------------------------------------

const HULL = { civil: 0x9fb4c8, military: 0x7d8796 };
const ACCENT = 0x3fd0c9;

function part(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.45, flatShading: true }));
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}

function engine(x, y, z, size = 0.35) {
  const s = glowSprite(0x5ff0e6, size, 0.9);
  s.position.set(x, y, z);
  return s;
}

// Procedural fallback used when a ship's GLB model is not available.
// +Z is forward. Scale ~1 unit long for small ships.
export function proceduralShipModel(type) {
  const g = new THREE.Group();
  const role = ['escort', 'frigate', 'cruiser'].includes(type) ? 'military' : 'civil';
  const hull = HULL[role];
  switch (type) {
    case 'scout':
      g.add(part(new THREE.ConeGeometry(0.18, 0.9, 5), hull, 0, 0, 0, Math.PI / 2));
      g.add(part(new THREE.BoxGeometry(0.7, 0.03, 0.2), ACCENT, 0, 0, -0.15));
      g.add(engine(0, 0, -0.5, 0.3));
      break;
    case 'miner':
      g.add(part(new THREE.BoxGeometry(0.45, 0.35, 0.8), 0xb08d57));
      g.add(part(new THREE.CylinderGeometry(0.08, 0.14, 0.4, 6), 0x666a70, 0, -0.1, 0.55, Math.PI / 2));
      g.add(engine(0, 0, -0.5));
      break;
    case 'researchVessel':
      g.add(part(new THREE.CylinderGeometry(0.15, 0.15, 0.9, 8), hull, 0, 0, 0, Math.PI / 2));
      g.add(part(new THREE.TorusGeometry(0.32, 0.03, 6, 20), ACCENT, 0, 0, 0.1));
      g.add(part(new THREE.SphereGeometry(0.12, 8, 6), 0xd2f7ff, 0, 0, 0.5));
      g.add(engine(0, 0, -0.5));
      break;
    case 'transporter':
      g.add(part(new THREE.BoxGeometry(0.5, 0.4, 1.2), hull));
      for (const z of [-0.3, 0.1, 0.45]) g.add(part(new THREE.BoxGeometry(0.62, 0.3, 0.25), 0xc4a35a, 0, 0, z));
      g.add(engine(-0.15, 0, -0.7)); g.add(engine(0.15, 0, -0.7));
      break;
    case 'colonyShip':
      g.add(part(new THREE.CylinderGeometry(0.3, 0.3, 1.3, 10), 0xe4e9ef, 0, 0, 0, Math.PI / 2));
      g.add(part(new THREE.TorusGeometry(0.5, 0.06, 6, 24), ACCENT, 0, 0, 0.2));
      g.add(part(new THREE.SphereGeometry(0.28, 12, 8), 0x7fd36b, 0, 0, 0.7));
      g.add(engine(0, 0, -0.8, 0.5));
      break;
    case 'escort':
      g.add(part(new THREE.OctahedronGeometry(0.35), hull, 0, 0, 0, 0, 0, Math.PI / 4));
      g.add(part(new THREE.BoxGeometry(0.9, 0.04, 0.25), 0xef6b6b, 0, 0, -0.1));
      g.add(engine(0, 0, -0.4));
      break;
    case 'frigate':
      g.add(part(new THREE.BoxGeometry(0.4, 0.25, 1.5), hull));
      g.add(part(new THREE.ConeGeometry(0.2, 0.5, 4), hull, 0, 0, 1, Math.PI / 2, 0, Math.PI / 4));
      g.add(part(new THREE.BoxGeometry(1.1, 0.06, 0.4), 0x5a6270, 0, 0, -0.3));
      g.add(part(new THREE.BoxGeometry(0.15, 0.2, 0.3), 0xef6b6b, 0, 0.2, 0.3));
      g.add(engine(-0.12, 0, -0.85)); g.add(engine(0.12, 0, -0.85));
      break;
    case 'cruiser':
      g.add(part(new THREE.BoxGeometry(0.7, 0.4, 2.6), hull));
      g.add(part(new THREE.ConeGeometry(0.35, 0.8, 4), hull, 0, 0, 1.7, Math.PI / 2, 0, Math.PI / 4));
      g.add(part(new THREE.BoxGeometry(1.8, 0.08, 0.7), 0x5a6270, 0, 0, -0.6));
      for (const z of [-0.2, 0.5]) g.add(part(new THREE.BoxGeometry(0.25, 0.25, 0.4), 0xef6b6b, 0, 0.32, z));
      for (const x of [-0.25, 0, 0.25]) g.add(engine(x, 0, -1.4, 0.45));
      break;
    case 'terraformer':
      g.add(part(new THREE.SphereGeometry(0.45, 12, 8), 0x8fbf8a));
      g.add(part(new THREE.TorusGeometry(0.65, 0.05, 6, 24), ACCENT, 0, 0, 0, Math.PI / 2));
      g.add(engine(0, 0, -0.6, 0.5));
      break;
    default:
      g.add(part(new THREE.ConeGeometry(0.2, 0.8, 5), hull, 0, 0, 0, Math.PI / 2));
  }
  return mergeShip(g);
}

// Collapses a ship's parts into one mesh (vertex colours) plus a single
// engine glow, so each ship costs two draw calls instead of five or more.
function mergeShip(group) {
  const positions = [];
  const normals = [];
  const colors = [];
  const engines = [];
  group.updateMatrixWorld(true);
  for (const child of group.children) {
    if (child.isSprite) { engines.push(child); continue; }
    const geo = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
    geo.applyMatrix4(child.matrix);
    const c = child.material.color;
    const pos = geo.attributes.position.array;
    const nor = geo.attributes.normal.array;
    for (let i = 0; i < pos.length; i++) { positions.push(pos[i]); normals.push(nor[i]); }
    for (let i = 0; i < pos.length / 3; i++) colors.push(c.r, c.g, c.b);
    geo.dispose();
    child.geometry.dispose();
    child.material.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const out = new THREE.Group();
  out.add(new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.45, flatShading: true })));
  if (engines.length) {
    // One glow at the averaged engine position, sized for the cluster.
    const avg = engines.reduce((v, e) => v.add(e.position), new THREE.Vector3()).divideScalar(engines.length);
    const glow = engines[0];
    glow.position.copy(avg);
    glow.scale.multiplyScalar(engines.length > 1 ? 1.4 : 1);
    out.add(glow);
    engines.slice(1).forEach((e) => e.material.dispose());
  }
  return out;
}

// Disposes GPU resources under `root`, except those shared with a loaded
// asset (ship GLB instances), which belong to the ship library.
export function disposeObject(root) {
  root.traverse((o) => {
    if (o.isInstancedMesh) o.dispose(); // frees per-instance GPU buffers only
    if (o.userData?.shared) return;
    o.geometry?.dispose?.();
    const m = o.material;
    if (Array.isArray(m)) m.forEach((x) => x.dispose());
    else m?.dispose?.();
  });
}
