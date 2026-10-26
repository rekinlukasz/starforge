// Shared modelling kit for GLB assets (ships and station modules).
// +Y is up, 1 unit ≈ 10 m. Geometry comes from three.js primitives; the
// writer (tools/build-models.mjs) bakes material colours into vertex colours.
import * as THREE from 'three';

// Palette (sRGB hex). `glow: true` parts are emitted unlit (always bright).
export const MATERIALS = {
  Hull: { color: 0xb9c6d3 },
  HullDark: { color: 0x6f7a88 },
  Trim: { color: 0x2b3240 },
  Accent: { color: 0x3fd0c9, glow: true },
  Glass: { color: 0x8fe2f5, glow: true },
  Engine: { color: 0x5ff0e6, glow: true },
  Warning: { color: 0xd65a5a },
  Cargo: { color: 0xc49a4a },
  Bio: { color: 0x7fd36b },
  Vent: { color: 0xffa04a, glow: true },
  Light: { color: 0xfff1c4, glow: true },
  Panel: { color: 0x1f3f86 },
};

// ---- geometry helpers ------------------------------------------------------

const v = (x, y) => new THREE.Vector2(x, y);

// Smooth hull of revolution along Z from a profile [[radius, z], ...].
export function lathe(profile, segments = 16) {
  const g = new THREE.LatheGeometry(profile.map(([r, z]) => v(r, z)), segments);
  g.rotateX(Math.PI / 2); // lathe axis Y -> Z
  return g;
}

// Extruded outline in the XZ plane (top view), thickness along Y, bevelled.
export function plate(points, thickness = 0.06, bevel = 0.015) {
  const shape = new THREE.Shape(points.map(([x, z]) => v(x, z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1 });
  g.rotateX(Math.PI / 2);
  g.translate(0, thickness / 2, 0);
  return g;
}

export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const cyl = (rt, rb, h, s = 12) => new THREE.CylinderGeometry(rt, rb, h, s);
export const tube = (r, h, s = 12) => cyl(r, r, h, s).rotateX(Math.PI / 2); // along Z
export const sphere = (r, w = 16, h = 10) => new THREE.SphereGeometry(r, w, h);
export const torus = (r, t, rs = 8, ts = 32) => new THREE.TorusGeometry(r, t, rs, ts);
export const nozzle = (r, len) => lathe([[r * 0.55, 0], [r, -len * 0.35], [r * 1.1, -len]], 14);

// Part: { geo, mat, at: [x,y,z], rot: [x,y,z], scale: [x,y,z] }
export const P = (geo, mat, at = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) => ({ geo, mat, at, rot, scale });
// Mirror a part across the X = 0 plane (left/right symmetry). World mirror of
// T·R·S is T(-x)·R(rx,-ry,-rz)·S(-sx); the writer fixes the flipped winding.
export const mirror = (part) => [part, {
  ...part,
  at: [-part.at[0], part.at[1], part.at[2]],
  rot: [part.rot[0], -part.rot[1], -part.rot[2]],
  scale: [-part.scale[0], part.scale[1], part.scale[2]],
}];
