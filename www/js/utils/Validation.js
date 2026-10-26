import { createInitialState, DEFAULT_SETTINGS } from '../core/GameState.js';
import { RESOURCE_MAP } from '../../data/resources.js';
import { BUILDING_MAP } from '../../data/buildings.js';
import { UPGRADE_MAP } from '../../data/upgrades.js';
import { TECH_MAP } from '../../data/technologies.js';
import { MISSION_MAP } from '../../data/missions.js';
import { ACHIEVEMENT_MAP } from '../../data/achievements.js';
import { AUTOBUY_THRESHOLDS } from '../systems/AutomationSystem.js';
import { BigNumber } from './BigNumber.js';
import { GRAPHICS_OPTIONS } from '../render3d/layout.js';
import { sanitizeSpace } from './ValidationSpace.js';

const MAX_LOG = 50;

const finiteNumber = (v, fallback, min = -Infinity, max = Infinity) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

const nonNegativeBig = (v) => {
  const b = BigNumber.from(v);
  return b.lt(0) ? BigNumber.ZERO : b;
};

// Builds a clean state from untrusted data: starts from a fresh initial
// state and copies only known, well-typed fields. Missing fields keep their
// defaults; unknown ids and garbage are dropped.
export function sanitizeState(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object') throw new Error('Zapis nie jest obiektem');
  const s = createInitialState(now);

  const meta = raw.meta ?? {};
  s.meta.createdAt = finiteNumber(meta.createdAt, now, 0);
  s.meta.lastSavedAt = finiteNumber(meta.lastSavedAt, 0, 0);
  s.meta.lastSimulationAt = finiteNumber(meta.lastSimulationAt, now, 0);
  s.meta.simTime = finiteNumber(meta.simTime, 0, 0);

  for (const [id, entry] of Object.entries(raw.resources ?? {})) {
    if (!RESOURCE_MAP[id] || !entry || typeof entry !== 'object') continue;
    s.resources[id].amount = nonNegativeBig(entry.amount);
    s.resources[id].totalEarned = nonNegativeBig(entry.totalEarned);
    s.resources[id].unlocked = s.resources[id].unlocked || Boolean(entry.unlocked);
  }

  for (const [id, entry] of Object.entries(raw.buildings ?? {})) {
    if (!BUILDING_MAP[id] || !entry || typeof entry !== 'object') continue;
    s.buildings[id].level = Math.floor(finiteNumber(entry.level, 0, 0, 1e9));
    s.buildings[id].unlocked = Boolean(entry.unlocked) || s.buildings[id].level > 0;
  }

  for (const [id, owned] of Object.entries(raw.upgrades ?? {})) {
    if (UPGRADE_MAP[id] && owned === true) s.upgrades[id] = true;
  }

  const research = raw.research ?? {};
  for (const [id, done] of Object.entries(research.completed ?? {})) {
    if (TECH_MAP[id] && done === true) s.research.completed[id] = true;
  }
  const active = research.active;
  if (active && TECH_MAP[active.id] && !s.research.completed[active.id]) {
    s.research.active = { id: active.id, progress: finiteNumber(active.progress, 0, 0, 1e9) };
  }
  if (Array.isArray(research.queue)) {
    s.research.queue = [...new Set(research.queue)]
      .filter((id) => TECH_MAP[id] && !s.research.completed[id] && id !== s.research.active?.id)
      .slice(0, 5);
  }

  for (const [id, e] of Object.entries(raw.missions ?? {})) {
    if (!MISSION_MAP[id] || !e || typeof e !== 'object') continue;
    const claimed = e.claimed === true;
    s.missions[id] = { completed: claimed || e.completed === true, claimed };
  }
  for (const [id, t] of Object.entries(raw.achievements ?? {})) {
    if (ACHIEVEMENT_MAP[id]) s.achievements[id] = finiteNumber(t, 0, 0);
  }

  const auto = raw.automation ?? {};
  for (const [id, on] of Object.entries(auto.autobuy ?? {})) {
    if (BUILDING_MAP[id] && on === true) s.automation.autobuy[id] = true;
  }
  if (AUTOBUY_THRESHOLDS.includes(auto.threshold)) s.automation.threshold = auto.threshold;
  if (typeof auto.autoclick === 'boolean') s.automation.autoclick = auto.autoclick;

  for (const [k, v] of Object.entries(raw.flags ?? {})) {
    if (typeof k === 'string' && k.length < 64 && v === true) s.flags[k] = true;
  }

  sanitizeSpace(raw, s);

  const click = raw.click ?? {};
  s.click.totalClicks = Math.floor(finiteNumber(click.totalClicks, 0, 0));
  s.click.charge = finiteNumber(click.charge, 0, 0, 1e6);
  s.click.overchargeUntil = finiteNumber(click.overchargeUntil, 0, 0);

  const stats = raw.stats ?? {};
  s.stats.buildingsBought = Math.floor(finiteNumber(stats.buildingsBought, 0, 0));
  s.stats.offlineSecondsGranted = finiteNumber(stats.offlineSecondsGranted, 0, 0);

  if (Array.isArray(raw.log)) {
    s.log = raw.log
      .filter((e) => e && typeof e.text === 'string')
      .slice(0, MAX_LOG)
      .map((e) => ({
        t: finiteNumber(e.t, 0, 0),
        text: e.text.slice(0, 300),
        ...(typeof e.key === 'string' ? { key: e.key.slice(0, 64) } : {}),
      }));
  }

  const settings = raw.settings ?? {};
  s.settings.offlineCapHours = finiteNumber(settings.offlineCapHours, DEFAULT_SETTINGS.offlineCapHours, 1, 48);
  s.settings.buyMode = ['1', '10', 'next', 'max'].includes(settings.buyMode) ? settings.buyMode : DEFAULT_SETTINGS.buyMode;
  s.settings.autosaveSeconds = finiteNumber(settings.autosaveSeconds, DEFAULT_SETTINGS.autosaveSeconds, 5, 600);
  s.settings.reduceMotion = Boolean(settings.reduceMotion);
  s.settings.graphics = GRAPHICS_OPTIONS.includes(settings.graphics) ? settings.graphics : DEFAULT_SETTINGS.graphics;

  return s;
}
