// Full-campaign bot: plays from a fresh start through colonization,
// megastructures and Galactic Rebirth using only public Game actions.
// Usage: npm run fullrun -- [hours] [clicksPerSecond]
// Prints the time at which each milestone was reached, or "—" if never.
import { Game } from '../www/js/core/Game.js';
import { BUILDINGS } from '../www/data/buildings.js';
import { TECHNOLOGIES } from '../www/data/technologies.js';
import { MISSIONS } from '../www/data/missions.js';
import { SECTORS } from '../www/data/sectors.js';
import { PLANETS, PLANET_MAP, COLONY_BUILDINGS } from '../www/data/planets.js';
import { MEGASTRUCTURES } from '../www/data/megastructures.js';
import { formatDuration, formatNumber } from '../www/js/utils/Formatter.js';
import { BigNumber } from '../www/js/utils/BigNumber.js';

const HOURS = Number(process.argv[2]) || 24;
const REBIRTH = process.argv.includes('--rebirth');
const CPS = Number(process.argv[3] ?? 1);
const T0 = 1_700_000_000_000;
const DECIDE_EVERY = 10;

const game = new Game({ now: T0 });
const t = () => game.state.meta.simTime;
const milestones = {};
let cycle = 1;
let cycleStart = 0;
const mark = (key) => { const k = cycle > 1 ? `[cykl ${cycle}] ${key}` : key; if (milestones[k] === undefined) milestones[k] = t() - cycleStart; };
game.events.on('shipBuilt', () => mark('Pierwszy statek'));
game.events.on('colonyFounded', () => {
  mark('Pierwsza kolonia');
  if (game.colonies.ids().length >= 3) mark('Trzy kolonie');
  if (game.colonies.ids().length >= 6) mark('Sześć kolonii');
});
game.events.on('routeCreated', () => mark('Pierwsza trasa logistyczna'));
game.events.on('megaStageCompleted', () => mark('Pierwszy etap megastruktury'));
game.events.on('expeditionClaimed', ({ def }) => { if (def.key === 'anomalyRift_story') mark('Brama Strażników (fabuła)'); });
game.events.on('researchCompleted', (id) => {
  if (id === 'spaceflight') mark('Loty międzyplanetarne');
  if (id === 'colonyShips') mark('Statki kolonizacyjne');
  if (game.research.countCompleted() >= 50) mark('50 technologii');
});
game.events.on('planetStatus', ({ status }) => { if (status === 'discovered') mark('Pierwsza odkryta planeta'); });

const costSum = (cost) => Object.values(cost).reduce((a, v) => a.add(v), BigNumber.ZERO);
// Spend at most `share` of current stock on optional purchases.
const cheap = (cost, share) => Object.entries(cost).every(([r, v]) => game.resources.amount(r).mul(share).gte(v));

const SHIP_TARGETS = { scout: 4, researchVessel: 3, miner: 8, colonyShip: 1, transporter: 4, terraformer: 1 };

