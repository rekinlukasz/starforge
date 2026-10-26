import { THREE, starField, nebulaSphere, glowSprite, atmosphere, canvasTexture, shipModel, disposeObject } from './common.js';
import { planetSurfaceCanvas } from './textures.js';
import { RING_CATEGORIES, categoryLevels, moduleCount, scaledCount, visibleShips } from './layout.js';

const RING_RADIUS = 7.5;
const CATEGORY_COLORS = {
  energy: 0xf2b84b, mining: 0xb08d57, processing: 0xef8f5b, infrastructure: 0x8aa4c8, science: 0x3fd0c9, space: 0xb48cff,
};

// Camera presets: target point, distance, yaw, pitch.
const CAMERAS = {
  home: { target: [0, 0, 0], distance: 24, yaw: 0.6, pitch: 0.42, orbit: 0.03 },
  industry: { target: [-4, 0, 4], distance: 15, yaw: 2.1, pitch: 0.35, orbit: 0.015 },
  labs: { target: [4, 0, 3], distance: 14, yaw: 0.9, pitch: 0.5, orbit: 0.015 },
  hangar: { target: [0, 0, 0], distance: 20, yaw: -0.4, pitch: 0.18, orbit: 0.02 },
};

// The orbital station. Reads game state (never writes) and rebuilds its
// structure only when the visible counts change.
export class StationView {
  constructor(quality) {
    this.quality = quality;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1200);
    this.cam = { ...CAMERAS.home };
    this.camGoal = CAMERAS.home;
    this.time = 0;
    this.pulse = 0;
    this.signature = '';
    this.build();
  }

  build() {
    const s = this.scene;
    s.add(nebulaSphere(500, 'station', this.quality.name === 'high' ? 1024 : 512));
    s.add(starField(this.quality.stars, 420, 11));
    s.add(new THREE.AmbientLight(0x6a7da0, 0.55));
    const sun = new THREE.DirectionalLight(0xfff2dd, 2.2);
    sun.position.set(60, 35, 40);
    s.add(sun);
    const sunGlow = glowSprite(0xfff1c4, 70, 0.7);
    sunGlow.position.set(240, 140, 160);
    s.add(sunGlow);

    // Background gas giant
    const giantTex = canvasTexture('giant', () => planetSurfaceCanvas('gas', 'station-giant', { width: this.quality.name === 'high' ? 512 : 256 }));
    const giant = new THREE.Mesh(new THREE.SphereGeometry(32, 48, 32), new THREE.MeshStandardMaterial({ map: giantTex, roughness: 1 }));
    giant.position.set(-240, -80, -330);
    giant.rotation.z = 0.25;
    s.add(giant);
    const halo = atmosphere(33.6, 0xf7d9a6, 0.9);
    halo.position.copy(giant.position);
    s.add(halo);
    this.giant = giant;

    // Station core / reactor
    this.station = new THREE.Group();
    s.add(this.station);
    this.coreMat = new THREE.MeshBasicMaterial({ color: 0x5ff0e6 });
    this.core = new THREE.Mesh(new THREE.SphereGeometry(1.1, 32, 24), this.coreMat);
    this.coreGlow = glowSprite(0x3fd0c9, 7, 0.85);
    this.station.add(this.core, this.coreGlow);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x9fb4c8, metalness: 0.75, roughness: 0.35 });
    this.reactorRings = [1.9, 2.5].map((r, i) => {
      const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 8, 64), i ? ringMat : new THREE.MeshBasicMaterial({ color: 0x3fd0c9 }));
      t.rotation.x = Math.PI / 2 + i * 0.6;
      this.station.add(t);
      return t;
    });

    // Habitat ring with spokes
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x7c8ca3, metalness: 0.7, roughness: 0.4 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(RING_RADIUS, 0.38, 14, 120), hullMat);
    ring.rotation.x = Math.PI / 2;
    this.station.add(ring);
    const lights = new THREE.Mesh(new THREE.TorusGeometry(RING_RADIUS, 0.4, 4, 120), new THREE.MeshBasicMaterial({ color: 0x3fd0c9, wireframe: true, transparent: true, opacity: 0.25 }));
    lights.rotation.x = Math.PI / 2;
    this.station.add(lights);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, RING_RADIUS - 2.6, 8), hullMat);
      spoke.position.set(Math.cos(a) * (RING_RADIUS + 2.6) / 2, 0, Math.sin(a) * (RING_RADIUS + 2.6) / 2);
      spoke.rotation.z = Math.PI / 2;
      spoke.rotation.y = -a;
      this.station.add(spoke);
    }

    this.dynamic = new THREE.Group(); // rebuilt when counts change
    this.station.add(this.dynamic);
    this.belt = new THREE.Group();
    s.add(this.belt);
    this.ships = new THREE.Group();
    s.add(this.ships);
    this.shipList = [];
  }

  // ---- structure from game state ----------------------------------------

  counts(game) {
    const levels = categoryLevels(game.state);
    const modules = Object.fromEntries(RING_CATEGORIES.map((c) => [c, moduleCount(levels[c], this.quality.modulesPerCategory)]));
    const solar = scaledCount(game.buildings.level('solarArray'), 0.6, 24);
    const asteroids = scaledCount(game.buildings.level('asteroidMine'), 6, this.quality.asteroids);
    const ships = visibleShips(game.state.fleet?.ships);
    return { modules, solar, asteroids, ships };
  }

  sync(game) {
    const c = this.counts(game);
    const sig = JSON.stringify([c.modules, c.solar, c.asteroids, c.ships.map((s) => s.id)]);
    if (sig === this.signature) return;
    this.signature = sig;
    this.rebuildModules(c);
    this.rebuildBelt(c.asteroids);
    this.rebuildShips(c.ships);
  }

  rebuildModules(c) {
    disposeObject(this.dynamic);
    this.dynamic.clear();
    const box = new THREE.BoxGeometry(0.55, 0.42, 0.55);
    const arc = (Math.PI * 2) / RING_CATEGORIES.length;
    RING_CATEGORIES.forEach((cat, ci) => {
      const n = c.modules[cat];
      if (!n) return;
      const mat = new THREE.MeshStandardMaterial({ color: 0x9aa9bd, metalness: 0.6, roughness: 0.4, emissive: CATEGORY_COLORS[cat], emissiveIntensity: 0.35 });
      const mesh = new THREE.InstancedMesh(box, mat, n);
      const m = new THREE.Matrix4();
      const perRow = 8;
      for (let i = 0; i < n; i++) {
        const row = Math.floor(i / perRow);
        const col = i % perRow;
        const a = ci * arc + 0.12 + (col / perRow) * (arc - 0.24);
        const r = RING_RADIUS + 0.8 + row * 0.7;
        const y = (col % 2 ? 0.35 : -0.35) * (row ? 0.4 : 1);
        m.makeRotationY(-a);
        m.setPosition(Math.cos(a) * r, y, Math.sin(a) * r);
        mesh.setMatrixAt(i, m);
      }
      this.dynamic.add(mesh);
    });
    // Solar panel arms
    if (c.solar) {
      const panel = new THREE.PlaneGeometry(1.4, 0.7);
      const mat = new THREE.MeshStandardMaterial({ color: 0x1d3f8a, emissive: 0x16306a, emissiveIntensity: 0.6, metalness: 0.4, roughness: 0.3, side: THREE.DoubleSide });
      const mesh = new THREE.InstancedMesh(panel, mat, c.solar);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
      for (let i = 0; i < c.solar; i++) {
        const side = i % 2 ? 1 : -1;
        const k = Math.floor(i / 2);
        m.compose(new THREE.Vector3(0, 0, side * (RING_RADIUS + 2.4 + k * 0.8)), q, new THREE.Vector3(1, 1, 1));
        mesh.setMatrixAt(i, m);
      }
      this.dynamic.add(mesh);
      const truss = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, (RING_RADIUS + 3 + Math.ceil(c.solar / 2) * 0.8) * 2, 6), new THREE.MeshStandardMaterial({ color: 0x8090a0 }));
      truss.rotation.x = Math.PI / 2;
      this.dynamic.add(truss);
    }
  }

  rebuildBelt(count) {
    disposeObject(this.belt);
    this.belt.clear();
    if (!count) return;
    const geo = new THREE.IcosahedronGeometry(0.35, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a7a68, roughness: 1, flatShading: true });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    let seed = 3;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < count; i++) {
      // Wide belt around the whole scene: the camera sits inside it, so the
      // rocks frame the horizon instead of crowding the station.
      const a = rand() * Math.PI * 2;
      const r = 38 + rand() * 14;
      const sc = 0.8 + rand() * 2.2;
      m.compose(
        new THREE.Vector3(Math.cos(a) * r, (rand() - 0.5) * 6 - 4, Math.sin(a) * r),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * 3, rand() * 3, rand() * 3)),
        new THREE.Vector3(sc, sc * (0.6 + rand() * 0.6), sc),
      );
      mesh.setMatrixAt(i, m);
    }
    this.belt.add(mesh);
  }

  rebuildShips(list) {
    disposeObject(this.ships);
    this.ships.clear();
    this.shipList = list.map((s, i) => {
      const model = shipModel(s.id);
      const scale = s.id === 'cruiser' ? 1.3 : 1;
      model.scale.setScalar(scale);
      this.ships.add(model);
      return { model, radius: 10 + (i % 5) * 1.3, speed: 0.12 + (i % 3) * 0.04, phase: i * 1.9, height: ((i % 4) - 1.5) * 0.9 };
    });
  }

  // ---- per frame -----------------------------------------------------------

  setCamera(mode) {
    this.camGoal = CAMERAS[mode] ?? CAMERAS.home;
  }

  doPulse() {
    this.pulse = 1;
  }

  update(dt, game, { motion }) {
    this.sync(game);
    this.time += dt;
    const overcharged = game.modifiers.isOvercharged();
    const color = overcharged ? 0xffc46b : 0x5ff0e6;
    this.coreMat.color.setHex(color);
    this.coreGlow.material.color.setHex(overcharged ? 0xf2b84b : 0x3fd0c9);
    this.pulse = Math.max(0, this.pulse - dt * 4);
    const breathe = motion ? Math.sin(this.time * 2) * 0.05 : 0;
    this.core.scale.setScalar(1 + this.pulse * 0.25 + breathe);
    this.coreGlow.scale.setScalar((overcharged ? 9 : 7) * (1 + this.pulse * 0.4 + breathe));
    if (motion) {
      this.reactorRings[0].rotation.z += dt * 0.8;
      this.reactorRings[1].rotation.y += dt * 0.5;
      this.station.rotation.y += dt * 0.04;
      this.belt.rotation.y += dt * 0.01;
      this.giant.rotation.y += dt * 0.01;
      for (const s of this.shipList) {
        const a = s.phase + this.time * s.speed;
        s.model.position.set(Math.cos(a) * s.radius, s.height, Math.sin(a) * s.radius);
        s.model.rotation.y = -a; // face along the orbit
      }
    } else {
      for (const s of this.shipList) s.model.position.set(Math.cos(s.phase) * s.radius, s.height, Math.sin(s.phase) * s.radius);
    }
    // Smooth camera transition and slow orbit.
    const g = this.camGoal;
    const k = Math.min(1, dt * 2.5);
    const c = this.cam;
    c.distance += (g.distance - c.distance) * k;
    c.pitch += (g.pitch - c.pitch) * k;
    c.target = c.target.map((v, i) => v + (g.target[i] - v) * k);
    const baseYaw = g.yaw + (motion ? this.time * g.orbit : 0);
    c.yaw += (baseYaw - c.yaw) * k;
    const cp = Math.cos(c.pitch);
    this.camera.position.set(
      c.target[0] + Math.cos(c.yaw) * cp * c.distance,
      c.target[1] + Math.sin(c.pitch) * c.distance,
      c.target[2] + Math.sin(c.yaw) * cp * c.distance,
    );
    this.camera.lookAt(c.target[0], c.target[1], c.target[2]);
  }

  dispose() {
    disposeObject(this.scene);
  }
}
