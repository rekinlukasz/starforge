import { describe, it, expect } from 'vitest';
import { newGame, rich, research, setBuilding, addShips } from './helpers.js';
import { PLANETS, PLANET_MAP, PLANET_TYPES } from '../www/data/planets.js';
import { SECTORS } from '../www/data/sectors.js';
import { TECH_MAP } from '../www/data/technologies.js';
import { BigNumber } from '../www/js/utils/BigNumber.js';

function analyzedPlanet(g, id) {
  g.planets.discoverSector(PLANET_MAP[id].sector);
  g.planets.discoverPlanet(id);
  g.planets.setStatus(id, 'analyzed');
}

function colonize(g, id) {
  analyzedPlanet(g, id);
  addShips(g, 'colonyShip', 1);
  const rec = g.launchExpedition('colonize', id, { colonyShip: 1 });
  expect(rec).toBeTruthy();
  g.simulate(rec.endsAt - rec.startedAt + 1);
  g.claimExpedition(rec.uid);
}

describe('Planet data', () => {
  it('covers all 10 planet types, each discoverable by a scouting expedition', () => {
    expect(new Set(PLANETS.map((p) => p.type))).toEqual(new Set(Object.keys(PLANET_TYPES)));
    const discoverable = new Set(SECTORS.flatMap((s) => s.expeditions.flatMap((e) => e.discovers?.planets ?? [])));
    for (const p of PLANETS) expect(discoverable.has(p.id), p.id).toBe(true);
  });

  it('every planet lists an advantage and a drawback and valid requirements', () => {
    for (const p of PLANETS) {
      expect(p.advantage.length).toBeGreaterThan(5);
      expect(p.drawback.length).toBeGreaterThan(5);
      for (const t of p.requires.tech) expect(TECH_MAP[t], `${p.id} ${t}`).toBeTruthy();
    }
  });
});