function decide() {
  for (const m of MISSIONS) game.claimMission(m.id);
  if (!game.state.research.active) {
    const options = TECHNOLOGIES.filter((x) => game.research.status(x.id) === 'available' && game.resources.canAfford(x.cost))
      .sort((a, b) => a.cost.researchData - b.cost.researchData);
    if (options.length) game.startResearch(options[0].id);
  }
  if (game.automation.available()) for (const b of BUILDINGS) if (!game.automation.isEnabled(b.id)) game.setAutobuy(b.id, true);
  for (const u of game.upgrades.visible()) if (!game.upgrades.isOwned(u.id)) game.buyUpgrade(u.id);
  for (let guard = 0; guard < 40; guard++) {
    let best = null;
    for (const b of BUILDINGS) {
      if (!game.buildings.isUnlocked(b.id)) continue;
      const cost = game.buildings.cost(b.id, 1);
      if (!game.resources.canAfford(cost)) continue;
      if (b.id !== 'solarArray' && b.id !== 'fusionReactor' && game.production.balance('energy').net.lt(0)) continue;
      const score = costSum(cost);
      if (!best || score.lt(best.score)) best = { id: b.id, score };
    }
    if (!best) break;
    game.buildings.buy(best.id, 1);
  }

  // Fleet ---------------------------------------------------------------
  const colonizable = PLANETS.some((p) => game.planets.status(p.id) === 'analyzed' && game.planets.colonizationRequirements(p.id).met);
  for (const [id, target] of Object.entries(SHIP_TARGETS)) {
    if (id === 'colonyShip' && !colonizable) continue;
    if (id === 'transporter') { if (game.fleet.owned(id) >= Math.max(1, game.colonies.ids().length * 2)) continue; }
    else if (game.fleet.owned(id) + game.state.fleet.queue.filter((q) => q.shipId === id).length >= target) continue;
    if (game.fleet.isUnlocked(id) && game.fleet.canBuild()) game.buildShip(id, 1);
  }

  // Expeditions, never combat: one-time scouting/story first, then repeatable
  // work (only mining auto-repeats so ships stay free for new discoveries).
  const known = SECTORS.filter((s) => game.planets.isSectorDiscovered(s.id)).flatMap((s) => s.expeditions).filter((e) => e.type !== 'combat');
  for (const e of [...known.filter((x) => !x.repeatable), ...known.filter((x) => x.repeatable)]) {
    const def = game.expeditions.definition('sector', e.id);
    game.launchExpedition('sector', e.id, game.expeditions.defaultFleet(def), { repeat: e.type === 'mining' });
  }
  for (const p of PLANETS) {
    if (game.planets.status(p.id) === 'discovered') {
      const def = game.expeditions.definition('survey', p.id);
      game.launchExpedition('survey', p.id, game.expeditions.defaultFleet(def));
    }
    if (game.planets.status(p.id) === 'analyzed') game.launchExpedition('colonize', p.id, { colonyShip: 1 });
  }
  for (const e of [...game.state.expeditions.active]) if (e.status === 'completed') game.claimExpedition(e.uid);

  // Colonies -------------------------------------------------------------
  // Rare-resource colonies get logistics first (route slots are limited).
  const rare = (id) => (Object.keys(PLANET_MAP[id].deposits).some((r) => ['exoticMatter', 'antimatter'].includes(r)) ? 0 : 1);
  for (const id of [...game.colonies.ids()].sort((a, b) => rare(a) - rare(b))) {
    const p = PLANET_MAP[id];
    const c = game.colonies.colony(id);
    if (c.specialization === 'none') {
      const best = Object.entries(p.multipliers).sort((a, b) => b[1] - a[1])[0][0];
      game.specializeColony(id, best);
    }
    const order = ['extractor', 'habitat', 'factory', 'spaceport'];
    for (const b of order) {
      const cost = game.colonies.buildingCost(id, b);
      if (b === 'habitat' && Object.keys(p.upkeep).length && c.buildings.habitat >= c.buildings.extractor) continue;
      if (cheap(cost, 0.3)) game.buildColonyBuilding(id, b);
    }
    if (p.terraformable) game.startTerraform(id);
    // Logistics: ship every deposit home, supply upkeep from the station.
    if (game.logistics.available()) {
      const routes = game.state.logistics.routes;
      for (const r of Object.keys(p.deposits)) {
        if (!game.logistics.transportable(r)) continue;
        if (routes.some((x) => x.from === id && x.resource === r)) continue;
        if (game.fleet.available('transporter') < 1) break;
        game.createRoute({ from: id, to: 'station', resource: r, amount: game.logistics.capacity(1), interval: 60, transporters: 1 });
      }
      for (const r of Object.keys(p.upkeep)) {
        if (!game.logistics.transportable(r) || p.deposits[r]) continue;
        if (routes.some((x) => x.to === id && x.resource === r)) continue;
        if (game.fleet.available('transporter') < 1) break;
        game.createRoute({ from: 'station', to: id, resource: r, amount: 100, interval: 120, transporters: 1 });
      }
    }
  }

  for (const m of MEGASTRUCTURES) game.startMegastructureStage(m.id);
  if (game.prestige.canRebirth()) {
    mark('Galactic Rebirth dostępny');
    if (REBIRTH && cycle === 1) {
      const pts = game.rebirth('industrialist', T0 + t() * 1000);
      cycle = 2;
      cycleStart = t();
      console.log(`Odrodzenie po ${formatDuration(t())}: +${pts} PP`);
      // Spend points greedily on the cheapest permanent upgrades.
      for (let i = 0; i < 100; i++) {
        const opts = ['startingKit', 'archiveRecall', 'productionMatrix', 'researchLegacy', 'cartographyMemory', 'fleetBlueprints']
          .filter((u) => game.resources.amount('prestigePoints').gte(game.prestige.upgradeCost(u)));
        if (!opts.length || !game.buyPrestigeUpgrade(opts.sort((a, b) => game.prestige.upgradeCost(a) - game.prestige.upgradeCost(b))[0])) break;
      }
      console.log('Ulepszenia prestiżu: ' + JSON.stringify(game.state.prestige.upgrades));
    }
  }
}

