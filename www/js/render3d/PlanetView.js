import { THREE, starField, nebulaSphere, atmosphere, canvasTexture, glowSprite, disposeObject } from './common.js';
import { planetSurfaceCanvas, cloudCanvas } from './textures.js';
import { PLANET_MAP } from '../../data/planets.js';
import { PLANET_LOOK, planetModelId } from './layout.js';
import { modelLibrary, makePlanet } from './modelLibrary.js';


// One large planet in focus. Rebuilt when the focused planet, its
// terraforming stage or colony size changes.
export class PlanetView {
  constructor(quality) {
    this.quality = quality;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1200);
    this.camera.position.set(0, 3, 23);
    this.camera.lookAt(0, 0, 0);
    this.time = 0;
    this.planetId = null;
    this.signature = '';
    const s = this.scene;
    s.add(nebulaSphere(500, 'planets', quality.name === 'high' ? 1024 : 512));
    s.add(starField(quality.stars, 420, 23));
    s.add(new THREE.AmbientLight(0x404a66, 0.35));
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.6);
    sun.position.set(-30, 12, 18);
    s.add(sun);
    const sunGlow = glowSprite(0xfff1c4, 60, 0.6);
    sunGlow.position.set(-220, 90, 120);
    s.add(sunGlow);
    this.group = new THREE.Group();
    s.add(this.group);
  }

  focus(planetId) {
    this.planetId = PLANET_MAP[planetId] ? planetId : null;
  }

  sync(game) {
    const id = this.planetId;
    const colony = id ? game.colonies.colony(id) : null;
    const sig = `${id}:${colony?.terraform.stage ?? 0}:${colony ? game.colonies.totalLevels(id) : -1}:${id ? game.planets.status(id) : ''}:${modelLibrary.version}`;
    if (sig === this.signature) return;
    this.signature = sig;
    disposeObject(this.group);
    this.group.clear();
    if (!id) return;
    const p = PLANET_MAP[id];
    const known = game.planets.status(id) === 'analyzed' || game.planets.status(id) === 'colonized';
    const stage = colony?.terraform.stage ?? 0;
    const look = PLANET_LOOK[p.type] ?? PLANET_LOOK.rocky;
    const modelId = planetModelId(id, stage);
    modelLibrary.ensure('planet', modelId); // async; the signature includes the library version
    const glb = makePlanet(modelId);
    const radius = glb?.extras.radius ?? look.radius ?? 4.6;
    let surfaceRadius; // radius of the Surface mesh in its own coordinates
    if (glb) {
      glb.model.scale.setScalar(radius);
      this.group.add(glb.model);
      this.planet = glb.model.getObjectByName('Surface');
      this.clouds = glb.model.getObjectByName('Clouds') ?? null;
      surfaceRadius = 1;
      if (!known) {
        // Unanalysed: details unknown, so darken without touching shared materials.
        // The shell sits above the clouds (1.015) to avoid z-fighting with the surface.
        this.planet.add(new THREE.Mesh(new THREE.SphereGeometry(1.03, 48, 24), new THREE.MeshBasicMaterial({ color: 0x0a0e16, transparent: true, opacity: 0.55, depthWrite: false })));
      }
    } else {
      this.buildProcedural(p, id, radius, stage, known, look);
      surfaceRadius = radius;
    }
    const intensity = stage > 0 ? 1.1 : look.atmosphereIntensity;
    this.group.add(atmosphere(radius * 1.06, glb?.extras.atmosphere ?? look.atmosphere, intensity));
    if (p.type === 'anomaly') {
      const singularity = glowSprite(0xe9b8ff, 4, 0.9);
      singularity.position.set(radius * 1.8, 1.5, -1);
      this.group.add(singularity);
    }
    // City lights: one glowing dot per colony building level (bounded).
    this.lights = null;
    if (colony) {
      const n = Math.min(160, game.colonies.totalLevels(id) * 4);
      if (n > 0) {
        const pos = new Float32Array(n * 3);
        let seed = 9;
        const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        for (let i = 0; i < n; i++) {
          const u = rand() * 1.6 - 0.8; const th = rand() * Math.PI * 2; const k = Math.sqrt(1 - u * u);
          const r = surfaceRadius * 1.005;
          pos.set([Math.cos(th) * k * r, u * r, Math.sin(th) * k * r], i * 3);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.lights = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffd27a, size: 0.12, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
        this.planet.add(this.lights);
      }
    }
    // A small moon.
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), new THREE.MeshStandardMaterial({ color: 0x9a9890, roughness: 1 }));
    this.moonPivot = new THREE.Group();
    moon.position.set(radius * 2.4, 0.6, 0);
    this.moonPivot.add(moon);
    this.group.add(this.moonPivot);
  }

  // Fallback while the planet GLB loads (or if it is unavailable): the same
  // generators the GLB build uses, drawn on canvases at runtime.
  buildProcedural(p, id, radius, stage, known, look) {
    const width = this.quality.name === 'high' ? 1024 : 512;
    const tex = canvasTexture(`surf:${p.type}:${id}:${width}:${stage}`, () => planetSurfaceCanvas(p.type, id, { width, terraformStage: stage }));
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: look.roughness, metalness: 0 });
    if (!known) mat.color.setHex(0x55606e);
    this.planet = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 48), mat);
    this.planet.rotation.z = 0.35;
    this.group.add(this.planet);
    this.clouds = null;
    if (look.clouds || stage > 0) {
      const ct = canvasTexture(`clouds:${id}:${width}`, () => cloudCanvas(id, width / 2));
      this.clouds = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.015, 48, 32), new THREE.MeshStandardMaterial({ map: ct, transparent: true, depthWrite: false, opacity: p.type === 'toxic' ? 0.6 : 0.85 }));
      this.group.add(this.clouds);
    }
    if (look.rings) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(radius * 1.35, radius * 2.1, 96),
        new THREE.MeshBasicMaterial({ color: 0xe8cfa0, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }),
      );
      ring.rotation.x = Math.PI / 2.3;
      this.group.add(ring);
    }
  }

  update(dt, game, { motion }) {
    this.sync(game);
    this.time += dt;
    if (!this.planet) return;
    if (motion) {
      this.planet.rotation.y += dt * 0.06;
      if (this.clouds) this.clouds.rotation.y += dt * 0.085;
      this.moonPivot.rotation.y += dt * 0.12;
      this.group.position.y = Math.sin(this.time * 0.4) * 0.15;
    }
  }

  dispose() {
    disposeObject(this.scene);
  }
}