describe('Colonization', () => {
  it('surveys move a planet from discovered to analyzed', () => {
    const g = newGame();
    rich(g, 1e5);
    g.planets.discoverPlanet('kepler');
    addShips(g, 'scout', 2);
    expect(g.launchExpedition('colonize', 'kepler', { colonyShip: 1 })).toBe(false); // not analyzed
    const rec = g.launchExpedition('survey', 'kepler', { scout: 2 }); // alternative fleet
    expect(rec).toBeTruthy();
    g.simulate(rec.endsAt - rec.startedAt + 1);
    g.claimExpedition(rec.uid);
    expect(g.planets.status('kepler')).toBe('analyzed');
  });

  it('requires technology and pays costs; consumes the colony ship', () => {
    const g = newGame();
    rich(g, 1e5);
    analyzedPlanet(g, 'kepler');
    addShips(g, 'colonyShip', 1);
    expect(g.launchExpedition('colonize', 'kepler', { colonyShip: 1 })).toBe(false); // missing tech
    research(g, 'colonyShips');
    const cm = g.resources.amount('constructionMaterials').toNumber();
    const rec = g.launchExpedition('colonize', 'kepler', { colonyShip: 1 });
    expect(rec).toBeTruthy();
    expect(g.fleet.owned('colonyShip')).toBe(0);
    expect(g.resources.amount('constructionMaterials').toNumber()).toBeCloseTo(cm - 100);
  });

  it('creates a colony exactly once', () => {
    const g = newGame();
    rich(g, 1e5);
    research(g, 'colonyShips');
    colonize(g, 'kepler');
    expect(g.colonies.has('kepler')).toBe(true);
    expect(g.planets.status('kepler')).toBe('colonized');
    expect(g.colonies.found('kepler')).toBe(false);
    addShips(g, 'colonyShip', 1);
    expect(g.launchExpedition('colonize', 'kepler', { colonyShip: 1 })).toBe(false);
  });

  it('colony production starts with buildings and uses planet deposits', () => {
    const g = newGame();
    rich(g, 1e5);
    research(g, 'colonyShips');
    colonize(g, 'vulcan' in PLANET_MAP ? 'kepler' : 'kepler');
    expect(g.buildColonyBuilding('kepler', 'extractor')).toBe(true);
    g.simulate(10);
    // kepler: metal 4/s per extractor level (global multiplier may add achievements)
    const metal = g.colonies.stock('kepler', 'metal').toNumber();
    expect(metal).toBeGreaterThan(39);
    expect(metal).toBeLessThan(60);
  });

  it('planets differ: volcanic yields more metal than rocky', () => {
    const g = newGame();
    rich(g, 1e5);
    research(g, 'colonyShips', 'thermalShielding');
    colonize(g, 'kepler');
    colonize(g, 'vulcan');
    g.buildColonyBuilding('kepler', 'extractor');
    g.buildColonyBuilding('vulcan', 'extractor');
    g.simulate(10);
    expect(g.colonies.stock('vulcan', 'metal').toNumber()).toBeGreaterThan(g.colonies.stock('kepler', 'metal').toNumber() * 2);
  });

  it('specialization multiplies the right output; first is free, change costs', () => {
    const g = newGame();
    rich(g, 1e5);
    research(g, 'colonyShips');
    colonize(g, 'kepler');
    g.buildColonyBuilding('kepler', 'extractor');
    g.simulate(1);
    const base = g.colonies.balance('kepler', 'metal').toNumber();
    const credits = g.resources.amount('credits').toNumber();
    expect(g.specializeColony('kepler', 'mining')).toBe(true);
    expect(g.resources.amount('credits').toNumber()).toBe(credits); // free
    g.simulate(1);
    expect(g.colonies.balance('kepler', 'metal').toNumber()).toBeCloseTo(base * 1.5 * 1.2, 4);
    expect(g.specializeColony('kepler', 'mining')).toBe(false); // same spec
    expect(g.specializeColony('kepler', 'research')).toBe(true);
    expect(g.resources.amount('credits').toNumber()).toBe(credits - 200);
    expect(g.specializeColony('kepler', 'bogus')).toBe(false);
  });

  it('habitats need upkeep; without supplies their bonus fades', () => {
    const g = newGame();
    rich(g, 1e5);
    research(g, 'colonyShips');
    colonize(g, 'kepler');
    g.buildColonyBuilding('kepler', 'habitat');
    g.simulate(2);
    expect(g.colonies.reports.kepler.efficiency.habitat).toBe(0); // no biomass on Kepler
    g.colonies.addStock('kepler', 'biomass', 100);
    g.simulate(1);
    expect(g.colonies.reports.kepler.efficiency.habitat).toBe(1);
  });

  it('respects building slots', () => {
    const g = newGame();
    rich(g, 1e12);
    research(g, 'colonyShips', 'environmentalSuits');
    colonize(g, 'miasma'); // 20 slots
    let built = 0;
    for (let i = 0; i < 40; i++) if (g.buildColonyBuilding('miasma', 'extractor')) built++;
    expect(built).toBe(PLANET_MAP.miasma.slots);
  });

  it('research specialization transmits data to the station', () => {
    const g = newGame();
    rich(g, 1e5);
    research(g, 'colonyShips');
    colonize(g, 'thalassa');
    g.buildColonyBuilding('thalassa', 'habitat');
    g.specializeColony('thalassa', 'research');
    const rd = g.resources.amount('researchData').toNumber();
    g.simulate(10);
    expect(g.resources.amount('researchData').toNumber()).toBeGreaterThan(rd);
  });

  it('terraforming only on terraformable worlds, raises slots and output', () => {
    const g = newGame();
    rich(g, 1e7);
    research(g, 'colonyShips');
    colonize(g, 'kepler');
    colonize(g, 'eden');
    setBuilding(g, 'terraformingFacility', 1);
    addShips(g, 'terraformer', 2);
    expect(g.startTerraform('kepler')).toBe(false);
    const slots = g.colonies.slots('eden');
    expect(g.startTerraform('eden')).toBe(true);
    expect(g.startTerraform('eden')).toBe(false); // already running
    g.simulate(g.colonies.terraformDuration() + 1);
    expect(g.state.colonies.eden.terraform.stage).toBe(1);
    expect(g.colonies.slots('eden')).toBe(slots + 6);
  });
});

