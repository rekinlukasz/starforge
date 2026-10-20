import { SECTOR_MAP, EXPEDITION_MAP } from '../../data/sectors.js';
import { PLANET_MAP, COLONY_BUILDINGS, SPECIALIZATIONS, TERRAFORMING } from '../../data/planets.js';
import { SHIP_MAP, SHIP_UPGRADE } from '../../data/ships.js';
import { RESOURCE_MAP } from '../../data/resources.js';
import { MEGASTRUCTURE_MAP } from '../../data/megastructures.js';
import { PRESTIGE_UPGRADE_MAP, PRESTIGE_SPECIALIZATIONS } from '../../data/prestige.js';
import { BigNumber } from './BigNumber.js';

const num = (v, fallback, min = -Infinity, max = Infinity) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const int = (v, fallback, min, max) => Math.floor(num(v, fallback, min, max));
const PLANET_STATUSES = ['discovered', 'analyzed', 'colonized'];
const EXPEDITION_KINDS = ['sector', 'survey', 'colonize'];

function cleanFleet(raw) {
  const out = {};
  for (const [id, n] of Object.entries(raw ?? {})) {
    if (SHIP_MAP[id]) {
      const c = int(n, 0, 0, 1e6);
      if (c > 0) out[id] = c;
    }
  }
  return out;
}

