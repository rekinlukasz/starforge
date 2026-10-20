import { describe, it, expect } from 'vitest';
import { newGame, rich, research, setBuilding, addShips, give } from './helpers.js';
import { SHIPS, SHIP_MAP } from '../www/data/ships.js';
import { SECTORS, EXPEDITION_MAP } from '../www/data/sectors.js';
import { TECH_MAP } from '../www/data/technologies.js';
import { RESOURCE_MAP } from '../www/data/resources.js';
import { simulateBattle, battleLosses } from '../www/js/systems/CombatSystem.js';

describe('Ship and sector data', () => {
  it('ships are unlocked by a tech that declares it', () => {
    for (const s of SHIPS) {
      for (const t of s.unlock.tech ?? []) {
        expect(TECH_MAP[t], `${s.id} needs ${t}`).toBeTruthy();
      }
      for (const r of Object.keys(s.cost)) expect(RESOURCE_MAP[r]).toBeTruthy();
    }
  });

  it('expeditions reference real ships, sectors and planets', () => {
    for (const sec of SECTORS) {
      for (const e of sec.expeditions) {
        for (const s of Object.keys(e.ships)) expect(SHIP_MAP[s], `${e.id} ship ${s}`).toBeTruthy();
        for (const r of Object.keys({ ...e.cost, ...e.rewards })) expect(RESOURCE_MAP[r], `${e.id} ${r}`).toBeTruthy();
        for (const d of e.discovers?.sectors ?? []) expect(SECTORS.some((x) => x.id === d)).toBe(true);
        for (const t of e.requires?.tech ?? []) expect(TECH_MAP[t], `${e.id} needs ${t}`).toBeTruthy();
      }
    }
  });

  it('every sector is reachable by scouting, without any combat', () => {
    const reached = new Set(SECTORS.filter((s) => s.startsDiscovered).map((s) => s.id));
    let grew = true;
    while (grew) {
      grew = false;
      for (const s of SECTORS) {
        if (!reached.has(s.id)) continue;
        for (const e of s.expeditions) {
          if (e.type === 'combat') continue;
          for (const d of e.discovers?.sectors ?? []) if (!reached.has(d)) { reached.add(d); grew = true; }
        }
      }
    }
    expect([...reached].sort()).toEqual(SECTORS.map((s) => s.id).sort());
  });
});

describe('Shipyard', () => {
  it('requires a shipyard and the technology', () => {
    const g = newGame();
    rich(g);
    expect(g.buildShip('scout')).toBe(false);
    research(g, 'spaceflight');
    expect(g.buildShip('scout')).toBe(false); // no shipyard yet
    setBuilding(g, 'shipyard', 1);
    expect(g.buildShip('scout')).toBe(true);
  });

  it('pays atomically and builds over time through the queue', () => {
    const g = newGame();
    research(g, 'spaceflight');
    setBuilding(g, 'shipyard', 1);
    give(g, { metal: 400 * 2, electronics: 80, energy: 600 });
    expect(g.buildShip('scout', 3)).toBe(false); // can't pay for 3
    expect(g.state.fleet.queue).toHaveLength(0);
    expect(g.buildShip('scout', 2)).toBe(true);
    expect(g.state.fleet.queue).toHaveLength(2);
    const t = g.fleet.buildTime('scout');
    g.simulate(t + 0.5);
    expect(g.fleet.owned('scout')).toBe(1); // one slot -> sequential
    g.simulate(t + 0.5);
    expect(g.fleet.owned('scout')).toBe(2);
  });

  it('more shipyard levels build in parallel', () => {
    const g = newGame();
    rich(g);
    research(g, 'spaceflight');
    setBuilding(g, 'shipyard', 2);
    g.buildShip('scout', 2);
    g.simulate(g.fleet.buildTime('scout') + 0.5);
    expect(g.fleet.owned('scout')).toBe(2);
  });

  it('cancel refunds a queued ship', () => {
    const g = newGame();
    research(g, 'spaceflight');
    setBuilding(g, 'shipyard', 1);
    give(g, { metal: 400, electronics: 40, energy: 300 });
    const metal = g.resources.amount('metal').toNumber();
    g.buildShip('scout');
    expect(g.cancelShip(0)).toBe(true);
    expect(g.resources.amount('metal').toNumber()).toBeCloseTo(metal);
  });

  it('upgrades raise ship stats', () => {
    const g = newGame();
    rich(g);
    research(g, 'spaceflight');
    const before = g.fleet.stats('scout').hull;
    expect(g.upgradeShip('scout')).toBe(true);
    expect(g.fleet.stats('scout').hull).toBeCloseTo(before * 1.1);
  });
});

