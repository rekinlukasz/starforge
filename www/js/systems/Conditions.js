import { BUILDING_MAP } from '../../data/buildings.js';
import { UPGRADE_MAP } from '../../data/upgrades.js';
import { TECH_MAP } from '../../data/technologies.js';
import { RESOURCE_MAP } from '../../data/resources.js';
import { MISSION_MAP } from '../../data/missions.js';
import { BigNumber } from '../utils/BigNumber.js';
import { formatNumber } from '../utils/Formatter.js';

// Shared condition format for unlocks, missions and achievements:
// {
//   buildings: { id: minLevel }, upgrades: [ids], tech: [ids], clicks: n,
//   resourcesEarned: { id: lifetimeAmount }, missions: [claimed mission ids],
//   techCount: n, totalBuildingLevels: n, flags: [state.flags keys],
//   colonies: n, rebirths: n, megastructureStages: n,
// }
// Each requirement yields { met, ratio, text } so the UI can show progress.
export function evaluateConditions(state, cond = {}) {
  const parts = [];
  for (const [id, level] of Object.entries(cond.buildings ?? {})) {
    const have = state.buildings[id]?.level ?? 0;
    parts.push({ met: have >= level, ratio: Math.min(1, have / level), text: `${BUILDING_MAP[id]?.name ?? id}: poziom ${Math.min(have, level)}/${level}` });
  }
  for (const id of cond.upgrades ?? []) {
    const met = Boolean(state.upgrades[id]);
    parts.push({ met, ratio: met ? 1 : 0, text: `Ulepszenie: ${UPGRADE_MAP[id]?.name ?? id}` });
  }
  for (const id of cond.tech ?? []) {
    const met = Boolean(state.research?.completed?.[id]);
    parts.push({ met, ratio: met ? 1 : 0, text: `Technologia: ${TECH_MAP[id]?.name ?? id}` });
  }
  if (cond.clicks) {
    const have = state.click.totalClicks;
    parts.push({ met: have >= cond.clicks, ratio: Math.min(1, have / cond.clicks), text: `Kliknięcia reaktora: ${Math.min(have, cond.clicks)}/${cond.clicks}` });
  }
  for (const [id, amount] of Object.entries(cond.resourcesEarned ?? {})) {
    const have = state.resources[id]?.totalEarned ?? BigNumber.ZERO;
    const need = BigNumber.from(amount);
    const met = have.gte(need);
    parts.push({ met, ratio: met ? 1 : Math.min(1, have.div(need).toNumber()), text: `Wyprodukuj ${RESOURCE_MAP[id]?.name ?? id}: ${formatNumber(BigNumber.min(have, need))}/${formatNumber(need)}` });
  }
  for (const id of cond.missions ?? []) {
    const met = Boolean(state.missions?.[id]?.claimed);
    parts.push({ met, ratio: met ? 1 : 0, text: `Ukończ zadanie: ${MISSION_MAP[id]?.name ?? id}` });
  }
  if (cond.techCount) {
    const have = Object.keys(state.research?.completed ?? {}).length;
    parts.push({ met: have >= cond.techCount, ratio: Math.min(1, have / cond.techCount), text: `Ukończone technologie: ${Math.min(have, cond.techCount)}/${cond.techCount}` });
  }
  if (cond.totalBuildingLevels) {
    const have = Object.values(state.buildings).reduce((a, b) => a + b.level, 0);
    const need = cond.totalBuildingLevels;
    parts.push({ met: have >= need, ratio: Math.min(1, have / need), text: `Łączne poziomy budynków: ${Math.min(have, need)}/${need}` });
  }
  if (cond.colonies) {
    const have = Object.keys(state.colonies ?? {}).length;
    parts.push({ met: have >= cond.colonies, ratio: Math.min(1, have / cond.colonies), text: `Kolonie: ${Math.min(have, cond.colonies)}/${cond.colonies}` });
  }
  if (cond.rebirths) {
    const have = state.prestige?.rebirths ?? 0;
    parts.push({ met: have >= cond.rebirths, ratio: Math.min(1, have / cond.rebirths), text: `Odrodzenia galaktyczne: ${Math.min(have, cond.rebirths)}/${cond.rebirths}` });
  }
  if (cond.megastructureStages) {
    const have = Object.values(state.megastructures ?? {}).reduce((a, m) => a + (m.stage ?? 0), 0);
    const need = cond.megastructureStages;
    parts.push({ met: have >= need, ratio: Math.min(1, have / need), text: `Etapy megastruktur: ${Math.min(have, need)}/${need}` });
  }
  for (const flag of cond.flags ?? []) {
    const met = Boolean(state.flags?.[flag]);
    parts.push({ met, ratio: met ? 1 : 0, text: FLAG_TEXT[flag] ?? flag });
  }
  const met = parts.every((p) => p.met);
  const ratio = parts.length ? parts.reduce((a, p) => a + p.ratio, 0) / parts.length : 1;
  return { met, ratio, parts };
}

// Human-readable text for progression flags set by later systems.
export const FLAG_TEXT = {};

// Compatibility helper used by unlock checks: { met, missing: [texts] }.
export function checkConditions(state, cond = {}) {
  const r = evaluateConditions(state, cond);
  return { met: r.met, missing: r.parts.filter((p) => !p.met).map((p) => p.text) };
}