// Copies the space layer (v4+) from untrusted data into the fresh state `s`.
export function sanitizeSpace(raw, s) {
  for (const [id, e] of Object.entries(raw.space?.sectors ?? {})) {
    if (SECTOR_MAP[id] && e?.discovered === true) s.space.sectors[id] = { discovered: true };
  }
  for (const [id, e] of Object.entries(raw.space?.planets ?? {})) {
    if (PLANET_MAP[id] && PLANET_STATUSES.includes(e?.status)) s.space.planets[id] = { status: e.status };
  }

  const fleet = raw.fleet ?? {};
  for (const [id, e] of Object.entries(fleet.ships ?? {})) {
    if (!SHIP_MAP[id] || !e) continue;
    const owned = int(e.owned, 0, 0, 1e6);
    s.fleet.ships[id] = { owned, damaged: int(e.damaged, 0, 0, owned) };
  }
  for (const [id, lvl] of Object.entries(fleet.upgrades ?? {})) {
    if (SHIP_MAP[id]) s.fleet.upgrades[id] = int(lvl, 0, 0, SHIP_UPGRADE.maxLevel);
  }
  const queueItem = (q) => (q && SHIP_MAP[q.shipId] ? { shipId: q.shipId, progress: num(q.progress, 0, 0, 1e7) } : null);
  if (Array.isArray(fleet.queue)) s.fleet.queue = fleet.queue.map(queueItem).filter(Boolean).slice(0, 20);
  if (Array.isArray(fleet.repairs)) s.fleet.repairs = fleet.repairs.map(queueItem).filter(Boolean).slice(0, 1000);

  const ex = raw.expeditions ?? {};
  let maxUid = 0;
  if (Array.isArray(ex.active)) {
    for (const e of ex.active.slice(0, 50)) {
      if (!e || !EXPEDITION_KINDS.includes(e.kind)) continue;
      const valid = e.kind === 'sector' ? EXPEDITION_MAP[e.id] : PLANET_MAP[e.id];
      if (!valid) continue;
      const uid = int(e.uid, 0, 0, 1e12);
      if (!uid || s.expeditions.active.some((x) => x.uid === uid)) continue;
      const key = e.kind === 'sector' ? e.id : `${e.kind}:${e.id}`;
      const record = {
        uid, kind: e.kind, id: e.id, key,
        ships: cleanFleet(e.ships),
        startedAt: num(e.startedAt, 0, 0),
        endsAt: num(e.endsAt, 0, 0),
        status: e.status === 'completed' ? 'completed' : 'active',
        repeat: e.repeat === true,
      };
      if (e.battle && typeof e.battle === 'object' && ['victory', 'retreat'].includes(e.battle.outcome)) {
        record.battle = { ...e.battle, outcome: e.battle.outcome, hullLost: num(e.battle.hullLost, 0, 0, 1) };
      }
      s.expeditions.active.push(record);
      maxUid = Math.max(maxUid, uid);
    }
  }
  for (const [key, n] of Object.entries(ex.completions ?? {})) {
    if (typeof key === 'string' && key.length < 80) s.expeditions.completions[key] = int(n, 0, 0, 1e9);
  }
  s.expeditions.nextUid = Math.max(maxUid + 1, int(ex.nextUid, 1, 1, 1e12));

  for (const [id, c] of Object.entries(raw.colonies ?? {})) {
    if (!PLANET_MAP[id] || !c || typeof c !== 'object') continue;
    const buildings = {};
    for (const b of COLONY_BUILDINGS) buildings[b.id] = int(c.buildings?.[b.id], 0, 0, 1e6);
    const stock = {};
    for (const [r, v] of Object.entries(c.stock ?? {})) {
      const b = BigNumber.from(v);
      if (RESOURCE_MAP[r] && b.gt(0)) stock[r] = b;
    }
    const t = c.terraform ?? {};
    s.colonies[id] = {
      foundedAt: num(c.foundedAt, 0, 0),
      buildings,
      specialization: SPECIALIZATIONS[c.specialization] ? c.specialization : 'none',
      stock,
      terraform: {
        stage: int(t.stage, 0, 0, PLANET_MAP[id].terraformable ? TERRAFORMING.maxStage : 0),
        progress: num(t.progress, 0, 0, 1e7),
        active: t.active === true && Boolean(PLANET_MAP[id].terraformable),
      },
    };
    s.space.planets[id] = { status: 'colonized' }; // a colony implies a colonized planet
  }

  const lg = raw.logistics ?? {};
  let maxId = 0;
  const location = (l) => l === 'station' || Boolean(s.colonies[l]);
  if (Array.isArray(lg.routes)) {
    for (const r of lg.routes.slice(0, 20)) {
      if (!r || !location(r.from) || !location(r.to) || r.from === r.to || !RESOURCE_MAP[r.resource]) continue;
      const id = int(r.id, 0, 1, 1e12);
      if (!id || s.logistics.routes.some((x) => x.id === id)) continue;
      s.logistics.routes.push({
        id, from: r.from, to: r.to, resource: r.resource,
        amount: num(r.amount, 1, 0.01, 1e12),
        interval: int(r.interval, 60, 30, 86400),
        transporters: int(r.transporters, 1, 1, 1e6),
        active: r.active !== false,
        timer: num(r.timer, 0, 0, 1e7),
        delivered: num(r.delivered, 0, 0),
        trips: int(r.trips, 0, 0, 1e12),
        lastIssue: '',
      });
      maxId = Math.max(maxId, id);
    }
  }
  if (Array.isArray(lg.shipments)) {
    const seen = new Set();
    for (const sh of lg.shipments.slice(0, 100)) {
      if (!sh || !s.logistics.routes.some((r) => r.id === sh.routeId) || !RESOURCE_MAP[sh.resource]) continue;
      if (!location(sh.from) || !location(sh.to)) continue;
      const uid = int(sh.uid, 0, 1, 1e12);
      if (!uid || seen.has(uid)) continue; // duplicated shipment records would deliver twice
      seen.add(uid);
      s.logistics.shipments.push({
        uid, routeId: sh.routeId, from: sh.from, to: sh.to, resource: sh.resource,
        amount: num(sh.amount, 0, 0, 1e12), arrivesAt: num(sh.arrivesAt, 0, 0),
      });
      maxId = Math.max(maxId, uid);
    }
  }
  s.logistics.nextId = Math.max(maxId + 1, int(lg.nextId, 1, 1, 1e12));
  if (['0.25', '0.5', '0.75'].includes(String(raw.settings?.retreatAt))) s.settings.retreatAt = Number(raw.settings.retreatAt);

  for (const [id, m] of Object.entries(raw.megastructures ?? {})) {
    const def = MEGASTRUCTURE_MAP[id];
    if (!def || !m) continue;
    const stage = int(m.stage, 0, 0, def.stages);
    s.megastructures[id] = { stage, progress: num(m.progress, 0, 0, 1e8), active: m.active === true && stage < def.stages };
  }
  const pr = raw.prestige ?? {};
  s.prestige.rebirths = int(pr.rebirths, 0, 0, 1e6);
  s.prestige.totalEarned = num(pr.totalEarned, 0, 0);
  for (const [id, lvl] of Object.entries(pr.upgrades ?? {})) {
    const u = PRESTIGE_UPGRADE_MAP[id];
    if (u) s.prestige.upgrades[id] = int(lvl, 0, 0, u.maxLevel);
  }
  s.prestige.specialization = PRESTIGE_SPECIALIZATIONS[pr.specialization] ? pr.specialization : null;
  if (raw.stats?.rebirths !== undefined) s.stats.rebirths = int(raw.stats.rebirths, 0, 0, 1e6);
}
