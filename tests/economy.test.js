import { describe, it, expect } from 'vitest';
import { BigNumber, big } from '../www/js/utils/BigNumber.js';
import { formatNumber } from '../www/js/utils/Formatter.js';
import { Game } from '../www/js/core/Game.js';

const T0 = 1_700_000_000_000;

describe('BigNumber', () => {
  it('adds, subtracts, multiplies and divides', () => {
    expect(big(2).add(3).toNumber()).toBe(5);
    expect(big(10).sub(4).toNumber()).toBe(6);
    expect(big(1.5).mul(4).toNumber()).toBe(6);
    expect(big(9).div(3).toNumber()).toBeCloseTo(3);
  });

  it('handles values far beyond Number.MAX_VALUE', () => {
    const huge = new BigNumber(5, 500);
    const sum = huge.add(huge);
    expect(sum.e).toBe(501);
    expect(sum.m).toBeCloseTo(1);
    expect(huge.mul(huge).e).toBe(1001); // 25e1000 = 2.5e1001
    expect(huge.gt(big(Number.MAX_VALUE))).toBe(true);
    expect(huge.toNumber()).toBe(Infinity); // lossy conversion is explicit
  });

  it('compares correctly across magnitudes and signs', () => {
    expect(big(1e10).gt(big(9.99e9))).toBe(true);
    expect(big(-5).lt(1)).toBe(true);
    expect(big(-5).lt(-1)).toBe(true);
    expect(big(0).eq(BigNumber.ZERO)).toBe(true);
    expect(new BigNumber(1, 300).cmp(new BigNumber(1, 300))).toBe(0);
  });

  it('pow supports cost growth at huge levels', () => {
    const r = big(1.15).pow(5000);
    expect(r.log10()).toBeCloseTo(5000 * Math.log10(1.15), 6);
  });

  it('survives JSON round trip', () => {
    const v = new BigNumber(1.2345, 1234);
    const back = BigNumber.from(JSON.parse(JSON.stringify({ v })).v);
    expect(back.eq(v)).toBe(true);
  });

  it('rejects garbage as zero', () => {
    expect(BigNumber.from('abc').isZero()).toBe(true);
    expect(BigNumber.from(NaN).isZero()).toBe(true);
    expect(BigNumber.from({ m: 'x', e: 1 }).isZero()).toBe(true);
  });

  it('formats readable numbers', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(12.345)).toBe('12.3');
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(2.5e9)).toBe('2.5B');
    expect(formatNumber(new BigNumber(3, 100))).toBe('3.00e100');
  });
});

describe('ResourceSystem', () => {
  const game = () => new Game({ now: T0 });

  it('adds resources and tracks lifetime totals', () => {
    const g = game();
    g.resources.add('metal', 30);
    expect(g.resources.amount('metal').toNumber()).toBe(50);
    expect(g.state.resources.metal.totalEarned.toNumber()).toBe(30);
  });

  it('respects storage caps', () => {
    const g = game();
    const added = g.resources.add('metal', 10_000);
    expect(g.resources.amount('metal').eq(g.resources.cap('metal'))).toBe(true);
    expect(added.toNumber()).toBe(480);
  });

  it('never goes below zero on remove', () => {
    const g = game();
    const removed = g.resources.remove('silicon', 1000);
    expect(removed.toNumber()).toBe(10);
    expect(g.resources.amount('silicon').isZero()).toBe(true);
  });

  it('spend is atomic: all or nothing', () => {
    const g = game();
    expect(g.resources.spend({ metal: 10, silicon: 999 })).toBe(false);
    expect(g.resources.amount('metal').toNumber()).toBe(20);
    expect(g.resources.amount('silicon').toNumber()).toBe(10);
    expect(g.resources.spend({ metal: 10, silicon: 5 })).toBe(true);
    expect(g.resources.amount('metal').toNumber()).toBe(10);
  });

  it('rejects invalid costs', () => {
    const g = game();
    expect(g.resources.spend({ metal: -5 })).toBe(false);
    expect(g.resources.spend({ unobtainium: 1 })).toBe(false);
    expect(g.resources.spend(null)).toBe(false);
    expect(g.resources.amount('metal').toNumber()).toBe(20);
  });

  it('handles very large stocks for uncapped resources', () => {
    const g = game();
    g.resources.add('researchData', new BigNumber(1, 400));
    g.resources.add('researchData', new BigNumber(1, 400));
    expect(g.resources.amount('researchData').eq(new BigNumber(2, 400))).toBe(true);
  });
});

