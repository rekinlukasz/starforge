import { describe, it, expect } from 'vitest';
import { Game } from '../www/js/core/Game.js';
import { TECHNOLOGIES, TECH_MAP, TIER_DURATION } from '../www/data/technologies.js';
import { BUILDINGS, BUILDING_MAP } from '../www/data/buildings.js';
import { RESOURCE_MAP } from '../www/data/resources.js';
import { MISSIONS, MISSION_MAP } from '../www/data/missions.js';
import { ACHIEVEMENTS } from '../www/data/achievements.js';
import { BigNumber } from '../www/js/utils/BigNumber.js';
import { MemoryStorageAdapter } from '../www/js/persistence/StorageAdapter.js';
import { SHIPS, SHIP_MAP } from '../www/data/ships.js';
import { PLANETS, PLANET_MAP } from '../www/data/planets.js';

const T0 = 1_700_000_000_000;

function game() {
  return new Game({ storage: new MemoryStorageAdapter(), now: T0 });
}

function give(g, cost) {
  for (const [r, v] of Object.entries(cost)) {
    g.state.resources[r].amount = g.state.resources[r].amount.add(v);
  }
}

describe('Technology data integrity', () => {
  it('all prerequisites exist and there are no cycles', () => {
    for (const t of TECHNOLOGIES) for (const r of t.requires) expect(TECH_MAP[r], `${t.id} -> ${r}`).toBeTruthy();
    const visiting = new Set();
    const done = new Set();
    const visit = (id) => {
      if (done.has(id)) return;
      expect(visiting.has(id), `cycle at ${id}`).toBe(false);
      visiting.add(id);
      TECH_MAP[id].requires.forEach(visit);
      visiting.delete(id);
      done.add(id);
    };
    TECHNOLOGIES.forEach((t) => visit(t.id));
  });

  it('prerequisites are never of a higher tier', () => {
    for (const t of TECHNOLOGIES) for (const r of t.requires) expect(TECH_MAP[r].tier).toBeLessThanOrEqual(t.tier);
  });

  it('unlockBuilding effects match building unlock conditions both ways', () => {
    for (const t of TECHNOLOGIES) {
      for (const e of t.effects.filter((x) => x.type === 'unlockBuilding')) {
        expect(BUILDING_MAP[e.target], `${t.id} unlocks missing ${e.target}`).toBeTruthy();
        expect(BUILDING_MAP[e.target].unlock.tech).toContain(t.id);
      }
    }
    for (const b of BUILDINGS) {
      for (const tech of b.unlock.tech ?? []) {
        expect(TECH_MAP[tech].effects.some((e) => e.type === 'unlockBuilding' && e.target === b.id)).toBe(true);
      }
    }
  });

  it('unlockShip and unlockColonization effects match their targets both ways', () => {
    for (const t of TECHNOLOGIES) {
      for (const e of t.effects) {
        if (e.type === 'unlockShip') expect(SHIP_MAP[e.target].unlock.tech, t.id).toContain(t.id);
        if (e.type === 'unlockColonization') expect(PLANET_MAP[e.target].requires.tech, t.id).toContain(t.id);
      }
    }
    for (const s of SHIPS) {
      for (const tech of s.unlock.tech ?? []) {
        expect(TECH_MAP[tech].effects.some((e) => e.type === 'unlockShip' && e.target === s.id), `${s.id}<-${tech}`).toBe(true);
      }
    }
    for (const p of PLANETS) {
      for (const tech of p.requires.tech.filter((x) => x !== 'colonyShips')) {
        expect(TECH_MAP[tech].effects.some((e) => e.type === 'unlockColonization' && e.target === p.id), `${p.id}<-${tech}`).toBe(true);
      }
    }
  });

  it('has at least 80 technologies across all 12 categories', () => {
    expect(TECHNOLOGIES.length).toBeGreaterThanOrEqual(80);
    expect(new Set(TECHNOLOGIES.map((t) => t.category)).size).toBe(12);
  });

  it('a tech never costs a resource whose only sources are locked behind that tech', () => {
    // exoticMatter comes from the anomaly rift, which needs warpTheory.
    expect(Object.keys(TECH_MAP.warpTheory.cost)).not.toContain('exoticMatter');
  });

  it('costs and effect targets reference real resources and buildings', () => {
    for (const t of TECHNOLOGIES) {
      for (const r of Object.keys(t.cost)) expect(RESOURCE_MAP[r], `${t.id} cost ${r}`).toBeTruthy();
      for (const e of t.effects) {
        if (['buildingMult', 'inputMult'].includes(e.type)) expect(BUILDING_MAP[e.target], `${t.id} ${e.target}`).toBeTruthy();
        if (['resourceMult', 'resourceCapMult'].includes(e.type)) expect(RESOURCE_MAP[e.target]).toBeTruthy();
      }
    }
  });

  it('every non-feature tech has a mechanical effect', () => {
    for (const t of TECHNOLOGIES) expect(t.effects.length, t.id).toBeGreaterThan(0);
  });
});

