import {
  PLANET_MAP, COLONY_BUILDINGS, COLONY_BUILDING_MAP, COLONY_FACTORY_RECIPES, SPECIALIZATIONS,
  SPECIALIZATION_CHANGE_COST, COLONY_BASE_STORAGE, HABITAT_BONUS, COLONY_STAGES, TERRAFORMING,
} from '../../data/planets.js';
import { RESOURCE_MAP } from '../../data/resources.js';
import { solveEfficiency } from './ProductionSystem.js';
import { BigNumber } from '../utils/BigNumber.js';

// Resources a colony sends straight to the station (information, money),
// everything else stays in the colony's own stock until shipped.
export const TRANSMITTED = ['researchData', 'credits', 'ancientArtifacts'];

// Colonies are independent production centres with their own stock.
// They run automatically every simulation step (online and offline).
export class ColonySystem {
  constructor(game) {
    this.game = game;
    this.reports = {}; // planetId -> { efficiency, perResource } (not saved)
  }

  get cs() {
    return this.game.state.colonies;
  }

  ids() {
    return Object.keys(this.cs);
  }

  has(id) {
    return Boolean(this.cs[id]);
  }

  found(planetId) {
    if (!PLANET_MAP[planetId] || this.has(planetId)) return false; // never colonize twice
    this.cs[planetId] = {
      foundedAt: this.game.state.meta.simTime,
      buildings: Object.fromEntries(COLONY_BUILDINGS.map((b) => [b.id, 0])),
      specialization: 'none',
      stock: {},
      terraform: { stage: 0, progress: 0, active: false },
    };
    this.game.planets.setStatus(planetId, 'colonized');
    this.game.events.emit('colonyFounded', planetId);
    return true;
  }

  colony(id) {
    return this.cs[id];
  }

  totalLevels(id) {
    return Object.values(this.cs[id].buildings).reduce((a, b) => a + b, 0);
  }

  slots(id) {
    const p = PLANET_MAP[id];
    return p.slots + this.game.modifiers.get().colonySlots + this.cs[id].terraform.stage * TERRAFORMING.slotBonus;
  }

  stage(id) {
    const lv = this.totalLevels(id);
    return [...COLONY_STAGES].reverse().find((s) => lv >= s.min).name;
  }

  stock(id, r) {
    return this.cs[id].stock[r] ?? BigNumber.ZERO;
  }

  storageCap(id) {
    const c = this.cs[id];
    return BigNumber.from(COLONY_BASE_STORAGE).mul(Math.pow(2, c.buildings.spaceport) * this.game.modifiers.get().colonyStorage);
  }

  addStock(id, r, v) {
    const cap = this.storageCap(id);
    const cur = this.stock(id, r);
    const next = BigNumber.min(cap, cur.add(v));
    const added = BigNumber.max(BigNumber.ZERO, next.sub(cur));
    if (next.gt(cur)) this.cs[id].stock[r] = next;
    return added;
  }

  removeStock(id, r, v) {
    const cur = this.stock(id, r);
    const taken = BigNumber.min(cur, BigNumber.from(v));
    this.cs[id].stock[r] = cur.sub(taken);
    return taken;
  }

  buildingCost(id, buildingId) {
    const def = COLONY_BUILDING_MAP[buildingId];
    const L = this.cs[id].buildings[buildingId];
    const f = BigNumber.from(def.growth).pow(L).mul(this.game.modifiers.get().costMult);
    return Object.fromEntries(Object.entries(def.baseCost).map(([r, v]) => [r, f.mul(v)]));
  }

  // Atomic, paid from station stock; limited by slots.
  build(id, buildingId) {
    if (!this.has(id) || !COLONY_BUILDING_MAP[buildingId]) return false;
    if (this.totalLevels(id) >= this.slots(id)) return false;
    if (!this.game.resources.spend(this.buildingCost(id, buildingId))) return false;
    this.cs[id].buildings[buildingId] += 1;
    this.game.events.emit('colonyBuilt', { id, buildingId });
    return true;
  }

  specializationCost(id) {
    return this.cs[id].specialization === 'none' ? {} : SPECIALIZATION_CHANGE_COST;
  }

  // The first specialization is free; changing it later costs resources.
  specialize(id, spec) {
    if (!this.has(id) || !SPECIALIZATIONS[spec] || spec === 'none') return false;
    const c = this.cs[id];
    if (c.specialization === spec) return false;
    if (!this.game.resources.spend(this.specializationCost(id))) return false;
    c.specialization = spec;
    this.game.events.emit('colonySpecialized', { id, spec });
    return true;
  }

  // Factory recipe: first conversion whose input this planet extracts.
  factoryRecipe(id) {
    const deposits = PLANET_MAP[id].deposits;
    return COLONY_FACTORY_RECIPES.find((r) => Object.keys(r.inputs).every((x) => deposits[x])) ?? null;
  }

  specMult(id, focus) {
    const c = this.cs[id];
    const p = PLANET_MAP[id];
    if (c.specialization !== focus) return 1;
    return (SPECIALIZATIONS[focus].effects[focus === 'mining' ? 'extractor' : 'factory'] ?? 1) * (p.multipliers[focus] ?? 1);
  }

  // Colony-wide output multiplier.
  colonyMultiplier(id) {
    const c = this.cs[id];
    const habitatEff = this.reports[id]?.efficiency?.habitat ?? 1;
    const habitat = 1 + c.buildings.habitat * HABITAT_BONUS * habitatEff;
    const terraform = 1 + c.terraform.stage * TERRAFORMING.productionBonus;
    return habitat * terraform * this.game.modifiers.get().colonyProduction * this.game.modifiers.globalProductionMultiplier();
  }

