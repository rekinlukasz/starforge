// Headless economy simulation with simple bot strategies: npm run sim [minutes]
// Uses the real game systems, so results reflect the current balance data.
import { Game } from '../www/js/core/Game.js';
import { BUILDINGS } from '../www/data/buildings.js';
import { UPGRADES } from '../www/data/upgrades.js';
import { TECHNOLOGIES } from '../www/data/technologies.js';
import { MISSIONS } from '../www/data/missions.js';
import { formatNumber, formatDuration } from '../www/js/utils/Formatter.js';
import { BigNumber } from '../www/js/utils/BigNumber.js';

const MINUTES = Number(process.argv[2]) || 60;
const T0 = 1_700_000_000_000;

const STRATEGIES = {
  idle: { clicksPerSecond: 0, decideEvery: 30, prefer: null },
  active: { clicksPerSecond: 5, decideEvery: 5, prefer: null },
  research: { clicksPerSecond: 1, decideEvery: 10, prefer: ['researchLab', 'solarArray'] },
  production: { clicksPerSecond: 1, decideEvery: 10, prefer: ['asteroidMine', 'alloyFoundry', 'deepCoreDrill'] },
};

const costSum = (cost) => Object.values(cost).reduce((a, v) => a.add(v), BigNumber.ZERO);

function decide(game, prefer) {
  // Claim missions, start the cheapest affordable research, enable auto-buy everywhere once available.
  for (const m of MISSIONS) game.claimMission(m.id);
  if (!game.state.research.active) {
    const options = TECHNOLOGIES.filter((t) => game.research.status(t.id) === 'available' && game.resources.canAfford(t.cost))
      .sort((a, b) => a.cost.researchData - b.cost.researchData);
    if (options.length) game.startResearch(options[0].id);
  }
  if (game.automation.available()) for (const b of BUILDINGS) if (!game.automation.isEnabled(b.id)) game.setAutobuy(b.id, true);
  // Buy affordable upgrades first, then the cheapest building (preferred ones get a 3x discount in scoring).
  for (const u of game.upgrades.visible()) if (!game.upgrades.isOwned(u.id)) game.buyUpgrade(u.id);
  for (let guard = 0; guard < 50; guard++) {
    let best = null;
    for (const b of BUILDINGS) {
      if (!game.buildings.isUnlocked(b.id)) continue;
      const cost = game.buildings.cost(b.id, 1);
      if (!game.resources.canAfford(cost)) continue;
      let score = costSum(cost);
      if (prefer?.includes(b.id)) score = score.div(3);
      // Avoid energy-starving the station: skip consumers while energy is negative.
      if (b.id !== 'solarArray' && game.production.balance('energy').net.lt(0)) continue;
      if (!best || score.lt(best.score)) best = { id: b.id, score };
    }
    if (!best) break;
    game.buildings.buy(best.id, 1);
  }
}

function run(name, strat) {
  const game = new Game({ now: T0 });
  const firsts = {};
  game.events.on('buildingBought', ({ id, level }) => {
    if (level === 1 && firsts[id] === undefined) firsts[id] = game.state.meta.simTime;
  });
  const upgradesAt = {};
  const techAt = {};
  game.events.on('researchCompleted', (id) => { techAt[id] = game.state.meta.simTime; });
  game.events.on('upgradeBought', (id) => { upgradesAt[id] = game.state.meta.simTime; });
  let clicks = 0;
  const seconds = MINUTES * 60;
  for (let t = 0; t < seconds; t++) {
    for (let c = 0; c < strat.clicksPerSecond; c++) {
      if (game.click(T0 + t * 1000 + c * 50)) clicks++;
    }
    if (t % strat.decideEvery === 0) decide(game, strat.prefer);
    game.simulate(1);
  }
  console.log(`\n=== ${name} (${MINUTES} min, ${clicks} kliknięć) ===`);
  console.log('Pierwszy zakup budynków:');
  for (const b of BUILDINGS) {
    console.log(`  ${b.name.padEnd(24)} ${firsts[b.id] !== undefined ? formatDuration(firsts[b.id]) : '—'}   poziom ${game.buildings.level(b.id)}`);
  }
  console.log(`Ulepszenia: ${Object.keys(upgradesAt).length}/${UPGRADES.length}`);
  console.log(`Technologie: ${game.research.countCompleted()}/${TECHNOLOGIES.length}, zadania odebrane: ${Object.values(game.state.missions).filter((m) => m.claimed).length}/${MISSIONS.length}, osiągnięcia: ${game.achievements.count()}`);
  const milestones = ['autoBuilders', 'fusionTheory', 'neuralNetworks', 'quantumTheory', 'entanglement', 'unifiedField'];
  console.log('Kluczowe technologie: ' + milestones.map((id) => `${id}=${techAt[id] !== undefined ? formatDuration(techAt[id]) : '—'}`).join(', '));
  const out = ['energy', 'metal', 'silicon', 'alloy', 'electronics', 'machinery', 'chemicals', 'researchData']
    .map((id) => `${id}=${formatNumber(game.resources.amount(id))} (${formatNumber(game.production.balance(id).net)}/s)`);
  console.log('Stan końcowy: ' + out.join(', '));
  return { firsts, game };
}

for (const [name, strat] of Object.entries(STRATEGIES)) run(name, strat);
