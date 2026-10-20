import { BUILDINGS } from '../../data/buildings.js';
import { RECIPES, recipeRates } from '../../data/recipes.js';
import { BASE_PRODUCTION, RESOURCE_IDS } from '../../data/resources.js';
import { BigNumber } from '../utils/BigNumber.js';

const BALANCE_PASSES = 4;

// Solves per-producer efficiency e in [0,1] for one step. Shared by the
// station and every colony. `list` entries: { id, inputs: {r: BigNumber/s},
// outputs: {r: BigNumber/s} }; `amountOf(r)` returns the current stock.
export function solveEfficiency(list, dt, amountOf) {
  const eff = new Map(list.map((p) => [p.id, 1]));
  for (let pass = 0; pass < BALANCE_PASSES; pass++) {
    const supply = {};
    const demand = {};
    for (const p of list) {
      const e = eff.get(p.id);
      for (const [r, v] of Object.entries(p.outputs)) supply[r] = (supply[r] ?? BigNumber.ZERO).add(v.mul(e * dt));
      for (const [r, v] of Object.entries(p.inputs)) demand[r] = (demand[r] ?? BigNumber.ZERO).add(v.mul(dt));
    }
    const ratio = {};
    for (const [r, d] of Object.entries(demand)) {
      if (d.isZero()) { ratio[r] = 1; continue; }
      const available = amountOf(r).add(supply[r] ?? BigNumber.ZERO);
      ratio[r] = Math.min(1, Math.max(0, available.div(d).toNumber()));
    }
    let changed = false;
    for (const p of list) {
      let e = 1;
      for (const r of Object.keys(p.inputs)) e = Math.min(e, ratio[r]);
      if (Math.abs(e - eff.get(p.id)) > 1e-9) changed = true;
      eff.set(p.id, e);
    }
    if (!changed) break;
  }
  return eff;
}

// Aggregated, deterministic production. Per tick every building type is
// handled once (rate * level), never per individual building instance.
//
// effective output = recipe output * level * buildingMult(incl. category) * milestoneMult
//                    * resourceMult(output) * globalMult
// effective input  = recipe input * level * inputMult (bonuses improve efficiency, not demand)
//
// When inputs run short, each consumer runs at efficiency e in [0,1] equal to the
// worst satisfied ratio among its inputs; inputs and outputs scale with e.
export class ProductionSystem {
  constructor(game) {
    this.game = game;
    this.lastReport = this.emptyReport();
  }

  emptyReport() {
    const perResource = {};
    for (const id of RESOURCE_IDS) perResource[id] = { income: BigNumber.ZERO, expense: BigNumber.ZERO };
    return { perResource, efficiency: {} };
  }

  // Full-efficiency per-second flows of every active producer.
  producers() {
    const game = this.game;
    const mods = game.modifiers;
    const global = mods.globalProductionMultiplier();
    const list = [];
    const baseOut = {};
    for (const [id, v] of Object.entries(BASE_PRODUCTION)) baseOut[id] = BigNumber.from(v * global * mods.resourceMultiplier(id));
    list.push({ id: '__core', inputs: {}, outputs: baseOut });

    for (const b of BUILDINGS) {
      const level = game.buildings.level(b.id);
      if (!b.recipe || level <= 0) continue;
      const rates = recipeRates(RECIPES[b.recipe]);
      const mult = mods.buildingMultiplier(b.id) * game.buildings.milestoneMultiplier(b.id) * global;
      const inMult = mods.inputMultiplier(b.id);
      const inputs = {};
      const outputs = {};
      for (const [r, v] of Object.entries(rates.inputs)) inputs[r] = BigNumber.from(v * inMult).mul(level);
      for (const [r, v] of Object.entries(rates.outputs)) outputs[r] = BigNumber.from(v * mult * mods.resourceMultiplier(r)).mul(level);
      list.push({ id: b.id, inputs, outputs });
    }
    return list;
  }

  solveEfficiency(list, dt) {
    return solveEfficiency(list, dt, (r) => this.game.resources.amount(r));
  }
  // Advances production by dt seconds. Callers keep dt small (<= 1 s) so
  // shortages are resolved smoothly; GameLoop/OfflineProgress handle that.
  tick(dt) {
    if (!(dt > 0)) return;
    const list = this.producers();
    const eff = this.solveEfficiency(list, dt);
    const report = this.emptyReport();
    const net = {};
    for (const p of list) {
      const e = eff.get(p.id);
      report.efficiency[p.id] = e;
      for (const [r, v] of Object.entries(p.outputs)) {
        const amt = v.mul(e);
        report.perResource[r].income = report.perResource[r].income.add(amt);
        net[r] = (net[r] ?? BigNumber.ZERO).add(amt.mul(dt));
      }
      for (const [r, v] of Object.entries(p.inputs)) {
        const amt = v.mul(e);
        report.perResource[r].expense = report.perResource[r].expense.add(amt);
        net[r] = (net[r] ?? BigNumber.ZERO).sub(amt.mul(dt));
      }
    }
    const res = this.game.resources;
    for (const [r, v] of Object.entries(net)) {
      if (v.gt(0)) res.add(r, v);
      else if (v.lt(0)) res.remove(r, new BigNumber(-v.m, v.e));
    }
    this.lastReport = report;
  }

  // Per-second balance for UI: { income, expense, net, timeToCap }.
  balance(id) {
    const r = this.lastReport.perResource[id];
    const net = r.income.sub(r.expense);
    let timeToCap = null;
    const cap = this.game.resources.cap(id);
    if (cap && net.gt(0)) {
      const left = cap.sub(this.game.resources.amount(id));
      timeToCap = left.lte(0) ? 0 : left.div(net).toNumber();
    }
    return { income: r.income, expense: r.expense, net, timeToCap };
  }

  // Current per-second energy production (used by click rate-share bonus).
  energyIncome() {
    return this.lastReport.perResource.energy.income;
  }
}
