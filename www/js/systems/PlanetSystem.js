import { PLANETS, PLANET_MAP } from '../../data/planets.js';
import { SECTORS, SECTOR_MAP } from '../../data/sectors.js';
import { checkConditions } from './Conditions.js';

// Discovery state of sectors and planets.
// Planet status: undiscovered -> discovered -> analyzed -> colonized.
export class PlanetSystem {
  constructor(game) {
    this.game = game;
  }

  get space() {
    return this.game.state.space;
  }

  isSectorDiscovered(id) {
    return Boolean(SECTOR_MAP[id]?.startsDiscovered || this.space.sectors[id]?.discovered);
  }

  discoverSector(id) {
    if (!SECTOR_MAP[id] || this.isSectorDiscovered(id)) return false;
    this.space.sectors[id] = { discovered: true };
    this.game.events.emit('sectorDiscovered', id);
    return true;
  }

  status(id) {
    return this.space.planets[id]?.status ?? 'undiscovered';
  }

  setStatus(id, status) {
    const order = ['undiscovered', 'discovered', 'analyzed', 'colonized'];
    // Status only ever moves forward.
    if (order.indexOf(status) <= order.indexOf(this.status(id))) return false;
    this.space.planets[id] = { status };
    this.game.events.emit('planetStatus', { id, status });
    return true;
  }

  discoverPlanet(id) {
    if (!PLANET_MAP[id]) return false;
    return this.setStatus(id, 'discovered');
  }

  colonizationRequirements(id) {
    return checkConditions(this.game.state, PLANET_MAP[id].requires);
  }

  discoveredSectors() {
    return SECTORS.filter((s) => this.isSectorDiscovered(s.id));
  }

  knownPlanets() {
    return PLANETS.filter((p) => this.status(p.id) !== 'undiscovered');
  }

  // Travel time base for logistics (seconds at speed 1).
  distance(planetId) {
    const p = PLANET_MAP[planetId];
    return 60 + 60 * (SECTOR_MAP[p.sector]?.danger ?? 0);
  }
}
