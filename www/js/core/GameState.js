import { RESOURCES } from '../../data/resources.js';
import { BUILDINGS } from '../../data/buildings.js';
import { BigNumber } from '../utils/BigNumber.js';

export const SAVE_VERSION = 5;

export const DEFAULT_SETTINGS = {
  offlineCapHours: 8,
  buyMode: '1', // '1' | '10' | 'next' | 'max'
  autosaveSeconds: 30,
  reduceMotion: false,
  retreatAt: 0.5, // combat: withdraw when fleet hull falls below this share
};

// Full state model. BigNumber values serialize as "<mantissa>e<exponent>".
export function createInitialState(now = Date.now()) {
  const resources = {};
  for (const r of RESOURCES) {
    resources[r.id] = {
      amount: BigNumber.from(r.start),
      totalEarned: BigNumber.ZERO,
      unlocked: Boolean(r.unlocked),
    };
  }
  const buildings = {};
  for (const b of BUILDINGS) buildings[b.id] = { level: 0, unlocked: false };

  return {
    version: SAVE_VERSION,
    meta: {
      createdAt: now,
      lastSavedAt: 0,
      // Wall-clock time up to which the economy has been simulated. Never moves
      // backwards, so rolling the device clock back cannot replay rewards.
      lastSimulationAt: now,
      simTime: 0, // total simulated seconds; used for in-game timers
    },
    resources,
    buildings,
    upgrades: {}, // id -> true
    research: {
      completed: {}, // techId -> true
      active: null, // { id, progress } progress in base-duration seconds
      queue: [], // techIds, paid when they start
    },
    missions: {}, // id -> { completed, claimed }
    achievements: {}, // id -> simTime of unlock
    automation: {
      autobuy: {}, // buildingId -> true
      threshold: 0.1, // max share of stock an auto-purchase may cost
      autoclick: true,
    },
    flags: {}, // progression flags set by later systems
    space: {
      sectors: {}, // id -> { discovered: true } (startsDiscovered sectors are implicit)
      planets: {}, // id -> { status: discovered | analyzed | colonized }
    },
    fleet: {
      ships: {}, // shipId -> { owned, damaged }
      upgrades: {}, // shipId -> level
      queue: [], // [{ shipId, progress }] paid at enqueue
      repairs: [], // [{ shipId, progress }] paid at order
    },
    expeditions: {
      active: [], // records: { uid, kind, id, key, ships, startedAt, endsAt, status, repeat, battle?, losses? }
      completions: {}, // key -> count of claimed runs
      nextUid: 1,
    },
    colonies: {}, // planetId -> { foundedAt, buildings, specialization, stock, terraform }
    logistics: {
      routes: [],
      shipments: [],
      nextId: 1,
    },
    megastructures: {}, // id -> { stage, progress, active }
    prestige: {
      rebirths: 0,
      totalEarned: 0,
      upgrades: {}, // id -> level
      specialization: null,
    },
    click: {
      totalClicks: 0,
      charge: 0,
      overchargeUntil: 0, // simTime when overcharge ends
    },
    stats: {
      buildingsBought: 0,
      offlineSecondsGranted: 0,
    },
    log: [], // { t, text } newest first, short story/report entries
    settings: { ...DEFAULT_SETTINGS },
  };
}
