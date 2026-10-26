// Station ring modules, one per building category (built by
// tools/build-models.mjs into www/assets/station/<category>.glb).
// Footprint ≈ 1 x 1 units centred on the origin, base at y = -0.3,
// +X faces outward from the ring (front details go there), +Y is up.
import { lathe, plate, box, cyl, sphere, torus, P, mirror } from './kit.mjs';

const BASE_Y = -0.3;
// Common foundation: bevelled deck plate with a lit edge on the outer side.
const deck = (w = 1, d = 1) => [
  P(plate([[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]], 0.08, 0.02), 'HullDark', [0, BASE_Y, 0]),
  P(box(0.03, 0.03, d * 0.8), 'Accent', [w / 2 + 0.01, BASE_Y + 0.06, 0]),
];
// Vertical cylinder standing on the deck.
const tank = (r, h, mat, x, z, s = 14) => P(cyl(r, r, h, s), mat, [x, BASE_Y + 0.08 + h / 2, z]);

export const MODULES = {
  // Energy: fusion containment pod with glowing coil rings and cooling fins.
  energy: () => [
    ...deck(),
    P(lathe([[0.001, 0.62], [0.2, 0.58], [0.3, 0.45], [0.32, 0.12], [0.26, 0], [0.001, 0]], 20), 'Hull', [0, BASE_Y + 0.08, 0], [-Math.PI / 2, 0, 0]),
    ...[0.18, 0.32, 0.46].map((y) => P(torus(0.33, 0.025, 6, 32), 'Engine', [0, BASE_Y + 0.08 + y, 0], [Math.PI / 2, 0, 0])),
    ...[0, 1, 2, 3, 4, 5].map((i) => P(box(0.26, 0.34, 0.03), 'Trim', [Math.cos(i * Math.PI / 3) * 0.42, BASE_Y + 0.3, Math.sin(i * Math.PI / 3) * 0.42], [0, -i * Math.PI / 3, 0])),
    P(sphere(0.07, 12, 8), 'Light', [0, BASE_Y + 0.74, 0]),
    P(cyl(0.015, 0.015, 0.14, 6), 'Trim', [0, BASE_Y + 0.68, 0]),
  ],

  // Mining: ore processor with hopper, conveyor arm and drill head.
  mining: () => [
    ...deck(),
    P(box(0.62, 0.36, 0.7), 'Cargo', [-0.08, BASE_Y + 0.26, 0]),
    P(lathe([[0.32, 0.3], [0.32, 0.22], [0.12, 0], [0.12, -0.05]], 4), 'HullDark', [-0.08, BASE_Y + 0.66, 0], [-Math.PI / 2, Math.PI / 4, 0]),
    P(box(0.58, 0.05, 0.14), 'Trim', [0.32, BASE_Y + 0.5, 0], [0, 0, -0.45]),
    ...[0.12, 0.26, 0.4, 0.54].map((x) => P(cyl(0.035, 0.035, 0.16, 8), 'HullDark', [x, BASE_Y + 0.55 - x * 0.48, 0], [Math.PI / 2, 0, 0])),
    P(lathe([[0.001, 0.32], [0.05, 0.24], [0.11, 0.08], [0.12, 0]], 8), 'Trim', [0.46, BASE_Y + 0.12, 0.28], [0, 0, -Math.PI / 2]),
    ...[0.05, 0.12, 0.19].map((d) => P(torus(0.09 - d * 0.25, 0.01, 4, 16), 'Accent', [0.46 + d, BASE_Y + 0.12, 0.28], [0, Math.PI / 2, 0])),
    ...mirror(P(box(0.04, 0.04, 0.6), 'Warning', [0.24, BASE_Y + 0.43, 0.0])),
    P(box(0.2, 0.06, 0.02), 'Light', [0.22, BASE_Y + 0.3, -0.36]),
  ],

  // Processing: factory hall with saw-tooth roof, stacks and glowing furnace vents.
  processing: () => [
    ...deck(),
    P(box(0.8, 0.3, 0.86), 'Hull', [0, BASE_Y + 0.23, 0]),
    ...[-0.3, -0.03, 0.24].map((z) => P(plate([[-0.4, 0], [0.4, 0], [0.4, 0.27], [-0.4, 0.1]], 0.04, 0.005), 'HullDark', [0, BASE_Y + 0.38, z], [-Math.PI / 2, 0, 0], [1, 1, 1])),
    ...[-0.3, -0.03, 0.24].map((z) => P(box(0.76, 0.12, 0.012), 'Glass', [0, BASE_Y + 0.45, z + 0.26])),
    ...[[-0.25, 0.25], [-0.25, -0.12]].map(([x, z]) => P(cyl(0.06, 0.075, 0.5, 10), 'Trim', [x, BASE_Y + 0.55, z])),
    ...[[-0.25, 0.25], [-0.25, -0.12]].map(([x, z]) => P(torus(0.065, 0.012, 4, 16), 'Warning', [x, BASE_Y + 0.74, z], [Math.PI / 2, 0, 0])),
    ...[-0.25, 0, 0.25].map((z) => P(box(0.02, 0.1, 0.16), 'Vent', [0.41, BASE_Y + 0.18, z])),
    P(box(0.03, 0.04, 0.84), 'Warning', [0.41, BASE_Y + 0.33, 0]),
  ],

  // Infrastructure: silo cluster and container racks.
  infrastructure: () => [
    ...deck(),
    tank(0.17, 0.62, 'Hull', -0.2, -0.22),
    tank(0.17, 0.5, 'Hull', -0.2, 0.2),
    ...[[-0.2, -0.22, 0.62], [-0.2, 0.2, 0.5]].map(([x, z, h]) => P(sphere(0.17, 14, 8), 'Hull', [x, BASE_Y + 0.08 + h, z], [0, 0, 0], [1, 0.45, 1])),
    ...[[-0.2, -0.22, 0.4], [-0.2, 0.2, 0.3]].map(([x, z, y]) => P(torus(0.172, 0.012, 4, 20), 'Accent', [x, BASE_Y + y, z], [Math.PI / 2, 0, 0])),
    ...[0, 1, 2].flatMap((row) => [0, 1].map((col) => P(box(0.24, 0.13, 0.3), (row + col) % 2 ? 'Cargo' : 'Warning', [0.24, BASE_Y + 0.15 + row * 0.14, -0.17 + col * 0.34]))),
    ...mirror(P(box(0.02, 0.48, 0.02), 'Trim', [0.38, BASE_Y + 0.32, 0.36])),
    P(box(0.02, 0.48, 0.02), 'Trim', [0.38, BASE_Y + 0.32, 0]),
    P(box(0.02, 0.02, 0.74), 'Trim', [0.38, BASE_Y + 0.56, 0]),
  ],

  // Science: research dome with antenna mast and dish.
  science: () => [
    ...deck(),
    P(cyl(0.4, 0.42, 0.14, 24), 'Hull', [0, BASE_Y + 0.15, 0]),
    P(sphere(0.36, 24, 12), 'Glass', [0, BASE_Y + 0.22, 0], [0, 0, 0], [1, 0.75, 1]),
    ...[0, 1, 2, 3].map((i) => P(box(0.02, 0.02, 0.72), 'Trim', [0, BASE_Y + 0.42, 0], [0, i * Math.PI / 4, 0])),
    P(cyl(0.02, 0.025, 0.5, 6), 'Trim', [0.3, BASE_Y + 0.5, 0.3]),
    P(lathe([[0.001, 0], [0.09, -0.02], [0.16, -0.07]], 18), 'HullDark', [0.3, BASE_Y + 0.75, 0.3], [-0.6, 0, 0.5]),
    P(sphere(0.025, 8, 6), 'Light', [0.3, BASE_Y + 0.79, 0.3]),
    ...[0, 1, 2].map((i) => P(box(0.12, 0.02, 0.06), 'Accent', [0.42, BASE_Y + 0.1, -0.2 + i * 0.2])),
  ],

  // Space: shipyard gantry with truss frame, crane and docking ring.
  space: () => [
    ...deck(),
    ...mirror(P(box(0.05, 0.7, 0.05), 'Trim', [0.38, BASE_Y + 0.43, 0.38])),
    ...mirror(P(box(0.05, 0.7, 0.05), 'Trim', [-0.38, BASE_Y + 0.43, 0.38])),
    P(box(0.82, 0.05, 0.05), 'Trim', [0, BASE_Y + 0.78, 0.38]),
    P(box(0.82, 0.05, 0.05), 'Trim', [0, BASE_Y + 0.78, -0.38]),
    ...mirror(P(box(0.05, 0.05, 0.82), 'Warning', [0.38, BASE_Y + 0.78, 0])),
    ...[-0.38, 0.38].flatMap((z) => [-0.38, 0.38].map((x) => P(box(0.03, 0.95, 0.03), 'HullDark', [x * 0.5, BASE_Y + 0.43, z], [0, 0, x > 0 ? 0.6 : -0.6], [1, 0.62, 1]))),
    P(box(0.12, 0.08, 0.86), 'Cargo', [0.1, BASE_Y + 0.72, 0]),
    P(cyl(0.008, 0.008, 0.36, 4), 'Trim', [0.1, BASE_Y + 0.5, 0.05]),
    P(box(0.06, 0.04, 0.06), 'Warning', [0.1, BASE_Y + 0.3, 0.05]),
    P(torus(0.24, 0.035, 6, 28), 'HullDark', [0.42, BASE_Y + 0.36, 0], [0, Math.PI / 2, 0]),
    P(torus(0.24, 0.012, 4, 28), 'Engine', [0.45, BASE_Y + 0.36, 0], [0, Math.PI / 2, 0]),
    ...[[0.38, 0.38], [-0.38, 0.38], [0.38, -0.38], [-0.38, -0.38]].map(([x, z]) => P(sphere(0.025, 6, 4), 'Light', [x, BASE_Y + 0.82, z])),
  ],
};
