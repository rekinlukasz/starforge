// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  viewForScreen, SCREEN_VIEWS, resolveQuality, moduleCount, scaledCount, visibleShips, categoryLevels,
  sectorPositions, sectorLinks, expeditionPosition, sectorState, defaultPlanet, GALAXY_RADIUS, HOME_SECTOR, SECTOR_MAP_2D,
} from '../www/js/render3d/layout.js';
import { SECTORS } from '../www/data/sectors.js';
import { Game } from '../www/js/core/Game.js';
import { UIManager } from '../www/js/ui/UIManager.js';
import { MemoryStorageAdapter } from '../www/js/persistence/StorageAdapter.js';
import { newGame, research, T0 } from './helpers.js';

describe('3D layout rules', () => {
  it('maps every UI screen to a 3D view', () => {
    for (const id of ['home', 'production', 'research', 'planets', 'fleet', 'exploration', 'galaxy']) {
      expect(['station', 'planet', 'galaxy']).toContain(viewForScreen(id).view);
    }
    expect(viewForScreen('unknown')).toEqual(SCREEN_VIEWS.home);
  });

  it('resolves graphics quality, including off and auto on weak devices', () => {
    expect(resolveQuality('off')).toBeNull();
    expect(resolveQuality('high').name).toBe('high');
    expect(resolveQuality('low').name).toBe('low');
    expect(resolveQuality('auto', { cores: 4, memory: 2 }).name).toBe('low');
    expect(resolveQuality('auto', { cores: 8, memory: 8, dpr: 2 }).name).toBe('high');
  });

  it('station module counts grow with levels but stay bounded', () => {
    expect(moduleCount(0, 24)).toBe(0);
    expect(moduleCount(1, 24)).toBeGreaterThan(0);
    expect(moduleCount(50, 24)).toBeGreaterThan(moduleCount(10, 24));
    expect(moduleCount(1e6, 24)).toBe(24);
    expect(scaledCount(1000, 6, 80)).toBe(80);
  });

  it('category levels sum building levels per ring category', () => {
    const g = newGame();
    g.state.buildings.solarArray.level = 3;
    g.state.buildings.asteroidMine.level = 5;
    const lv = categoryLevels(g.state);
    expect(lv.energy).toBe(3);
    expect(lv.mining).toBe(5);
  });

  it('caps visible ships per type and in total', () => {
    const ships = visibleShips({ scout: { owned: 50 }, miner: { owned: 2 } }, 6, 7);
    expect(ships.filter((s) => s.id === 'scout')).toHaveLength(6);
    expect(ships).toHaveLength(7);
  });

  it('places every sector inside the galaxy, at distinct spots matching the 2D map', () => {
    const pos = sectorPositions();
    const keys = new Set();
    for (const s of SECTORS) {
      const [x, , z] = pos[s.id];
      expect(Math.hypot(x, z)).toBeLessThanOrEqual(GALAXY_RADIUS * 1.25);
      keys.add(`${x.toFixed(2)},${z.toFixed(2)}`);
      if (SECTOR_MAP_2D[s.id]) expect(x).toBeCloseTo((SECTOR_MAP_2D[s.id][0] - 50) * 0.62);
    }
    expect(keys.size).toBe(SECTORS.length);
    for (const [a, b] of sectorLinks()) {
      expect(pos[a]).toBeTruthy();
      expect(pos[b]).toBeTruthy();
    }
  });

  it('fleets fly out to the sector and come back home', () => {
    const pos = sectorPositions();
    const target = SECTORS.find((s) => s.id !== HOME_SECTOR).id;
    const at = (p) => expeditionPosition(pos, target, p);
    expect(at(0)[0]).toBeCloseTo(pos[HOME_SECTOR][0]);
    expect(at(0.5)[0]).toBeCloseTo(pos[target][0]);
    expect(at(1)[2]).toBeCloseTo(pos[HOME_SECTOR][2]);
  });

  it('sector visual state follows discovery, colonies and danger', () => {
    const g = newGame();
    const home = SECTORS.find((s) => s.id === 'innerBelt');
    const haven = SECTORS.find((s) => s.id === 'pirateHaven');
    expect(sectorState(g, haven)).toBe('unknown');
    expect(sectorState(g, home)).toBe('known');
    g.colonies.found('kepler');
    expect(sectorState(g, home)).toBe('colonized');
    g.planets.discoverSector('pirateHaven');
    expect(sectorState(g, haven)).toBe('hostile');
  });

  it('default focused planet prefers colonies, then known planets', () => {
    const g = newGame();
    expect(defaultPlanet(g)).toBeNull();
    g.planets.discoverPlanet('thalassa');
    expect(defaultPlanet(g)).toBe('thalassa');
    g.colonies.found('kepler');
    expect(defaultPlanet(g)).toBe('kepler');
  });
});