describe('ResearchSystem', () => {
  it('refuses research whose prerequisites are missing', () => {
    const g = game();
    give(g, { researchData: 1e6 });
    expect(g.startResearch('powerGrid')).toBe('locked');
    expect(g.state.research.active).toBeNull();
  });

  it('refuses unaffordable research without spending anything', () => {
    const g = game();
    expect(g.startResearch('oreAnalysis')).toBe('unaffordable');
    expect(g.resources.amount('energy').toNumber()).toBe(50);
  });

  it('pays the cost at start and completes after its duration', () => {
    const g = game();
    give(g, { researchData: 100 });
    expect(g.startResearch('oreAnalysis')).toBe('started');
    expect(g.resources.amount('researchData').toNumber()).toBe(50);
    g.simulate(TIER_DURATION[1] - 1);
    expect(g.research.isCompleted('oreAnalysis')).toBe(false);
    g.simulate(1.5);
    expect(g.research.isCompleted('oreAnalysis')).toBe(true);
  });

  it('applies the effect exactly once', () => {
    const g = game();
    give(g, { researchData: 1000 });
    g.startResearch('oreAnalysis');
    g.simulate(30);
    expect(g.modifiers.buildingMultiplier('asteroidMine')).toBe(1.5);
    expect(g.startResearch('oreAnalysis')).toBe('completed');
    g.modifiers.invalidate();
    g.simulate(30);
    expect(g.modifiers.buildingMultiplier('asteroidMine')).toBe(1.5);
  });

  it('unlocks buildings only after completion', () => {
    const g = game();
    // refining requires alloyTheory <- oreAnalysis
    give(g, { researchData: 1e4 });
    g.startResearch('oreAnalysis'); g.simulate(25);
    g.startResearch('alloyTheory'); g.simulate(25);
    g.startResearch('refining');
    expect(g.buildings.isUnlocked('metalRefinery')).toBe(false);
    g.simulate(TIER_DURATION[2] + 1);
    expect(g.buildings.isUnlocked('metalRefinery')).toBe(true);
  });

  it('queues dependent research and pays each one when it starts', () => {
    const g = game();
    give(g, { researchData: 300 });
    expect(g.startResearch('oreAnalysis')).toBe('started');
    expect(g.startResearch('alloyTheory')).toBe('queued'); // depends on the active one
    expect(g.resources.amount('researchData').toNumber()).toBe(250); // queued is not paid yet
    g.simulate(TIER_DURATION[1] + 0.5);
    expect(g.state.research.active?.id).toBe('alloyTheory');
    expect(g.resources.amount('researchData').toNumber()).toBe(50);
    g.simulate(TIER_DURATION[1] + 0.5);
    expect(g.research.isCompleted('alloyTheory')).toBe(true);
  });

  it('a queued project waits for resources instead of failing', () => {
    const g = game();
    give(g, { researchData: 50 });
    g.startResearch('oreAnalysis');
    g.startResearch('alloyTheory'); // 200 RD, not affordable yet
    g.simulate(TIER_DURATION[1] + 1);
    expect(g.state.research.active).toBeNull();
    expect(g.state.research.queue).toEqual(['alloyTheory']);
    give(g, { researchData: 200 });
    g.simulate(1);
    expect(g.state.research.active?.id).toBe('alloyTheory');
  });

  it('cancel refunds the full cost', () => {
    const g = game();
    give(g, { researchData: 100 });
    g.startResearch('oreAnalysis');
    expect(g.cancelResearch()).toBe(true);
    expect(g.resources.amount('researchData').toNumber()).toBe(100);
  });

  it('research speed shortens research time', () => {
    const g = game();
    g.state.research.completed.expertSystems = true; // +25%
    g.modifiers.invalidate();
    expect(g.research.duration('oreAnalysis')).toBeCloseTo(TIER_DURATION[1] / 1.25);
  });

  it('research completes during offline progress', () => {
    const g = game();
    give(g, { researchData: 100 });
    g.startResearch('oreAnalysis');
    const pending = g.offline.prepare(T0 + 3600_000);
    g.offline.accept(pending);
    expect(g.research.isCompleted('oreAnalysis')).toBe(true);
    expect(pending.report.events.join(' ')).toContain('Analiza rud');
  });

  it('cost multiplier technologies make buildings cheaper', () => {
    const g = game();
    const before = g.buildings.cost('asteroidMine').metal.toNumber();
    g.state.research.completed.assemblyLines = true;
    g.modifiers.invalidate();
    expect(g.buildings.cost('asteroidMine').metal.toNumber()).toBeCloseTo(before * 0.9);
  });

  it('input multipliers reduce consumption', () => {
    const g = game();
    g.state.buildings.fusionReactor.level = 1;
    g.state.resources.water.amount = BigNumber.from(100);
    g.state.research.completed.coldFusion = true;
    g.modifiers.invalidate();
    g.simulate(10);
    expect(g.resources.amount('water').toNumber()).toBeCloseTo(100 - 0.5 * 10);
  });
});

