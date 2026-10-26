import { THREE, glowSprite, proceduralShipModel } from './common.js';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';

// Loads the game's GLB models (built by tools/build-models.mjs, replaceable by
// artist-made files with the same names):
//   assets/ships/<shipId>.glb       ships (node extras: engines anchors)
//   assets/station/<category>.glb   station ring modules
//   assets/planets/<planetId>.glb   textured planets (loaded on demand via ensure())
// Loaded sources are shared: instances reuse their geometry and materials
// (meshes flagged userData.shared so scene cleanup never disposes them).
export const MODEL_URLS = {
  ship: (id) => `assets/ships/${id}.glb`,
  module: (id) => `assets/station/${id}.glb`,
  planet: (id) => `assets/planets/${id}.glb`,
};

class ModelLibrary {
  constructor() {
    this.sources = new Map(); // "kind:id" -> { root, meshes, extras }
    this.version = 0; // bumps when models arrive, so scenes rebuild
    this.loading = null;
    this.generation = 0; // a dispose() invalidates loads still in flight
    this.pending = new Set();
    this.failed = new Set();
  }

  async loadOne(loader, kind, id, gen) {
    const key = `${kind}:${id}`;
    this.pending.add(key);
    try {
      const gltf = await loader.loadAsync(MODEL_URLS[kind](id));
      if (gen !== this.generation) return;
      const root = gltf.scene;
      const meshes = [];
      let extras = {};
      root.updateMatrixWorld(true);
      root.traverse((o) => {
        if (o.isMesh) { o.userData.shared = true; meshes.push(o); }
        if (o.name === id && o.userData && Object.keys(o.userData).length) extras = o.userData;
      });
      this.sources.set(key, { root, meshes, extras });
    } catch (err) {
      this.failed.add(key);
      console.warn(`[3D] model ${kind}/${id} unavailable, using fallback`, err);
    } finally {
      this.pending.delete(key);
    }
  }

  // On-demand load of a single model (planets). Bumps `version` on arrival.
  ensure(kind, id) {
    const key = `${kind}:${id}`;
    if (this.sources.has(key) || this.pending.has(key) || this.failed.has(key)) return;
    const gen = this.generation;
    this.loadOne(new GLTFLoader(), kind, id, gen).then(() => { if (gen === this.generation) this.version += 1; });
  }

  // requests: [{ kind: 'ship' | 'module', id }]
  load(requests) {
    if (this.loading) return this.loading;
    const loader = new GLTFLoader();
    const gen = this.generation;
    this.loading = Promise.all(requests.map(({ kind, id }) => this.loadOne(loader, kind, id, gen)))
      .then(() => { if (gen === this.generation) this.version += 1; });
    return this.loading;
  }

  get(kind, id) {
    return this.sources.get(`${kind}:${id}`) ?? null;
  }

  // Ship instance with engine glows from the node extras.
  createShip(id) {
    const src = this.get('ship', id);
    if (!src) return null;
    const model = src.root.clone(true);
    // One glow for the whole engine cluster keeps each ship at 3 draw calls.
    const engines = src.extras.engines ?? [];
    if (engines.length) {
      const avg = engines.reduce((acc, e) => acc.map((v, i) => v + e[i] / engines.length), [0, 0, 0, 0]);
      const g = glowSprite(0x5ff0e6, avg[3] * (engines.length > 1 ? 1.6 : 1), 0.95);
      g.position.set(avg[0], avg[1], avg[2]);
      model.add(g);
    }
    return model;
  }

  // Instanced copies of a module: one InstancedMesh per primitive (Body/Glow),
  // all sharing the given instance matrices. Returns a Group or null.
  createModuleInstances(id, matrices) {
    const src = this.get('module', id);
    if (!src || !matrices.length) return null;
    const group = new THREE.Group();
    const local = new THREE.Matrix4();
    for (const mesh of src.meshes) {
      const inst = new THREE.InstancedMesh(mesh.geometry, mesh.material, matrices.length);
      inst.userData.shared = true; // geometry/material belong to the library
      for (let i = 0; i < matrices.length; i++) {
        local.multiplyMatrices(matrices[i], mesh.matrixWorld);
        inst.setMatrixAt(i, local);
      }
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
      group.add(inst);
    }
    return group;
  }

  dispose() {
    for (const { root } of this.sources.values()) {
      root.traverse((o) => {
        o.geometry?.dispose?.();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m?.dispose?.());
      });
    }
    this.sources.clear();
    this.pending.clear();
    this.failed.clear();
    this.loading = null;
    this.generation += 1;
    this.version += 1;
  }
}

export const modelLibrary = new ModelLibrary();

// Clone of a loaded planet model (shared geometry/materials/textures) or null.
export function makePlanet(modelId) {
  const src = modelLibrary.get('planet', modelId);
  return src ? { model: src.root.clone(true), extras: src.extras } : null;
}

// GLB model when loaded, procedural model otherwise.
export function makeShip(id) {
  return modelLibrary.createShip(id) ?? proceduralShipModel(id);
}
