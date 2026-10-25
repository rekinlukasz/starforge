import { describe, it, expect } from 'vitest';
import { Game } from '../www/js/core/Game.js';
import { BigNumber } from '../www/js/utils/BigNumber.js';

const T0 = 1_700_000_000_000;

function freshGame() {
  const g = new Game({ now: T0 });
  // Remove passive core production noise where it matters by zeroing energy use checks explicitly.
  return g;
}

function setLevel(g, id, level) {
  g.state.buildings[id].level = level;
  g.state.buildings[id].unlocked = true;
  g.modifiers.invalidate();
}

describe('ProductionSystem', () => {
  it('core produces 1 energy/s and 0.2 metal/s without buildings', () => {
    const g = freshGame();
    g.simulate(10);
    expect(g.resources.amount('energy').toNumber()).toBeCloseTo(60);
    expect(g.resources.amount('metal').toNumber()).toBeCloseTo(22);
  });

  it('cannot soft-lock: spending all starting metal on a solar array still allows a mine later', () => {
    const g = freshGame();
    expect(g.buyBuilding('solarArray', '1')).toBe(1); // 20 -> 5 metal
    g.simulate(30);
    expect(g.buyBuilding('asteroidMine', '1')).toBe(1);
  });

  it('single building produces according to its recipe', () => {
    const g = freshGame();
    setLevel(g, 'asteroidMine', 1); // +0.5 metal/s, -0.4 energy/s
    g.simulate(10);
    expect(g.resources.amount('metal').toNumber()).toBeCloseTo(20 + 10 * (0.5 + 0.2));
    expect(g.resources.amount('energy').toNumber()).toBeCloseTo(50 + 10 - 4);
  });

  it('levels sum linearly', () => {
    const g = freshGame();
    setLevel(g, 'asteroidMine', 4);
    g.simulate(10);
    expect(g.resources.amount('metal').toNumber()).toBeCloseTo(20 + (4 * 0.5 + 0.2) * 10);
  });

  it('applies technology/upgrade multipliers to outputs only', () => {
    const g = freshGame();
    setLevel(g, 'asteroidMine', 2);
    g.state.upgrades.diamondDrillHeads = true; // x2 mines
    g.modifiers.invalidate();
    g.simulate(10);
    expect(g.resources.amount('metal').toNumber()).toBeCloseTo(20 + (2 * 0.5 * 2 + 0.2) * 10);
    // energy use unchanged: 2 * 0.4 * 10 = 8
    expect(g.resources.amount('energy').toNumber()).toBeCloseTo(50 + 10 - 8);
  });

  it('milestones multiply outputs', () => {
    const g = freshGame();
    setLevel(g, 'solarArray', 10);
    expect(g.buildings.milestoneMultiplier('solarArray')).toBe(1.5);
    g.state.resources.energy.amount = BigNumber.ZERO;
    g.simulate(1);
    // 10 * 1 * 1.5 + 1 (core) = 16
    expect(g.resources.amount('energy').toNumber()).toBeCloseTo(16);
  });

  it('consumes inputs to make outputs (recipe chain)', () => {
    const g = freshGame();
    setLevel(g, 'alloyFoundry', 1); // -1 metal/s, -0.5 energy/s, +0.375 alloy/s
    g.state.resources.metal.amount = BigNumber.from(100);
    g.simulate(10);
    expect(g.resources.amount('metal').toNumber()).toBeCloseTo(100 - 10 + 2); // core salvage +0.2/s
    expect(g.resources.amount('alloy').toNumber()).toBeCloseTo(3.75);
  });

  it('throttles production when inputs run out, never going negative', () => {
    const g = freshGame();
    setLevel(g, 'alloyFoundry', 5); // needs 5 metal/s
    g.state.resources.metal.amount = BigNumber.from(10);
    g.simulate(10);
    expect(g.resources.amount('metal').gte(0)).toBe(true);
    expect(g.resources.amount('metal').toNumber()).toBeCloseTo(0, 6);
    // Only the 10 metal in stock + 2 salvaged can be converted: 12 / 4 * 1.5 = 4.5 alloy
    expect(g.resources.amount('alloy').toNumber()).toBeCloseTo(4.5, 4);
    // Once stock is gone the foundries run at the salvage rate: 0.2 / 5 = 4%
    expect(g.production.lastReport.efficiency.alloyFoundry).toBeCloseTo(0.04);
  });

  it('limited energy throttles all consumers proportionally', () => {
    const g = freshGame();
    g.state.resources.energy.amount = BigNumber.ZERO;
    setLevel(g, 'researchLab', 9); // demand 4.5 energy/s, supply 1/s (below milestone 10)
    g.simulate(1);
    expect(g.production.lastReport.efficiency.researchLab).toBeCloseTo(1 / 4.5);
    expect(g.resources.amount('energy').toNumber()).toBeCloseTo(0, 6);
    expect(g.resources.amount('researchData').toNumber()).toBeCloseTo(0.5);
  });

  it('result does not depend on simulation call frequency', () => {
    const a = freshGame();
    const b = freshGame();
    for (const g of [a, b]) {
      setLevel(g, 'asteroidMine', 3);
      setLevel(g, 'solarArray', 2);
      setLevel(g, 'deepCoreDrill', 2);
    }
    a.simulate(60);
    for (let i = 0; i < 600; i++) b.simulate(0.1);
    for (const id of ['energy', 'metal', 'silicon']) {
      expect(a.resources.amount(id).toNumber()).toBeCloseTo(b.resources.amount(id).toNumber(), 6);
    }
  });

  it('reports income, expense and net per second', () => {
    const g = freshGame();
    setLevel(g, 'asteroidMine', 2);
    g.simulate(1);
    const bal = g.production.balance('energy');
    expect(bal.income.toNumber()).toBeCloseTo(1);
    expect(bal.expense.toNumber()).toBeCloseTo(0.8);
    expect(bal.net.toNumber()).toBeCloseTo(0.2);
    expect(bal.timeToCap).toBeGreaterThan(0);
  });

  it('cargo depot raises caps', () => {
    const g = freshGame();
    const base = g.resources.cap('metal').toNumber();
    setLevel(g, 'cargoDepot', 2);
    expect(g.resources.cap('metal').toNumber()).toBeCloseTo(base * 1.2 * 1.2); // x1.2 per level
  });

  it('storage complex stacks with cargo depot', () => {
    const g = freshGame();
    const base = g.resources.cap('metal').toNumber();
    setLevel(g, 'cargoDepot', 2);
    setLevel(g, 'storageComplex', 2);
    expect(g.resources.cap('metal').toNumber()).toBeCloseTo(base * 1.2 ** 2 * 1.3 ** 2);
  });
});