const seconds = HOURS * 3600;
const start = Date.now();
for (let s = 0; s < seconds; s++) {
  for (let c = 0; c < CPS; c++) game.click(T0 + s * 1000 + c * 60);
  if (s % DECIDE_EVERY === 0) decide();
  game.simulate(1);
}

console.log(`=== Pełna kampania: ${HOURS} h, ${CPS} klik/s (czas obliczeń ${((Date.now() - start) / 1000).toFixed(1)} s) ===`);
const keys = ['Loty międzyplanetarne', 'Pierwszy statek', 'Pierwsza odkryta planeta', 'Statki kolonizacyjne', 'Pierwsza kolonia',
  'Pierwsza trasa logistyczna', 'Trzy kolonie', '50 technologii', 'Sześć kolonii', 'Pierwszy etap megastruktury', 'Brama Strażników (fabuła)', 'Galactic Rebirth dostępny'];
for (const c of cycle > 1 ? [1, 2] : [1]) {
  if (cycle > 1) console.log(`Cykl ${c} (czas od początku cyklu):`);
  for (const k of keys) {
    const key = c > 1 ? `[cykl ${c}] ${k}` : k;
    console.log(`  ${k.padEnd(30)} ${milestones[key] !== undefined ? formatDuration(milestones[key]) : '—'}`);
  }
}
console.log(`Technologie: ${game.research.countCompleted()}/${TECHNOLOGIES.length} · kolonie: ${game.colonies.ids().join(', ') || 'brak'}`);
console.log(`Sektory: ${SECTORS.filter((s) => game.planets.isSectorDiscovered(s.id)).length}/${SECTORS.length} · planety znane: ${game.planets.knownPlanets().length}/${PLANETS.length}`);
console.log(`Megastruktury: ${MEGASTRUCTURES.map((m) => `${m.id}=${game.megastructures.stage(m.id)}/${m.stages}`).join(', ')}`);
console.log(`Punkty prestiżu do zdobycia: ${game.prestige.pointsBreakdown().total} · trasy: ${game.state.logistics.routes.length}`);
const blocked = TECHNOLOGIES.filter((x) => !game.research.isCompleted(x.id)).map((x) => `${x.id}[${game.research.status(x.id)}]`);
console.log(`Nieukończone technologie (${blocked.length}): ${blocked.join(', ')}`);
const res = ['energy', 'metal', 'alloy', 'electronics', 'machinery', 'polymers', 'constructionMaterials', 'fusionCells', 'nanomaterials', 'quantumCrystals', 'exoticMatter', 'antimatter', 'ancientArtifacts', 'researchData'];
console.log('Zasoby: ' + res.map((r) => `${r}=${formatNumber(game.resources.amount(r))}`).join(', '));
