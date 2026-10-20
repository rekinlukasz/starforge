import { describe, it, expect } from 'vitest';
import { newGame, rich, research, setBuilding, T0 } from './helpers.js';
import { TECHNOLOGIES } from '../www/data/technologies.js';
import { BigNumber } from '../www/js/utils/BigNumber.js';

function lateGame() {
  const g = newGame();
  // 60 techs (cheap ones first), three colonies, one megastructure stage.
  const ids = TECHNOLOGIES.filter((t) => !t.condition).sort((a, b) => a.tier - b.tier).slice(0, 60).map((t) => t.id);
  research(g, ...ids);
  g.colonies.found('kepler');
  g.colonies.found('thalassa');
  g.colonies.found('glacius');
  g.state.megastructures.dysonSwarm = { stage: 1, progress: 0, active: false };
  g.state.resources.energy.totalEarned = BigNumber.from(1e10);
  return g;
}

describe('Galactic Rebirth', () => {
  it('is unavailable before the requirement is met', () => {
    const g = newGame();
    expect(g.prestige.canRebirth()).toBe(false);
    expect(g.rebirth('scientist')).toBe(false);
  });

  it('computes points from energy, colonies and megastructures', () => {
    const g = lateGame();
    const b = g.prestige.pointsBreakdown();
    expect(b.fromEnergy).toBe(10); // sqrt(1e10 / 1e8)
    expect(b.fromColonies).toBe(9);
    expect(b.fromMega).toBe(5);
    expect(b.total).toBe(24);
  });

  it('requires a valid specialization', () => {
    const g = lateGame();
    expect(g.rebirth('pirate')).toBe(false);
    expect(g.colonies.has('kepler')).toBe(true);
  });

  it('resets the documented scope and keeps the rest', () => {
    const g = lateGame();
    rich(g, 1e6);
    setBuilding(g, 'asteroidMine', 50);
    g.state.upgrades.reinforcedCoils = true;
    g.state.achievements.clicks100 = 1;
    g.state.missions.firstMine = { completed: true, claimed: true };
    g.fleet.entry('scout').owned = 5;
    const points = g.rebirth('scientist', T0 + 1000);
    expect(points).toBe(24);
    // reset
    expect(g.buildings.level('asteroidMine')).toBe(0);
    expect(g.state.upgrades.reinforcedCoils).toBeUndefined();
    expect(g.colonies.ids()).toHaveLength(0);
    expect(g.fleet.owned('scout')).toBe(0);
    expect(g.research.countCompleted()).toBe(0);
    expect(g.resources.amount('metal').toNumber()).toBe(20);
    // kept
    expect(g.state.achievements.clicks100).toBeDefined();
    expect(g.state.missions.firstMine.claimed).toBe(true);
    expect(g.resources.amount('prestigePoints').toNumber()).toBe(1e6 + 24);
    expect(g.state.prestige.rebirths).toBe(1);
    expect(g.state.prestige.specialization).toBe('scientist');
  });

  it('specialization and upgrades affect the next cycle', () => {
    const g = lateGame();
    g.rebirth('scientist', T0 + 1000);
    expect(g.research.speed()).toBeCloseTo(1.5);
    g.state.resources.prestigePoints.amount = BigNumber.from(100);
    const before = g.modifiers.globalProductionMultiplier();
    expect(g.buyPrestigeUpgrade('productionMatrix')).toBe(true);
    expect(g.modifiers.globalProductionMultiplier()).toBeCloseTo(before * (1 + 0.15 + 0.02 * g.achievements.count()) / (1 + 0.02 * g.achievements.count()), 5);
    expect(g.resources.amount('prestigePoints').toNumber()).toBe(99);
  });

  it('starting kit, archive recall and cartography shorten the next cycle', () => {
    const g = lateGame();
    g.planets.discoverPlanet('kepler');
    g.state.prestige.upgrades = { startingKit: 1, archiveRecall: 1, cartographyMemory: 1 };
    g.rebirth('architect', T0 + 1000);
    expect(g.resources.amount('metal').toNumber()).toBe(520);
    expect(g.research.isCompleted('oreAnalysis')).toBe(true);
    expect(g.research.isCompleted('fusionTheory')).toBe(false);
    expect(g.planets.status('kepler')).toBe('analyzed'); // colonized -> analyzed, colony itself reset
    expect(g.buildings.costMultiplier()).toBeCloseTo(0.75);
  });

  it('prestige-only technologies need a rebirth', () => {
    const g = newGame();
    research(g, 'dataMining');
    g.state.resources.researchData.amount = BigNumber.from(1e6);
    expect(g.research.status('echoesOfRebirth')).toBe('locked');
    g.state.prestige.rebirths = 1;
    expect(g.research.status('echoesOfRebirth')).toBe('available');
  });

  it('survives save and load', () => {
    const g = lateGame();
    g.rebirth('admiral', T0 + 1000);
    g.save(T0 + 2000);
    const g2 = newGame();
    g2.saves = g.saves;
    g2.load(T0 + 3000);
    expect(g2.state.prestige.rebirths).toBe(1);
    expect(g2.state.prestige.specialization).toBe('admiral');
    expect(g2.resources.amount('prestigePoints').toNumber()).toBe(24);
  });
});

describe('Megastructures', () => {
  it('need the platform, technology and enough colonies', () => {
    const g = newGame();
    rich(g, 1e9);
    expect(g.startMegastructureStage('dysonSwarm')).toBe(false);
    research(g, 'megastructureTheory');
    setBuilding(g, 'stellarEngineeringPlatform', 1);
    expect(g.megastructures.check('dysonSwarm').reasons.join()).toContain('Kolonie');
    g.colonies.found('kepler');
    g.colonies.found('thalassa');
    expect(g.startMegastructureStage('dysonSwarm')).toBe(true);
    expect(g.startMegastructureStage('dysonSwarm')).toBe(false); // stage in progress
  });

  it('completed stages grant their effects', () => {
    const g = newGame();
    rich(g, 1e9);
    research(g, 'megastructureTheory');
    setBuilding(g, 'stellarEngineeringPlatform', 1);
    g.colonies.found('kepler');
    g.colonies.found('thalassa');
    const before = g.modifiers.resourceMultiplier('energy');
    g.startMegastructureStage('dysonSwarm');
    g.simulate(g.megastructures.duration('dysonSwarm') + 1, 10);
    expect(g.megastructures.stage('dysonSwarm')).toBe(1);
    expect(g.modifiers.resourceMultiplier('energy')).toBeCloseTo(before * 1.5);
    expect(g.prestige.pointsBreakdown().fromMega).toBe(5);
  });
});