describe('Expeditions', () => {
  it('scouting takes time, then discovers planets and sectors once', () => {
    const g = newGame();
    rich(g);
    addShips(g, 'scout', 1);
    const rec = g.launchExpedition('sector', 'innerBelt_scout', { scout: 1 });
    expect(rec).toBeTruthy();
    expect(g.fleet.available('scout')).toBe(0);
    expect(g.claimExpedition(rec.uid)).toBeNull(); // not finished yet
    g.simulate(rec.endsAt - rec.startedAt - 1);
    expect(g.state.expeditions.active[0].status).toBe('active');
    g.simulate(2);
    expect(g.state.expeditions.active[0].status).toBe('completed');
    expect(g.fleet.available('scout')).toBe(1); // ship home
    g.state.resources.metal.amount = g.state.resources.metal.amount.mul(0);
    const metal = g.resources.amount('metal');
    const result = g.claimExpedition(rec.uid);
    expect(result.victory).toBe(true);
    expect(g.planets.status('kepler')).toBe('discovered');
    expect(g.planets.isSectorDiscovered('outerReach')).toBe(true);
    expect(g.claimExpedition(rec.uid)).toBeNull(); // exactly once
    expect(g.resources.amount('metal').sub(metal).toNumber()).toBeGreaterThan(0);
    // Non-repeatable scout mission cannot run again
    expect(g.launchExpedition('sector', 'innerBelt_scout', { scout: 1 })).toBe(false);
  });

  it('requires the minimum fleet, available ships and fuel', () => {
    const g = newGame();
    expect(g.launchExpedition('sector', 'innerBelt_scout', { scout: 1 })).toBe(false); // no ship
    addShips(g, 'scout', 1);
    g.state.resources.energy.amount = g.state.resources.energy.amount.mul(0);
    expect(g.launchExpedition('sector', 'innerBelt_scout', { scout: 1 })).toBe(false); // no fuel
    expect(g.expeditions.check('sector', 'innerBelt_scout', { scout: 1 }).reasons.join()).toContain('Brak zasobów');
  });

  it('cannot launch into undiscovered sectors', () => {
    const g = newGame();
    rich(g);
    addShips(g, 'scout', 1);
    expect(g.launchExpedition('sector', 'outerReach_scout', { scout: 1 })).toBe(false);
  });

  it('mining rewards scale with fleet cargo and are repeatable', () => {
    const g = newGame();
    rich(g, 1e5);
    addShips(g, 'miner', 2);
    const one = g.launchExpedition('sector', 'innerBelt_mining', { miner: 1 });
    g.simulate(one.endsAt - one.startedAt + 1);
    const r1 = g.claimExpedition(one.uid);
    const two = g.launchExpedition('sector', 'innerBelt_mining', { miner: 2 });
    g.simulate(two.endsAt - two.startedAt + 1);
    const r2 = g.claimExpedition(two.uid);
    expect(r2.granted.alloy.toNumber()).toBeCloseTo(r1.granted.alloy.toNumber() * 2);
    expect(g.expeditions.completions('innerBelt_mining')).toBe(2);
  });

  it('deterministic every-N bonus rewards', () => {
    const g = newGame();
    rich(g, 1e6);
    g.planets.discoverSector('outerReach');
    research(g, 'deepSpaceSensors');
    addShips(g, 'researchVessel', 1);
    for (let i = 0; i < 3; i++) {
      const rec = g.launchExpedition('sector', 'outerReach_science', { researchVessel: 1 });
      g.simulate(rec.endsAt - rec.startedAt + 1);
      g.claimExpedition(rec.uid);
    }
    expect(g.resources.amount('ancientArtifacts').toNumber()).toBeCloseTo(1e6 + 1);
  });

  it('auto-claim feature claims and repeats expeditions', () => {
    const g = newGame();
    rich(g, 1e5);
    research(g, 'expeditionAutomation');
    addShips(g, 'miner', 1);
    const rec = g.launchExpedition('sector', 'innerBelt_mining', { miner: 1 }, { repeat: true });
    const d = rec.endsAt - rec.startedAt;
    g.simulate(d + 1);
    expect(g.expeditions.completions('innerBelt_mining')).toBe(1);
    expect(g.state.expeditions.active).toHaveLength(1); // relaunched
    g.simulate(d + 1);
    expect(g.expeditions.completions('innerBelt_mining')).toBe(2);
  });

  it('expeditions complete during offline progress', () => {
    const g = newGame();
    rich(g, 1e5);
    addShips(g, 'scout', 1);
    g.launchExpedition('sector', 'innerBelt_scout', { scout: 1 });
    const pending = g.offline.prepare(g.state.meta.lastSimulationAt + 3600_000);
    g.offline.accept(pending);
    expect(g.state.expeditions.active[0].status).toBe('completed');
    expect(pending.report.events.join(' ')).toContain('Ekspedycje');
  });
});

