// Optional, stat-based space combat. Fully deterministic: the forecast shown
// before launch is computed by the same function that resolves the battle.
//
// Each round both sides fire simultaneously:
//   damage = max(10% of attack, attack - 0.5 * enemy shields) * 100 / (100 + enemy armor)
// The player's fleet retreats once its hull drops below `retreatAt` of the
// starting hull, so a lost battle can never wipe the whole fleet.
// Losses: of the hull fraction lost, half the corresponding ships are
// destroyed and the rest return damaged (repairable at the orbital dock).

export const MAX_ROUNDS = 12;
export const DEFAULT_RETREAT = 0.5;

function roundDamage(attack, targetShields, targetArmor) {
  const raw = Math.max(attack * 0.1, attack - targetShields * 0.5);
  return raw * (100 / (100 + targetArmor));
}

export function simulateBattle(own, enemy, retreatAt = DEFAULT_RETREAT) {
  let ownHull = own.hull;
  let enemyHull = enemy.hull;
  const rounds = [];
  let outcome = 'draw';
  if (own.hull <= 0 || own.attack <= 0) {
    return { outcome: 'retreat', rounds, hullLost: 0, ownHullLeft: own.hull, enemyHullLeft: enemy.hull };
  }
  for (let r = 1; r <= MAX_ROUNDS; r++) {
    const dealt = roundDamage(own.attack, enemy.shields, enemy.armor);
    const taken = roundDamage(enemy.attack, own.shields, own.armor);
    enemyHull -= dealt;
    ownHull -= taken;
    rounds.push({ round: r, dealt, taken, ownHull: Math.max(0, ownHull), enemyHull: Math.max(0, enemyHull) });
    if (enemyHull <= 0) { outcome = 'victory'; break; }
    if (ownHull <= own.hull * retreatAt) { outcome = 'retreat'; break; }
  }
  if (outcome === 'draw') outcome = 'retreat'; // unresolved fights end with a withdrawal
  const hullLost = Math.min(1, Math.max(0, 1 - ownHull / own.hull));
  return { outcome, rounds, hullLost, ownHullLeft: Math.max(0, ownHull), enemyHullLeft: Math.max(0, enemyHull) };
}

// Translates hull loss into per-type destroyed / damaged counts.
export function battleLosses(fleet, hullLost) {
  const destroyed = {};
  const damaged = {};
  for (const [id, n] of Object.entries(fleet)) {
    if (!n) continue;
    const hit = Math.min(n, Math.ceil(n * hullLost - 1e-9));
    const lost = Math.min(hit, Math.floor(n * hullLost * 0.5));
    destroyed[id] = lost;
    damaged[id] = Math.max(0, hit - lost);
  }
  return { destroyed, damaged };
}

export class CombatSystem {
  constructor(game) {
    this.game = game;
  }

  // Forecast for the UI and the actual resolution at launch.
  forecast(expedition, fleet) {
    const own = this.game.fleet.fleetStats(fleet);
    const result = simulateBattle(own, expedition.enemy, this.game.state.settings.retreatAt ?? DEFAULT_RETREAT);
    const losses = battleLosses(fleet, result.hullLost);
    return {
      ...result,
      ...losses,
      ownPower: this.game.fleet.power(fleet),
      enemyPower: Math.round(expedition.enemy.attack * 4 + expedition.enemy.hull * 0.5 + expedition.enemy.shields + expedition.enemy.armor * 0.5),
    };
  }
}