  producers(id) {
    const c = this.cs[id];
    const p = PLANET_MAP[id];
    const mult = this.colonyMultiplier(id);
    const list = [];
    const big = (v) => BigNumber.from(v);
    if (c.buildings.extractor > 0) {
      const m = mult * this.specMult(id, 'mining') * c.buildings.extractor;
      list.push({ id: 'extractor', inputs: {}, outputs: Object.fromEntries(Object.entries(p.deposits).map(([r, v]) => [r, big(v * m)])) });
    }
    if (c.buildings.habitat > 0) {
      const L = c.buildings.habitat;
      const outputs = {};
      const spec = SPECIALIZATIONS[c.specialization];
      if (c.specialization === 'research') outputs.researchData = big(spec.effects.research * L * p.multipliers.research * mult);
      if (c.specialization === 'agriculture') outputs.biomass = big(spec.effects.agriculture * L * p.multipliers.agriculture * mult);
      if (c.specialization === 'trade') outputs.credits = big(spec.effects.trade * L * p.multipliers.trade * mult);
      list.push({ id: 'habitat', inputs: Object.fromEntries(Object.entries(p.upkeep).map(([r, v]) => [r, big(v * L)])), outputs });
    }
    const recipe = this.factoryRecipe(id);
    if (c.buildings.factory > 0 && recipe) {
      const L = c.buildings.factory;
      const m = mult * this.specMult(id, 'industry');
      list.push({
        id: 'factory',
        inputs: Object.fromEntries(Object.entries(recipe.inputs).map(([r, v]) => [r, big(v * L)])),
        outputs: Object.fromEntries(Object.entries(recipe.outputs).map(([r, v]) => [r, big(v * L * m)])),
      });
    }
    return list;
  }

  tick(dt) {
    for (const id of this.ids()) this.tickColony(id, dt);
    this.tickTerraforming(dt);
  }

  tickColony(id, dt) {
    const list = this.producers(id);
    const eff = solveEfficiency(list, dt, (r) => this.stock(id, r));
    const perResource = {};
    const net = {};
    for (const p of list) {
      const e = eff.get(p.id);
      for (const [r, v] of Object.entries(p.outputs)) {
        const amt = v.mul(e);
        (perResource[r] ??= { income: BigNumber.ZERO, expense: BigNumber.ZERO }).income = perResource[r].income.add(amt);
        net[r] = (net[r] ?? BigNumber.ZERO).add(amt.mul(dt));
      }
      for (const [r, v] of Object.entries(p.inputs)) {
        const amt = v.mul(e);
        (perResource[r] ??= { income: BigNumber.ZERO, expense: BigNumber.ZERO }).expense = perResource[r].expense.add(amt);
        net[r] = (net[r] ?? BigNumber.ZERO).sub(amt.mul(dt));
      }
    }
    for (const [r, v] of Object.entries(net)) {
      if (v.gt(0)) {
        if (TRANSMITTED.includes(r)) this.game.resources.add(r, v);
        else this.addStock(id, r, v);
      } else if (v.lt(0)) this.removeStock(id, r, new BigNumber(-v.m, v.e));
    }
    this.reports[id] = { efficiency: Object.fromEntries(eff), perResource };
  }

  balance(id, r) {
    const x = this.reports[id]?.perResource?.[r];
    if (!x) return BigNumber.ZERO;
    return x.income.sub(x.expense);
  }

  // ---- terraforming ------------------------------------------------------

  terraformDuration() {
    return TERRAFORMING.duration * this.game.modifiers.get().terraformDuration;
  }

  canTerraform(id) {
    const reasons = [];
    const c = this.cs[id];
    if (!c) return { ok: false, reasons: ['Brak kolonii'] };
    if (!PLANET_MAP[id].terraformable) reasons.push('Tej planety nie da się terraformować');
    if (c.terraform.active) reasons.push('Etap terraformowania trwa');
    if (c.terraform.stage >= TERRAFORMING.maxStage) reasons.push('Terraformowanie ukończone');
    if (this.game.buildings.level('terraformingFacility') < 1) reasons.push('Wymagany Ośrodek terraformowania');
    if (this.game.fleet.available('terraformer') < 1) reasons.push('Wymagana wolna jednostka terraformująca');
    if (!this.game.resources.canAfford(TERRAFORMING.cost)) reasons.push('Brak zasobów');
    return { ok: reasons.length === 0, reasons };
  }

  startTerraform(id) {
    if (!this.canTerraform(id).ok) return false;
    if (!this.game.resources.spend(TERRAFORMING.cost)) return false;
    this.game.fleet.remove('terraformer', 1);
    const t = this.cs[id].terraform;
    t.active = true;
    t.progress = 0;
    return true;
  }

  tickTerraforming(dt) {
    for (const id of this.ids()) {
      const t = this.cs[id].terraform;
      if (!t.active) continue;
      t.progress += dt;
      if (t.progress >= this.terraformDuration()) {
        t.active = false;
        t.progress = 0;
        t.stage += 1;
        this.game.events.emit('terraformStage', { id, stage: t.stage });
      }
    }
  }

  // Summary of every colony for the home screen.
  summary() {
    return this.ids().map((id) => ({ id, name: PLANET_MAP[id].name, stage: this.stage(id), levels: this.totalLevels(id) }));
  }

  resourceName(r) {
    return RESOURCE_MAP[r]?.name ?? r;
  }
}