describe('Combat', () => {
  it('a strong fleet wins; a weak one retreats instead of being wiped out', () => {
    const enemy = EXPEDITION_MAP.outerReach_patrol.enemy;
    const strong = simulateBattle({ attack: 200, armor: 50, shields: 50, hull: 2000 }, enemy);
    expect(strong.outcome).toBe('victory');
    const weak = simulateBattle({ attack: 1, armor: 0, shields: 0, hull: 30 }, enemy);
    expect(weak.outcome).toBe('retreat');
    expect(weak.ownHullLeft).toBeGreaterThan(0);
  });

  it('the listed minimum fleet at base stats wins every combat mission', () => {
    const g = newGame();
    for (const e of Object.values(EXPEDITION_MAP).filter((x) => x.type === 'combat')) {
      const f = g.combat.forecast(e, e.ships);
      expect(f.outcome, e.id).toBe('victory');
    }
  });

  it('a bigger fleet takes fewer losses', () => {
    const g = newGame();
    const e = EXPEDITION_MAP.pirateHaven_raid;
    const small = g.combat.forecast(e, { frigate: 3 });
    const big = g.combat.forecast(e, { frigate: 6 });
    expect(big.hullLost).toBeLessThan(small.hullLost);
  });

  it('losses never destroy every ship of a fleet in a retreat at 50%', () => {
    const { destroyed } = battleLosses({ escort: 2 }, 0.7);
    expect(destroyed.escort).toBeLessThan(2);
  });

  it('forecast equals the resolved battle and rewards only on victory', () => {
    const g = newGame();
    rich(g, 1e5);
    g.planets.discoverSector('outerReach');
    addShips(g, 'escort', 2);
    const def = g.expeditions.definition('sector', 'outerReach_patrol');
    const forecast = g.combat.forecast(def, { escort: 2 });
    const rec = g.launchExpedition('sector', 'outerReach_patrol', { escort: 2 });
    expect(rec.battle.outcome).toBe(forecast.outcome);
    g.simulate(rec.endsAt - rec.startedAt + 1);
    const credits = g.resources.amount('credits').toNumber();
    const res = g.claimExpedition(rec.uid);
    if (res.victory) expect(g.resources.amount('credits').toNumber()).toBeGreaterThan(credits);
    else expect(g.resources.amount('credits').toNumber()).toBe(credits);
    const lost = (rec.losses?.destroyed?.escort ?? 0);
    expect(g.fleet.owned('escort')).toBe(2 - lost);
  });

  it('damaged ships are repaired over time at a cost', () => {
    const g = newGame();
    rich(g, 1e6);
    addShips(g, 'escort', 2);
    g.fleet.markDamaged('escort', 1);
    expect(g.fleet.available('escort')).toBe(1);
    expect(g.repairShip('escort')).toBe(true);
    expect(g.repairShip('escort')).toBe(false); // only one damaged
    setBuilding(g, 'orbitalDock', 1);
    g.simulate(61);
    expect(g.fleet.available('escort')).toBe(2);
  });

  it('economy progression never requires combat ships', () => {
    // Every non-combat expedition can be flown with civil ships only.
    for (const e of Object.values(EXPEDITION_MAP)) {
      if (e.type === 'combat') continue;
      for (const s of Object.keys(e.ships)) expect(SHIP_MAP[s].role, e.id).toBe('civil');
    }
  });
});