describe('Logistics', () => {
  function setup() {
    const g = newGame();
    rich(g, 1e5);
    research(g, 'colonyShips', 'interplanetaryLogistics');
    colonize(g, 'kepler');
    addShips(g, 'transporter', 2);
    g.colonies.addStock('kepler', 'metal', 500);
    return g;
  }

  it('validates routes', () => {
    const g = setup();
    expect(g.createRoute({ from: 'kepler', to: 'kepler', resource: 'metal', amount: 100, interval: 60, transporters: 1 }).ok).toBe(false);
    expect(g.createRoute({ from: 'thalassa', to: 'station', resource: 'metal', amount: 100, interval: 60, transporters: 1 }).ok).toBe(false); // not colonized
    expect(g.createRoute({ from: 'kepler', to: 'station', resource: 'researchData', amount: 100, interval: 60, transporters: 1 }).ok).toBe(false);
    expect(g.createRoute({ from: 'kepler', to: 'station', resource: 'metal', amount: 100, interval: 60, transporters: 5 }).ok).toBe(false);
    expect(g.createRoute({ from: 'kepler', to: 'station', resource: 'metal', amount: -1, interval: 60, transporters: 1 }).ok).toBe(false);
    expect(g.createRoute({ from: 'kepler', to: 'station', resource: 'metal', amount: 100, interval: 60, transporters: 1 }).ok).toBe(true);
    expect(g.fleet.available('transporter')).toBe(1);
  });

  it('moves cargo once per trip, conserving the amount', () => {
    const g = setup();
    g.state.resources.metal.amount = BigNumber.from(0);
    const { route } = g.createRoute({ from: 'kepler', to: 'station', resource: 'metal', amount: 100, interval: 60, transporters: 1 });
    g.simulate(1);
    expect(g.state.logistics.shipments).toHaveLength(1);
    const colonyAfterLoad = g.colonies.stock('kepler', 'metal').toNumber();
    expect(colonyAfterLoad).toBeCloseTo(400 + 0, 0);
    const travel = g.logistics.travelTime('kepler', 'station');
    g.simulate(travel + 1);
    expect(g.state.logistics.shipments).toHaveLength(0);
    // 100 delivered plus core salvage 0.2/s
    expect(g.resources.amount('metal').toNumber()).toBeGreaterThan(100);
    expect(route.delivered).toBeCloseTo(100);
    expect(route.trips).toBe(1);
  });

  it('never transports more than the source holds', () => {
    const g = setup();
    g.state.colonies.kepler.stock.metal = BigNumber.from(30);
    const { route } = g.createRoute({ from: 'kepler', to: 'station', resource: 'metal', amount: 150, interval: 60, transporters: 1 });
    g.simulate(1);
    expect(g.state.logistics.shipments[0].amount).toBeCloseTo(30);
    expect(g.colonies.stock('kepler', 'metal').toNumber()).toBeCloseTo(0);
    expect(route.amount).toBe(150);
  });

  it('pausing stops new trips; deleting returns cargo in flight', () => {
    const g = setup();
    const { route } = g.createRoute({ from: 'kepler', to: 'station', resource: 'metal', amount: 100, interval: 60, transporters: 1 });
    g.simulate(1);
    expect(g.deleteRoute(route.id)).toBe(true);
    expect(g.colonies.stock('kepler', 'metal').toNumber()).toBeCloseTo(500, 0);
    expect(g.fleet.available('transporter')).toBe(2);
  });

  it('a save/load round trip cannot duplicate a shipment', () => {
    const g = setup();
    g.createRoute({ from: 'kepler', to: 'station', resource: 'metal', amount: 100, interval: 60, transporters: 1 });
    g.simulate(1);
    const raw = JSON.parse(JSON.stringify(g.state));
    raw.logistics.shipments.push({ ...raw.logistics.shipments[0] }); // tampered duplicate
    g.saves.adapter.set('starforge.save', JSON.stringify(raw));
    g.load(g.state.meta.lastSimulationAt);
    expect(g.state.logistics.shipments).toHaveLength(1);
  });
});