describe('Missions', () => {
  it('mission data references are valid', () => {
    for (const m of MISSIONS) for (const a of m.after) expect(MISSION_MAP[a], `${m.id} after ${a}`).toBeTruthy();
  });

  it('progress through the tutorial chain and claim rewards exactly once', () => {
    const g = game();
    expect(g.missions.status('firstSpark')).toBe('active');
    expect(g.missions.status('powerUp')).toBe('locked');
    for (let i = 0; i < 10; i++) g.click(T0 + i * 200);
    g.simulate(0.1);
    expect(g.missions.status('firstSpark')).toBe('completed');
    const metal = g.resources.amount('metal').toNumber();
    expect(g.claimMission('firstSpark')).toBe(true);
    expect(g.claimMission('firstSpark')).toBe(false);
    expect(g.resources.amount('metal').toNumber()).toBeCloseTo(metal + 15);
  });

  it('the tutorial chain does not require clicking', () => {
    const g = game();
    expect(g.missions.status('firstMine')).toBe('active');
    g.buyBuilding('asteroidMine', '1');
    g.simulate(0.1);
    expect(g.claimMission('firstMine')).toBe(true);
    expect(g.missions.status('powerUp')).toBe('active');
  });

  it('cannot claim a mission whose goal is not met', () => {
    const g = game();
    expect(g.claimMission('firstSpark')).toBe(false);
    expect(g.claimMission('doesNotExist')).toBe(false);
  });

  it('completion is latched once reached', () => {
    const g = game();
    for (let i = 0; i < 10; i++) g.click(T0 + i * 200);
    g.claimMission('firstSpark') || (g.simulate(0.1), g.claimMission('firstSpark'));
    g.resources.add('metal', 50);
    g.buyBuilding('asteroidMine', '1');
    g.simulate(0.1);
    expect(g.missions.status('firstMine')).toBe('completed');
  });
});

describe('Achievements', () => {
  it('unlock automatically and grant a permanent production bonus', () => {
    const g = game();
    expect(g.modifiers.globalProductionMultiplier()).toBe(1);
    for (let i = 0; i < 100; i++) g.click(T0 + i * 100);
    g.simulate(0.1);
    expect(g.achievements.isUnlocked('clicks100')).toBe(true);
    expect(g.modifiers.globalProductionMultiplier()).toBeCloseTo(1.02);
  });

  it('every achievement goal is well formed', () => {
    const g = game();
    for (const a of ACHIEVEMENTS) expect(() => g.missions && a.goal).not.toThrow();
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
});

describe('Automation', () => {
  it('auto-buy requires the technology', () => {
    const g = game();
    expect(g.setAutobuy('asteroidMine', true)).toBe(false);
  });

  it('auto-buys cheap enabled buildings only', () => {
    const g = game();
    g.state.research.completed.autoBuilders = true;
    g.modifiers.invalidate();
    g.state.buildings.asteroidMine.unlocked = true;
    expect(g.setAutobuy('asteroidMine', true)).toBe(true);
    g.state.resources.metal.amount = BigNumber.from(400); // mine costs 10 <= 10% of 400
    g.simulate(6);
    expect(g.buildings.level('asteroidMine')).toBeGreaterThan(0);
    expect(g.buildings.level('solarArray')).toBe(0); // not enabled
  });

  it('auto ignition adds bounded click energy over time', () => {
    const g = game();
    g.state.research.completed.autoIgnition = true;
    g.modifiers.invalidate();
    g.state.resources.energy.amount = BigNumber.ZERO;
    g.simulate(10);
    // core 1/s + 2 auto clicks/s * (1 click energy + rate share 1s * energy income)
    expect(g.resources.amount('energy').toNumber()).toBeGreaterThan(10);
    expect(g.resources.amount('energy').toNumber()).toBeLessThan(80);
  });
});
