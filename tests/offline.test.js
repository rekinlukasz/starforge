import { describe, it, expect } from 'vitest';
import { Game, OFFLINE_THRESHOLD_SECONDS } from '../www/js/core/Game.js';
import { MemoryStorageAdapter } from '../www/js/persistence/StorageAdapter.js';
import { BigNumber } from '../www/js/utils/BigNumber.js';

const T0 = 1_700_000_000_000;
const HOUR = 3600 * 1000;

function setup() {
  const g = new Game({ storage: new MemoryStorageAdapter(), now: T0 });
  g.state.buildings.asteroidMine.level = 2; // +1 metal/s (+0.2 core salvage), -0.4 energy/s
  g.state.buildings.asteroidMine.unlocked = true;
  g.state.buildings.cargoDepot.level = 60; // big caps (1.2^60) so limits don't interfere
  g.modifiers.invalidate();
  return g;
}

// Live reference run of the same duration (1 s steps).
function liveMetal(seconds) {
  const live = setup();
  live.simulate(seconds);
  return live.resources.amount('metal').toNumber();
}

// Offline uses larger adaptive steps; achievements unlocked mid-run can land
// a step later, so allow a small relative tolerance.
function expectRelClose(actual, expected, rel = 0.005) {
  // Absolute floor of 1 unit so near-zero stocks (fully consumed inputs) compare sanely.
  expect(Math.abs(actual - expected)).toBeLessThan(Math.max(1, Math.abs(expected) * rel));
}

