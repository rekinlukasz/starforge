import { THREE, starField, glowSprite, canvasTexture, disposeObject } from './common.js';
import { glowCanvas } from './textures.js';
import { SECTORS, SECTOR_MAP } from '../../data/sectors.js';
import { GALAXY_RADIUS, sectorPositions, sectorLinks, sectorState, expeditionPosition, HOME_SECTOR } from './layout.js';

const STATE_COLORS = { unknown: 0x4a556b, known: 0x3fd0c9, colonized: 0x6fdc8c, hostile: 0xef6b6b };
const MAX_FLEETS = 16;

// Spiral galaxy with sector nodes, discovery links and expeditions in flight.
export class GalaxyView {
  constructor(quality) {
    this.quality = quality;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
    this.time = 0;
    this.orbit = { yaw: 0.8, pitch: 0.95, distance: 62, target: new THREE.Vector3(0, 0, 0) };
    this.goal = { ...this.orbit, target: this.orbit.target.clone() };
    this.interactive = false;
    this.selected = null;
    this.positions = sectorPositions();
    this.build();
  }

  build() {
    const s = this.scene;
    s.add(starField(this.quality.stars, 800, 31));
    s.add(this.makeGalaxy(this.quality.galaxyStars));
    s.add(glowSprite(0xffe2b0, 26, 1));
    s.add(glowSprite(0xff9ad5, 55, 0.35));
    s.add(glowSprite(0x6f8cff, 85, 0.18));

    // Links (vertex colours updated per frame from discovery state).
    this.links = sectorLinks();
    const lpos = new Float32Array(this.links.length * 6);
    this.links.forEach(([a, b], i) => lpos.set([...this.positions[a], ...this.positions[b]], i * 6));
    const lgeo = new THREE.BufferGeometry();
    lgeo.setAttribute('position', new THREE.BufferAttribute(lpos, 3));
    lgeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.links.length * 6), 3));
    this.linkLines = new THREE.LineSegments(lgeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false }));
    s.add(this.linkLines);

    // Sector nodes
    this.nodes = new Map();
    for (const sec of SECTORS) {
      const g = new THREE.Group();
      g.position.set(...this.positions[sec.id]);
      const glow = glowSprite(STATE_COLORS.unknown, 4, 0.9);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), new THREE.MeshBasicMaterial({ color: STATE_COLORS.unknown }));
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.25, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      g.add(glow, orb, ring);
      s.add(g);
      this.nodes.set(sec.id, { group: g, glow, orb, ring, state: null });
    }

    // Fleet markers (pooled sprites)
    const fleetMat = new THREE.SpriteMaterial({ map: canvasTexture('fleet', () => glowCanvas(64, 'rgba(255,230,160,1)', 'rgba(255,200,80,0)')), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.fleets = Array.from({ length: MAX_FLEETS }, () => {
      const sp = new THREE.Sprite(fleetMat);
      sp.scale.setScalar(1.6);
      sp.visible = false;
      s.add(sp);
      return sp;
    });
  }

  makeGalaxy(count) {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    let seed = 42;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const inner = new THREE.Color(0xffe0b0);
    const outer = new THREE.Color(0x5f8cff);
    const pink = new THREE.Color(0xff8fd1);
    const c = new THREE.Color();
    const R = GALAXY_RADIUS * 1.25;
    for (let i = 0; i < count; i++) {
      const arm = i % 3;
      const r = Math.pow(rand(), 0.7) * R;
      const spin = r * 0.18;
      const spread = (rand() - 0.5) * (0.6 + r * 0.04) + (rand() - 0.5) * 0.4;
      const a = arm * ((Math.PI * 2) / 3) + spin + spread;
      const y = (rand() - 0.5) * (1 - r / R) * 3;
      pos.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3);
      c.copy(inner).lerp(outer, Math.min(1, r / R));
      if (rand() < 0.08) c.lerp(pink, 0.6);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: 1.15, vertexColors: true, transparent: true, opacity: 1, depthWrite: false,
      blending: THREE.AdditiveBlending, map: canvasTexture('star', () => glowCanvas(32)),
    });
    this.galaxy = new THREE.Points(geo, mat);
    return this.galaxy;
  }

  setCamera(mode) {
    this.interactive = mode === 'interactive';
    if (!this.interactive) {
      this.goal.distance = 70;
      this.goal.pitch = 1.0;
      this.goal.target.set(0, 0, 0);
    } else {
      this.goal.distance = 58;
      this.goal.pitch = 0.85;
    }
  }

  // ---- interaction (called by Renderer3D from pointer events) ------------

  rotate(dx, dy) {
    this.goal.yaw -= dx * 0.006;
    this.goal.pitch = Math.min(1.45, Math.max(0.15, this.goal.pitch + dy * 0.005));
    this.userTouched = true;
  }

  zoom(factor) {
    this.goal.distance = Math.min(110, Math.max(14, this.goal.distance * factor));
  }

  select(sectorId) {
    this.selected = SECTOR_MAP[sectorId] ? sectorId : null;
    if (this.selected) this.goal.target.set(...this.positions[this.selected]);
    else this.goal.target.set(0, 0, 0);
  }

  // Screen-space positions of sector nodes (CSS px within the viewport).
  projectSectors(viewport) {
    const out = {};
    const v = new THREE.Vector3();
    for (const [id, n] of this.nodes) {
      v.copy(n.group.position).project(this.camera);
      out[id] = {
        x: viewport.x + (v.x * 0.5 + 0.5) * viewport.w,
        y: viewport.y + (-v.y * 0.5 + 0.5) * viewport.h,
        visible: v.z < 1,
      };
    }
    return out;
  }

  // ---- per frame -----------------------------------------------------------

  update(dt, game, { motion }) {
    this.time += dt;
    for (const sec of SECTORS) {
      const n = this.nodes.get(sec.id);
      const st = sectorState(game, sec);
      if (st !== n.state) {
        n.state = st;
        n.glow.material.color.setHex(STATE_COLORS[st]);
        n.orb.material.color.setHex(STATE_COLORS[st]);
        n.glow.scale.setScalar(st === 'unknown' ? 2.5 : 4.5);
      }
      const sel = this.selected === sec.id;
      n.ring.material.opacity += ((sel ? 0.9 : 0) - n.ring.material.opacity) * Math.min(1, dt * 8);
      if (motion && st !== 'unknown') n.glow.material.opacity = 0.75 + Math.sin(this.time * 2 + sec.danger) * 0.15;
      if (sec.id === HOME_SECTOR) n.ring.material.opacity = Math.max(n.ring.material.opacity, 0.35);
    }
    // Link colours: bright when the destination is known.
    const colors = this.linkLines.geometry.attributes.color;
    this.links.forEach(([, b], i) => {
      const known = game.planets.isSectorDiscovered(b);
      const c = known ? [0.25, 0.8, 0.78] : [0.18, 0.22, 0.32];
      colors.array.set([...c, ...c], i * 6);
    });
    colors.needsUpdate = true;

    // Fleets in flight
    const active = (game.state.expeditions?.active ?? []).filter((e) => e.status === 'active');
    this.fleets.forEach((sp, i) => {
      const e = active[i];
      sp.visible = Boolean(e);
      if (!e) return;
      const def = game.expeditions.definition(e.kind, e.id);
      const sector = def?.sector ?? HOME_SECTOR;
      const p = expeditionPosition(this.positions, sector, game.expeditions.progress(e));
      sp.position.set(p[0], p[1] + 0.6, p[2]);
      sp.material.opacity = 0.9;
    });

    if (motion) {
      this.galaxy.rotation.y += dt * 0.004;
      if (!this.interactive || !this.userTouched) this.goal.yaw += dt * (this.interactive ? 0.02 : 0.035);
    }
    const o = this.orbit;
    const k = Math.min(1, dt * 3);
    o.yaw += (this.goal.yaw - o.yaw) * k;
    o.pitch += (this.goal.pitch - o.pitch) * k;
    o.distance += (this.goal.distance - o.distance) * k;
    o.target.lerp(this.goal.target, k);
    const cp = Math.cos(o.pitch);
    this.camera.position.set(
      o.target.x + Math.cos(o.yaw) * cp * o.distance,
      o.target.y + Math.sin(o.pitch) * o.distance,
      o.target.z + Math.sin(o.yaw) * cp * o.distance,
    );
    this.camera.lookAt(o.target);
  }

  dispose() {
    disposeObject(this.scene);
  }
}
