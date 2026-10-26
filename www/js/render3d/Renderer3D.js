import { THREE, disposeTextures } from './common.js';
import { StationView } from './StationView.js';
import { PlanetView } from './PlanetView.js';
import { GalaxyView } from './GalaxyView.js';
import { viewForScreen } from './layout.js';

export function isWebGLAvailable() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const TAP_MOVE_PX = 8;
const TAP_MS = 350;
const PICK_RADIUS_PX = 36;

// Owns the single WebGL canvas behind the UI. The 3D layer only reads game
// state; UI code tells it which screen is active and where to anchor scenes.
export class Renderer3D {
  constructor(game, quality, { reduceMotion = false } = {}) {
    this.game = game;
    this.quality = quality;
    this.reduceMotion = reduceMotion;
    this.views = {};
    this.active = null;
    this.anchor = null; // () => { x, y } screen point (CSS px) for the scene centre
    this.viewport = null; // () => DOMRect of the interactive galaxy area
    this.paused = false;
    this.lastFrame = 0;
    this.lastTime = 0;
    this.onGalaxyFrame = null;
    this.frame = this.frame.bind(this);
  }

  mount(parent) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'scene3d';
    this.canvas.setAttribute('aria-hidden', 'true');
    parent.prepend(this.canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: this.quality.antialias, powerPreference: 'low-power', alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x05080f, 1);
    this.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; }, false);
    this.canvas.addEventListener('webglcontextrestored', () => { this.lost = false; this.rebuild(); }, false);
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.resize();
    document.documentElement.classList.add('has-3d');
    requestAnimationFrame(this.frame);
  }

  view(name) {
    if (!this.views[name]) {
      const Ctor = { station: StationView, planet: PlanetView, galaxy: GalaxyView }[name];
      this.views[name] = new Ctor(this.quality);
    }
    return this.views[name];
  }

  setScreen(screenId, { anchor = null, viewport = null } = {}) {
    const { view, camera } = viewForScreen(screenId);
    this.active = this.view(view);
    this.activeName = view;
    this.active.setCamera?.(camera);
    this.anchor = anchor;
    this.viewport = viewport;
    this.canvas.dataset.view = view;
    this.canvas.dataset.screen = screenId;
  }

  pulseReactor() {
    this.views.station?.doPulse();
  }

  focusPlanet(id) {
    this.view('planet').focus(id);
  }

  setReduceMotion(on) {
    this.reduceMotion = Boolean(on);
  }

  pause() { this.paused = true; }
  resume() { this.paused = false; this.lastTime = 0; }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
  }

  // Shifts the projection so the world origin (scene target) lands on the
  // anchor point on screen, letting the 3D scene line up with UI elements.
  applyAnchor(camera) {
    const { w, h } = this.size;
    camera.aspect = w / h;
    const p = this.anchor?.();
    if (p) camera.setViewOffset(w, h, w / 2 - p.x, h / 2 - p.y, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  frame(now) {
    if (this.disposed) return;
    requestAnimationFrame(this.frame);
    if (this.paused || this.lost || document.hidden || !this.active) return;
    const fps = this.reduceMotion ? 12 : this.quality.fps;
    if (now - this.lastFrame < 1000 / fps - 1) return;
    const dt = this.lastTime ? Math.min(0.1, (now - this.lastTime) / 1000) : 1 / fps;
    this.lastTime = now;
    this.lastFrame = now;
    const motion = !this.reduceMotion;
    this.active.update(dt, this.game, { motion });
    this.applyAnchor(this.active.camera);
    this.renderer.render(this.active.scene, this.active.camera);
    if (this.activeName === 'galaxy' && this.onGalaxyFrame && this.viewport) {
      const r = this.viewport();
      if (r) this.onGalaxyFrame(this.active.projectSectors({ x: 0, y: 0, w: this.size.w, h: this.size.h }), r);
    }
  }

  // Pointer controls for the galaxy viewport: drag = rotate, pinch/wheel =
  // zoom, tap = pick the nearest sector (screen space).
  attachGalaxyControls(element, onPick) {
    const pointers = new Map();
    let start = null;
    let pinch = null;
    const galaxy = () => this.view('galaxy');
    element.addEventListener('pointerdown', (e) => {
      element.setPointerCapture?.(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) start = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
        start = null;
      }
    });
    element.addEventListener('pointermove', (e) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      pointers.set(e.pointerId, cur);
      if (pointers.size === 2 && pinch) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > 0) galaxy().zoom(pinch / d);
        pinch = d;
        return;
      }
      galaxy().rotate(cur.x - prev.x, cur.y - prev.y);
      if (start && Math.hypot(cur.x - start.x, cur.y - start.y) > TAP_MOVE_PX) start.moved = true;
    });
    const end = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (start && !start.moved && performance.now() - start.t < TAP_MS && e.type === 'pointerup') {
        onPick(this.pick(e.clientX, e.clientY));
      }
      if (!pointers.size) start = null;
    };
    element.addEventListener('pointerup', end);
    element.addEventListener('pointercancel', end);
    element.addEventListener('wheel', (e) => {
      e.preventDefault();
      galaxy().zoom(e.deltaY > 0 ? 1.1 : 0.9);
    }, { passive: false });
  }

  pick(x, y) {
    const g = this.views.galaxy;
    if (!g) return null;
    const pts = g.projectSectors({ x: 0, y: 0, w: this.size.w, h: this.size.h });
    let best = null;
    for (const [id, p] of Object.entries(pts)) {
      if (!p.visible) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= PICK_RADIUS_PX && (!best || d < best.d)) best = { id, d };
    }
    return best?.id ?? null;
  }

  selectSector(id) {
    this.view('galaxy').select(id);
  }

  rebuild() {
    for (const v of Object.values(this.views)) v.dispose();
    this.views = {};
    disposeTextures();
    const screen = this.canvas.dataset.screen;
    if (screen) this.setScreen(screen, { anchor: this.anchor, viewport: this.viewport });
  }

  dispose() {
    this.disposed = true;
    window.removeEventListener('resize', this.onResize);
    for (const v of Object.values(this.views)) v.dispose();
    this.views = {};
    disposeTextures();
    this.renderer?.dispose();
    this.canvas?.remove();
    document.documentElement.classList.remove('has-3d');
  }
}
