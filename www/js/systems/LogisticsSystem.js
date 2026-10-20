import { RESOURCE_MAP } from '../../data/resources.js';
import { SHIP_MAP } from '../../data/ships.js';
import { TRANSMITTED } from './ColonySystem.js';
import { BigNumber } from '../utils/BigNumber.js';

export const STATION = 'station';
export const MAX_ROUTES = 20;
export const FUEL_PER_UNIT = 0.5; // energy per unit carried, before fuel multipliers
export const MIN_INTERVAL = 30;

// Simple, predictable transport model: each route runs at most one trip at a
// time. A trip loads cargo atomically at departure (never more than the
// source holds), flies for a fixed travel time and is delivered exactly once
// on arrival, after which the shipment record is deleted.
export class LogisticsSystem {
  constructor(game) {
    this.game = game;
  }

  get ls() {
    return this.game.state.logistics;
  }

  available() {
    return this.game.modifiers.hasFeature('logistics');
  }

  isLocation(id) {
    return id === STATION || this.game.colonies.has(id);
  }

  transportable(resource) {
    return Boolean(RESOURCE_MAP[resource]) && !TRANSMITTED.includes(resource) && resource !== 'prestigePoints';
  }

  amountAt(loc, r) {
    return loc === STATION ? this.game.resources.amount(r) : this.game.colonies.stock(loc, r);
  }

  take(loc, r, v) {
    return loc === STATION ? this.game.resources.remove(r, v) : this.game.colonies.removeStock(loc, r, v);
  }

  give(loc, r, v) {
    return loc === STATION ? this.game.resources.add(r, v) : this.game.colonies.addStock(loc, r, v);
  }

  capacity(transporters) {
    return transporters * SHIP_MAP.transporter.stats.cargo * this.game.modifiers.get().shipCargo;
  }

  travelTime(from, to) {
    const planet = from === STATION ? to : from;
    const base = this.game.planets.distance(planet);
    const speed = this.game.fleet.stats('transporter').speed;
    const spaceport = this.game.colonies.colony(planet)?.buildings.spaceport ?? 0;
    return (base / speed) * Math.pow(0.9, spaceport);
  }

  fuelFor(amount) {
    return BigNumber.from(amount).mul(FUEL_PER_UNIT * this.game.modifiers.get().fuelMult);
  }

  // Validates and creates a route. Returns { ok, reason?, route? }.
  createRoute({ from, to, resource, amount, interval, transporters }) {
    const n = Math.floor(Number(transporters));
    const amt = Number(amount);
    const iv = Number(interval);
    if (!this.available()) return { ok: false, reason: 'Wymagana technologia logistyki' };
    if (this.ls.routes.length >= MAX_ROUTES) return { ok: false, reason: 'Osiągnięto limit tras' };
    if (!this.isLocation(from) || !this.isLocation(to)) return { ok: false, reason: 'Nieznana lub nieskolonizowana lokalizacja' };
    if (from === to) return { ok: false, reason: 'Źródło i cel muszą się różnić' };
    if (!this.transportable(resource)) return { ok: false, reason: 'Tego zasobu nie można przewozić' };
    if (!Number.isFinite(n) || n < 1) return { ok: false, reason: 'Przydziel co najmniej jeden transportowiec' };
    if (n > this.game.fleet.available('transporter')) return { ok: false, reason: 'Za mało wolnych transportowców' };
    if (!Number.isFinite(amt) || amt <= 0) return { ok: false, reason: 'Nieprawidłowa wielkość transportu' };
    if (!Number.isFinite(iv) || iv < MIN_INTERVAL) return { ok: false, reason: `Częstotliwość co najmniej ${MIN_INTERVAL} s` };
    const route = {
      id: this.ls.nextId++,
      from, to, resource,
      amount: Math.min(amt, this.capacity(n)),
      interval: Math.floor(iv),
      transporters: n,
      active: true,
      timer: iv, // first trip departs immediately
      delivered: 0,
      trips: 0,
      lastIssue: '',
    };
    this.ls.routes.push(route);
    this.game.events.emit('routeCreated', route);
    return { ok: true, route };
  }

  setActive(id, on) {
    const r = this.ls.routes.find((x) => x.id === id);
    if (!r) return false;
    r.active = Boolean(on);
    return true;
  }

  // Deleting a route returns cargo in flight to its source.
  deleteRoute(id) {
    const i = this.ls.routes.findIndex((x) => x.id === id);
    if (i < 0) return false;
    const [r] = this.ls.routes.splice(i, 1);
    for (const s of this.ls.shipments.filter((x) => x.routeId === id)) this.give(s.from, s.resource, s.amount);
    this.ls.shipments = this.ls.shipments.filter((x) => x.routeId !== id);
    this.game.events.emit('routeDeleted', r);
    return true;
  }

  inFlight(routeId) {
    return this.ls.shipments.some((s) => s.routeId === routeId);
  }

  tick(dt) {
    const now = this.game.state.meta.simTime;
    // Deliveries first; each shipment is removed as it is delivered.
    const arrived = this.ls.shipments.filter((s) => s.arrivesAt <= now);
    if (arrived.length) {
      this.ls.shipments = this.ls.shipments.filter((s) => s.arrivesAt > now);
      for (const s of arrived) {
        const stored = this.give(s.to, s.resource, BigNumber.from(s.amount));
        const route = this.ls.routes.find((r) => r.id === s.routeId);
        if (route) {
          route.delivered += stored.toNumber();
          route.lastIssue = stored.lt(s.amount * 0.999) ? 'Magazyn celu pełny — część ładunku przepadła' : '';
        }
      }
    }
    for (const r of this.ls.routes) {
      if (!r.active) continue;
      // Endpoints must still exist (e.g. after a reset of colonies via prestige).
      if (!this.isLocation(r.from) || !this.isLocation(r.to)) { r.active = false; r.lastIssue = 'Nieprawidłowa trasa'; continue; }
      r.timer += dt;
      if (r.timer < r.interval || this.inFlight(r.id)) continue;
      const have = this.amountAt(r.from, r.resource);
      const load = BigNumber.min(have, BigNumber.from(r.amount));
      if (load.lte(0)) { r.lastIssue = 'Brak zasobu w źródle'; r.timer = 0; continue; }
      const fuel = this.fuelFor(load.toNumber());
      if (!this.game.resources.canAfford({ energy: fuel })) { r.lastIssue = 'Brak energii na paliwo (stacja)'; continue; }
      this.game.resources.spend({ energy: fuel });
      const taken = this.take(r.from, r.resource, load);
      this.ls.shipments.push({
        uid: this.ls.nextId++,
        routeId: r.id, from: r.from, to: r.to, resource: r.resource,
        amount: taken.toNumber(),
        arrivesAt: now + this.travelTime(r.from, r.to),
      });
      r.trips += 1;
      r.timer = 0;
      r.lastIssue = '';
    }
  }

  routeStatus(r) {
    if (!r.active) return 'Wstrzymana';
    if (this.inFlight(r.id)) return 'W drodze';
    return r.lastIssue || 'Oczekuje na odlot';
  }
}
