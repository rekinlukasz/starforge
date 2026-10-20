import { MEGASTRUCTURES, MEGASTRUCTURE_MAP } from '../../data/megastructures.js';
import { checkConditions } from './Conditions.js';

// Multi-stage projects. One stage at a time per megastructure; its cost is
// paid when the stage starts, effects apply for every completed stage.
export class MegastructureSystem {
  constructor(game) {
    this.game = game;
    game.modifiers.addSource((state, apply) => {
      for (const m of MEGASTRUCTURES) {
        const stage = state.megastructures[m.id]?.stage ?? 0;
        if (stage > 0) m.effectsPerStage.forEach((e) => apply(e, stage));
      }
    });
  }

  entry(id) {
    const ms = this.game.state.megastructures;
    if (!ms[id]) ms[id] = { stage: 0, progress: 0, active: false };
    return ms[id];
  }

  stage(id) {
    return this.game.state.megastructures[id]?.stage ?? 0;
  }

  totalStages() {
    return MEGASTRUCTURES.reduce((a, m) => a + this.stage(m.id), 0);
  }

  duration(id) {
    return MEGASTRUCTURE_MAP[id].duration / this.game.modifiers.get().megaSpeed;
  }

  check(id) {
    const def = MEGASTRUCTURE_MAP[id];
    if (!def) return { ok: false, reasons: ['Nieznany projekt'] };
    const reasons = [];
    if (this.game.buildings.level('stellarEngineeringPlatform') < 1) reasons.push('Wymagana Platforma inżynierii gwiezdnej');
    reasons.push(...checkConditions(this.game.state, def.requires).missing);
    const e = this.game.state.megastructures[id];
    if (e?.active) reasons.push('Etap w budowie');
    if (this.stage(id) >= def.stages) reasons.push('Ukończono wszystkie etapy');
    if (!this.game.resources.canAfford(def.stageCost)) reasons.push('Brak zasobów na etap');
    return { ok: reasons.length === 0, reasons };
  }

  startStage(id) {
    if (!this.check(id).ok) return false;
    if (!this.game.resources.spend(MEGASTRUCTURE_MAP[id].stageCost)) return false;
    const e = this.entry(id);
    e.active = true;
    e.progress = 0;
    this.game.events.emit('megaStageStarted', id);
    return true;
  }

  progressRatio(id) {
    const e = this.game.state.megastructures[id];
    if (!e?.active) return 0;
    return Math.min(1, e.progress / MEGASTRUCTURE_MAP[id].duration);
  }

  remaining(id) {
    const e = this.game.state.megastructures[id];
    if (!e?.active) return 0;
    return Math.max(0, (MEGASTRUCTURE_MAP[id].duration - e.progress) / this.game.modifiers.get().megaSpeed);
  }

  tick(dt) {
    const speed = this.game.modifiers.get().megaSpeed;
    for (const m of MEGASTRUCTURES) {
      const e = this.game.state.megastructures[m.id];
      if (!e?.active) continue;
      e.progress += dt * speed;
      if (e.progress >= m.duration) {
        e.active = false;
        e.progress = 0;
        e.stage += 1;
        this.game.modifiers.invalidate();
        this.game.events.emit('megaStageCompleted', { id: m.id, stage: e.stage });
      }
    }
  }
}
