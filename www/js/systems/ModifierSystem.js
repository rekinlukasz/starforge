import { UPGRADE_MAP, OVERCHARGE } from '../../data/upgrades.js';
import { BUILDING_MAP } from '../../data/buildings.js';
import { TECH_MAP } from '../../data/technologies.js';
import { ACHIEVEMENT_BONUS } from '../../data/achievements.js';

// Collects every active bonus into one snapshot. Stacking rules:
//   - "Add" effects of one type are summed (additive).
//   - "Mult" effects are multiplied together (multiplicative).
//   - Different groups multiply with each other.
// Sources: upgrades, completed technologies, building level effects,
// achievements, and (later stages) prestige and colonies. Each source
// contributes exactly once because the snapshot is rebuilt from scratch.
export class ModifierSystem {
  constructor(game) {
    this.game = game;
    this.snapshot = null;
    this.extraSources = []; // functions (state, apply) registered by later systems
  }

  invalidate() {
    this.snapshot = null;
  }

  get() {
    if (!this.snapshot) this.snapshot = this.build();
    return this.snapshot;
  }

  // Lets other systems (prestige, colonies) contribute effects.
  addSource(fn) {
    this.extraSources.push(fn);
    this.invalidate();
  }

  build() {
    const state = this.game.state;
    const s = {
      clickAdd: 0,
      clickMult: 1,
      clickRateShare: 0,
      overchargeUnlocked: false,
      overchargeMultiplier: OVERCHARGE.baseMultiplier,
      overchargeDuration: OVERCHARGE.duration,
      buildingMult: {},
      categoryMult: {},
      resourceMult: {},
      resourceAdd: {},
      inputMult: {},
      capMult: 1,
      resourceCapMult: {},
      costMult: 1,
      researchSpeed: 1,
      offlineCapHours: 0,
      features: {},
      globalMult: 1,
      globalAdd: 0,
      shipSpeed: 1,
      shipCargo: 1,
      shipAttack: 1,
      shipShields: 1,
      shipArmor: 1,
      fuelMult: 1,
      expeditionDuration: 1,
      terraformDuration: 1,
      colonyProduction: 1,
      colonyStorage: 1,
      colonySlots: 0,
      repairCost: 1,
      shipyardSlots: 0,
      buildSpeed: 1,
      repairSpeed: 1,
      megaSpeed: 1,
    };
    const multKeys = ['shipSpeed', 'shipCargo', 'shipAttack', 'shipShields', 'shipArmor', 'fuelMult',
      'expeditionDuration', 'terraformDuration', 'colonyProduction', 'colonyStorage', 'repairCost'];
    const mulInto = (obj, key, v) => { obj[key] = (obj[key] ?? 1) * v; };
    const apply = (effect, count = 1) => {
      const v = effect.value;
      switch (effect.type) {
        case 'clickAdd': s.clickAdd += v * count; break;
        case 'clickMult': s.clickMult *= Math.pow(v, count); break;
        case 'clickRateShare': s.clickRateShare += v * count; break;
        case 'overcharge': s.overchargeUnlocked = true; break;
        case 'overchargeBoost': s.overchargeMultiplier += v * count; break;
        case 'overchargeDuration': s.overchargeDuration += v * count; break;
        case 'buildingMult': mulInto(s.buildingMult, effect.target, Math.pow(v, count)); break;
        case 'categoryMult': mulInto(s.categoryMult, effect.target, Math.pow(v, count)); break;
        case 'resourceMult': mulInto(s.resourceMult, effect.target, Math.pow(v, count)); break;
        case 'resourceAdd': s.resourceAdd[effect.target] = (s.resourceAdd[effect.target] ?? 0) + v * count; break;
        case 'inputMult': mulInto(s.inputMult, effect.target, Math.pow(v, count)); break;
        case 'capMult': s.capMult *= Math.pow(v, count); break;
        case 'resourceCapMult': mulInto(s.resourceCapMult, effect.target, Math.pow(v, count)); break;
        case 'costMult': s.costMult *= Math.pow(v, count); break;
        case 'researchSpeed': s.researchSpeed += v * count; break;
        case 'offlineCapHours': s.offlineCapHours += v * count; break;
        case 'feature': s.features[effect.target] = true; break;
        case 'globalMult': s.globalMult *= Math.pow(v, count); break;
        case 'globalAdd': s.globalAdd += v * count; break;
        case 'colonySlots': s.colonySlots += v * count; break;
        case 'shipyardSlots': s.shipyardSlots += v * count; break;
        case 'buildSpeed': s.buildSpeed += v * count; break;
        case 'repairSpeed': s.repairSpeed += v * count; break;
        case 'megaSpeed': s.megaSpeed += v * count; break;
        default:
          if (multKeys.includes(effect.type)) s[effect.type] *= Math.pow(v, count);
          // unlockBuilding / unlockShip / unlockColonization: gated by the target's own
          // `unlock`/`requires` conditions; the effect entry documents it for the UI.
          break;
      }
    };
    for (const id of Object.keys(state.upgrades)) {
      if (state.upgrades[id]) UPGRADE_MAP[id]?.effects.forEach((e) => apply(e));
    }
    for (const id of Object.keys(state.research.completed)) {
      TECH_MAP[id]?.effects.forEach((e) => apply(e));
    }
    for (const [id, b] of Object.entries(state.buildings)) {
      const def = BUILDING_MAP[id];
      if (def?.effects && b.level > 0) def.effects.forEach((e) => apply(e, b.level));
    }
    const achievements = Object.keys(state.achievements).length;
    s.globalAdd += achievements * ACHIEVEMENT_BONUS;
    for (const fn of this.extraSources) fn(state, apply);
    return s;
  }

  // Output multiplier of one building, excluding temporary/global effects.
  buildingMultiplier(buildingId) {
    const s = this.get();
    const def = BUILDING_MAP[buildingId];
    return (s.buildingMult[buildingId] ?? 1) * (def ? s.categoryMult[def.category] ?? 1 : 1);
  }

  // Multiplier for every producer of a resource: (1 + additive) * multiplicative.
  resourceMultiplier(resourceId) {
    const s = this.get();
    return (1 + (s.resourceAdd[resourceId] ?? 0)) * (s.resourceMult[resourceId] ?? 1);
  }

  inputMultiplier(buildingId) {
    return this.get().inputMult[buildingId] ?? 1;
  }

  hasFeature(name) {
    return Boolean(this.get().features[name]);
  }

  isOvercharged() {
    const { click, meta } = this.game.state;
    return click.overchargeUntil > meta.simTime;
  }

  // Production multiplier applied to every output.
  globalProductionMultiplier() {
    const s = this.get();
    const overcharge = this.isOvercharged() ? s.overchargeMultiplier : 1;
    return overcharge * s.globalMult * (1 + s.globalAdd);
  }
}