describe('Graphics setting', () => {
  it('is validated, saved and loaded', () => {
    const storage = new MemoryStorageAdapter();
    const g = new Game({ storage, now: T0 });
    expect(g.state.settings.graphics).toBe('auto');
    expect(g.setGraphics('ultra')).toBe(false);
    expect(g.setGraphics('low')).toBe(true);
    g.save(T0);
    const g2 = new Game({ storage, now: T0 });
    g2.load(T0);
    expect(g2.state.settings.graphics).toBe('low');
    storage.set('starforge.save', JSON.stringify({ ...JSON.parse(storage.get('starforge.save')), settings: { graphics: '<script>' } }));
    g2.load(T0);
    expect(g2.state.settings.graphics).toBe('auto');
  });
});

describe('UI ↔ 3D contract', () => {
  function fakeRenderer() {
    return {
      quality: { name: 'low' },
      calls: [],
      pulses: 0,
      focused: null,
      setScreen(id, opts) { this.calls.push({ id, opts }); },
      pulseReactor() { this.pulses++; },
      focusPlanet(id) { this.focused = id; },
      showcaseShip(id) { this.showcased = id; },
      attachGalaxyControls() {},
      selectSector() {},
    };
  }

  function mount(g) {
    document.body.innerHTML = '<div id="root"></div>';
    const ui = new UIManager(g, document.getElementById('root'));
    ui.mount();
    return ui;
  }

  it('tells the renderer which screen is active, with anchors', () => {
    const g = newGame();
    research(g, 'spaceflight');
    g.colonies.found('kepler');
    const ui = mount(g);
    const r = fakeRenderer();
    ui.attach3D(r);
    expect(r.calls.at(-1).id).toBe('home');
    expect(typeof r.calls.at(-1).opts.anchor).toBe('function');
    ui.navigation.go('galaxy');
    expect(r.calls.at(-1).id).toBe('galaxy');
    expect(typeof r.calls.at(-1).opts.viewport).toBe('function');
    ui.navigation.go('planets');
    expect(r.focused).toBe('kepler');
    g.fleet.entry('frigate').owned = 1;
    ui.navigation.go('fleet');
    ui.render();
    document.querySelector('[data-ship="frigate"] .card-desc').click();
    expect(r.showcased).toBe('frigate');
  });

  it('reactor taps pulse the 3D reactor; the UI works without a renderer', () => {
    const g = newGame();
    const ui = mount(g);
    document.querySelector('.reactor').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    const r = fakeRenderer();
    ui.attach3D(r);
    document.querySelector('.reactor').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(r.pulses).toBe(1);
    ui.detach3D();
    document.querySelector('.reactor').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(r.pulses).toBe(1);
  });

  it('reports no WebGL in a non-WebGL environment so the game stays 2D', async () => {
    const { isWebGLAvailable } = await import('../www/js/render3d/Renderer3D.js');
    expect(isWebGLAvailable()).toBe(false);
  });
});
