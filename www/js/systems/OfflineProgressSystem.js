import { RESOURCE_IDS, RESOURCE_MAP } from '../../data/resources.js';
import { BUILDINGS } from '../../data/buildings.js';
import { TECH_MAP } from '../../data/technologies.js';

// Offline steps adapt to the gap so 8 h never needs more than ~MAX_STEPS ticks.
const MAX_STEPS = 4000;

// Offline progress runs the exact same simulation as live play, on a copy of
// the state. The copy is only applied after the player accepts the report,
// so closing the app while the report is open loses nothing and grants nothing.
export class OfflineProgressSystem {
  constructor(game) {
    this.game = game;
  }

  capHours() {
    return this.game.state.settings.offlineCapHours + this.game.modifiers.get().offlineCapHours;
  }

  capSeconds() {
    return this.capHours() * 3600;
  }

  // Returns { report, state } without touching the live game.
  prepare(now = Date.now()) {
    const game = this.game;
    const awaySeconds = game.pendingSeconds(now);
    const creditedSeconds = Math.min(awaySeconds, this.capSeconds());

    const GameClass = game.constructor;
    const sim = new GameClass({ state: game.clone(now) });
    const before = Object.fromEntries(RESOURCE_IDS.map((id) => [id, sim.resources.amount(id)]));
    const unlockedBefore = new Set(BUILDINGS.filter((b) => sim.buildings.isUnlocked(b.id)).map((b) => b.id));
    const wasOvercharged = sim.modifiers.isOvercharged();
    const techBefore = new Set(Object.keys(sim.state.research.completed));
    const missionsBefore = sim.missions.claimableCount();
    const finishedBefore = sim.state.expeditions.active.filter((e) => e.status === 'completed').length;
    const claimedBefore = Object.values(sim.state.expeditions.completions).reduce((a, b) => a + b, 0);
    const shipsBefore = sim.fleet.all().reduce((a, s) => a + sim.fleet.owned(s.id), 0);
    const coloniesBefore = sim.colonies.ids().length;
    const tripsBefore = sim.state.logistics.routes.reduce((a, r) => a + r.trips, 0);

    const step = Math.max(1, creditedSeconds / MAX_STEPS);
    sim.simulate(creditedSeconds, step);
    // Uncredited time beyond the cap is discarded, never carried forward.
    sim.state.meta.lastSimulationAt = Math.max(sim.state.meta.lastSimulationAt, now);
    sim.state.stats.offlineSecondsGranted += creditedSeconds;

    const changes = [];
    for (const id of RESOURCE_IDS) {
      const delta = sim.resources.amount(id).sub(before[id]);
      if (!delta.isZero()) changes.push({ id, delta });
    }
    const events = [];
    for (const id of Object.keys(sim.state.research.completed)) {
      if (!techBefore.has(id)) events.push(`Ukończono badanie: ${TECH_MAP[id].name}`);
    }
    const newMissions = sim.missions.claimableCount() - missionsBefore;
    if (newMissions > 0) events.push(`Zadania gotowe do odebrania: ${newMissions}`);
    const finished = sim.state.expeditions.active.filter((e) => e.status === 'completed').length - finishedBefore;
    if (finished > 0) events.push(`Ekspedycje zakończone, czekają na odbiór: ${finished}`);
    const autoClaimed = Object.values(sim.state.expeditions.completions).reduce((a, b) => a + b, 0) - claimedBefore;
    if (autoClaimed > 0) events.push(`Ekspedycje odebrane automatycznie: ${autoClaimed}`);
    const shipsBuilt = sim.fleet.all().reduce((a, s) => a + sim.fleet.owned(s.id), 0) - shipsBefore;
    if (shipsBuilt > 0) events.push(`Zbudowane statki: ${shipsBuilt}`);
    const delivered = sim.state.logistics.routes.reduce((a, r) => a + r.trips, 0) - tripsBefore;
    if (delivered > 0) events.push(`Kursy transportowe: ${delivered}`);
    if (sim.colonies.ids().length > coloniesBefore) events.push('Założono nową kolonię');
    for (const b of BUILDINGS) {
      if (!unlockedBefore.has(b.id) && sim.buildings.isUnlocked(b.id)) events.push(`Dostępny nowy budynek: ${b.name}`);
    }
    if (wasOvercharged && !sim.modifiers.isOvercharged()) events.push('Przeciążenie reaktora wygasło.');
    for (const id of RESOURCE_IDS) {
      const cap = sim.resources.cap(id);
      if (cap && sim.resources.amount(id).gte(cap) && changes.some((c) => c.id === id)) {
        events.push(`Magazyn pełny: ${RESOURCE_MAP[id].name}`);
      }
    }

    return {
      report: { awaySeconds, creditedSeconds, changes, events },
      state: sim.state,
    };
  }

  accept(pending) {
    this.game.replaceState(pending.state);
    this.game.save();
  }
}