describe('Offline progress', () => {
  it('no absence: nothing to simulate', () => {
    const g = setup();
    const { report } = g.offline.prepare(T0);
    expect(report.awaySeconds).toBe(0);
    expect(report.changes).toHaveLength(0);
  });

  it('short gaps are simulated live, long gaps require the offline flow', () => {
    const g = setup();
    expect(g.update(T0 + 10_000)).toBe(true);
    expect(g.resources.amount('metal').toNumber()).toBeCloseTo(liveMetal(10), 6);
    expect(g.update(T0 + 10_000 + (OFFLINE_THRESHOLD_SECONDS + 5) * 1000)).toBe(false);
  });

  it('short absence matches live production exactly', () => {
    const live = setup();
    const off = setup();
    live.simulate(600);
    const pending = off.offline.prepare(T0 + 600_000);
    off.offline.accept(pending);
    expect(off.resources.amount('metal').toNumber()).toBeCloseTo(live.resources.amount('metal').toNumber(), 6);
  });

  it('does not touch the live state until accepted', () => {
    const g = setup();
    const pending = g.offline.prepare(T0 + HOUR);
    expect(g.resources.amount('metal').toNumber()).toBe(20);
    expect(pending.report.creditedSeconds).toBe(3600);
    g.offline.accept(pending);
    expectRelClose(g.resources.amount('metal').toNumber(), liveMetal(3600));
  });

  it('caps credited time at the configured offline limit', () => {
    const g = setup();
    const pending = g.offline.prepare(T0 + 30 * HOUR);
    expect(pending.report.awaySeconds).toBe(30 * 3600);
    expect(pending.report.creditedSeconds).toBe(8 * 3600);
    g.offline.accept(pending);
    expectRelClose(g.resources.amount('metal').toNumber(), liveMetal(8 * 3600));
  });

  it('offline cap is configurable', () => {
    const g = setup();
    g.setOfflineCap(2);
    expect(g.offline.prepare(T0 + 5 * HOUR).report.creditedSeconds).toBe(2 * 3600);
  });

  it('respects storage limits', () => {
    const g = setup();
    g.state.buildings.cargoDepot.level = 0;
    g.modifiers.invalidate();
    const pending = g.offline.prepare(T0 + 2 * HOUR);
    g.offline.accept(pending);
    expect(g.resources.amount('metal').eq(g.resources.cap('metal'))).toBe(true);
    expect(pending.report.events.some((e) => e.includes('Magazyn pełny'))).toBe(true);
  });

  it('never grants the same period twice', () => {
    const g = setup();
    g.offline.accept(g.offline.prepare(T0 + HOUR));
    const after = g.resources.amount('metal').toNumber();
    const again = g.offline.prepare(T0 + HOUR);
    expect(again.report.creditedSeconds).toBe(0);
    g.offline.accept(again);
    expect(g.resources.amount('metal').toNumber()).toBe(after);
    expect(g.update(T0 + HOUR)).toBe(true);
    expect(g.resources.amount('metal').toNumber()).toBe(after);
  });

  it('clock rolled back: no rewards, and rolling forward again does not replay', () => {
    const g = setup();
    g.offline.accept(g.offline.prepare(T0 + HOUR));
    const after = g.resources.amount('metal').toNumber();
    // Device clock moved 5 h into the past.
    expect(g.update(T0 - 4 * HOUR)).toBe(true);
    expect(g.offline.prepare(T0 - 4 * HOUR).report.creditedSeconds).toBe(0);
    expect(g.resources.amount('metal').toNumber()).toBe(after);
    // Back to the original time: still nothing new.
    expect(g.offline.prepare(T0 + HOUR).report.creditedSeconds).toBe(0);
  });

  it('handles an invalid timestamp in the save', () => {
    const storage = new MemoryStorageAdapter();
    storage.set('starforge.save', JSON.stringify({ version: 2, meta: { lastSimulationAt: 'tomorrow' } }));
    const g = new Game({ storage, now: T0 });
    g.load(T0);
    expect(g.state.meta.lastSimulationAt).toBe(T0);
    expect(g.offline.prepare(T0).report.creditedSeconds).toBe(0);
  });

  it('production stalls cleanly when inputs are missing', () => {
    const g = new Game({ storage: new MemoryStorageAdapter(), now: T0 });
    g.state.buildings.alloyFoundry.level = 3;
    g.state.buildings.alloyFoundry.unlocked = true;
    g.state.resources.metal.amount = BigNumber.from(12);
    g.modifiers.invalidate();
    const pending = g.offline.prepare(T0 + 8 * HOUR);
    g.offline.accept(pending);
    expect(g.resources.amount('metal').gte(0)).toBe(true);
    expect(g.resources.amount('metal').toNumber()).toBeLessThan(1);
    // Converted metal = stock + salvage; alloy output bounded by inputs and cap.
    const expected = Math.min(g.resources.cap('alloy').toNumber(), (12 + 0.2 * 8 * 3600) / 4 * 1.5);
    expect(g.resources.amount('alloy').toNumber()).toBeCloseTo(expected, 3);
  });

  it('24 h split into sessions (1 h live + 7 h offline, x3) matches continuous play', () => {
    const build = () => {
      const g = setup();
      g.state.buildings.solarArray.level = 10;
      g.state.buildings.researchLab.level = 5;
      g.state.buildings.alloyFoundry.level = 2;
      g.state.resources.researchData.amount = BigNumber.from(500);
      g.modifiers.invalidate();
      g.startResearch('oreAnalysis');
      return g;
    };
    const continuous = build();
    continuous.simulate(24 * 3600);
    const sessions = build();
    let now = T0;
    for (let i = 0; i < 3; i++) {
      sessions.simulate(3600);
      now += 3600_000;
      sessions.state.meta.lastSimulationAt = now;
      now += 7 * 3600_000;
      sessions.offline.accept(sessions.offline.prepare(now));
    }
    for (const r of ['metal', 'alloy', 'researchData']) {
      expectRelClose(sessions.resources.amount(r).toNumber(), continuous.resources.amount(r).toNumber(), 0.01);
    }
    expect(sessions.research.isCompleted('oreAnalysis')).toBe(true);
    expect(sessions.state.stats.offlineSecondsGranted).toBe(3 * 7 * 3600);
  }, 30000); // 86 400 one-second live steps for the reference run

  it('8 hours simulate quickly', () => {
    const g = setup();
    const start = performance.now();
    g.offline.prepare(T0 + 8 * HOUR);
    expect(performance.now() - start).toBeLessThan(1500);
  });
});