describe('BuildingSystem costs', () => {
  it('scales cost exponentially: base * growth^n', () => {
    const g = new Game({ now: T0 });
    expect(g.buildings.cost('asteroidMine').metal.toNumber()).toBeCloseTo(10);
    g.resources.add('metal', 200);
    g.buildings.buy('asteroidMine', 1);
    expect(g.buildings.cost('asteroidMine').metal.toNumber()).toBeCloseTo(11.5);
  });

  it('bulk cost equals sum of single costs', () => {
    const g = new Game({ now: T0 });
    let sum = 0;
    for (let k = 0; k < 10; k++) sum += 10 * Math.pow(1.15, k);
    expect(g.buildings.cost('asteroidMine', 10).metal.toNumber()).toBeCloseTo(sum, 6);
  });

  it('max affordable buys exactly what the player can pay', () => {
    const g = new Game({ now: T0 });
    g.resources.add('metal', 180); // 200 total
    const n = g.buildings.maxAffordable('asteroidMine');
    expect(g.resources.canAfford(g.buildings.cost('asteroidMine', n))).toBe(true);
    expect(g.resources.canAfford(g.buildings.cost('asteroidMine', n + 1))).toBe(false);
    expect(g.buyBuilding('asteroidMine', 'max')).toBe(n);
    expect(g.resources.amount('metal').gte(0)).toBe(true);
  });

  it('refuses locked buildings and invalid counts', () => {
    const g = new Game({ now: T0 });
    g.resources.add('metal', 400);
    expect(g.buildings.buy('alloyFoundry', 1)).toBe(0);
    expect(g.buildings.buy('asteroidMine', -3)).toBe(0);
    expect(g.buildings.buy('asteroidMine', 'abc')).toBe(0);
    expect(g.buildings.buy('nope', 1)).toBe(0);
  });

  it('buy to next milestone', () => {
    const g = new Game({ now: T0 });
    expect(g.buildings.countForMode('asteroidMine', 'next')).toBe(10);
  });

  it('unlocks follow-up buildings from conditions', () => {
    const g = new Game({ now: T0 });
    expect(g.buildings.isUnlocked('deepCoreDrill')).toBe(false);
    g.resources.add('metal', 100);
    g.buildings.buy('asteroidMine', 2);
    expect(g.buildings.isUnlocked('deepCoreDrill')).toBe(true);
  });
});

describe('Clicks and upgrades', () => {
  it('click gives base energy and upgrades increase it', () => {
    const g = new Game({ now: T0 });
    const before = g.resources.amount('energy').toNumber();
    g.click(T0);
    expect(g.resources.amount('energy').toNumber()).toBe(before + 1);
    g.resources.add('metal', 100);
    expect(g.buyUpgrade('reinforcedCoils')).toBe(true);
    expect(g.clicks.clickValue().toNumber()).toBe(2);
  });

  it('upgrades can be bought only once', () => {
    const g = new Game({ now: T0 });
    g.resources.add('metal', 200);
    expect(g.buyUpgrade('reinforcedCoils')).toBe(true);
    expect(g.buyUpgrade('reinforcedCoils')).toBe(false);
    expect(g.clicks.clickValue().toNumber()).toBe(2); // bonus not applied twice
  });

  it('rate-limits impossible click speeds', () => {
    const g = new Game({ now: T0 });
    let accepted = 0;
    for (let i = 0; i < 100; i++) if (g.click(T0 + i)) accepted++;
    expect(accepted).toBe(20);
  });

  it('overcharge triggers after full charge and boosts production', () => {
    const g = new Game({ now: T0 });
    g.state.upgrades.reactorOvercharge = true;
    g.modifiers.invalidate();
    for (let i = 0; i < 100; i++) g.click(T0 + i * 100);
    expect(g.modifiers.isOvercharged()).toBe(true);
    expect(g.modifiers.globalProductionMultiplier()).toBe(1.5);
    g.simulate(25);
    expect(g.modifiers.isOvercharged()).toBe(false);
  });
});
