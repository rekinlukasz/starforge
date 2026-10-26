// Pure layout and presentation rules for the 3D layer. No three.js and no
// DOM here, so everything is unit-testable and the scenes stay thin.
import { BUILDINGS } from '../../data/buildings.js';
import { SECTORS } from '../../data/sectors.js';

// Which 3D view each UI screen shows behind its panels.
export const SCREEN_VIEWS = {
  home: { view: 'station', camera: 'home' },
  production: { view: 'station', camera: 'industry' },
  research: { view: 'station', camera: 'labs' },
  fleet: { view: 'station', camera: 'hangar' },
  planets: { view: 'planet', camera: 'planet' },
  exploration: { view: 'galaxy', camera: 'overview' },
  galaxy: { view: 'galaxy', camera: 'interactive' },
};

export function viewForScreen(screenId) {
  return SCREEN_VIEWS[screenId] ?? SCREEN_VIEWS.home;
}

// Rendering profiles. 'auto' picks low on weak devices.
export const QUALITY = {
  high: { pixelRatio: 1.5, antialias: true, fps: 60, stars: 2500, galaxyStars: 9000, asteroids: 220, modulesPerCategory: 24 },
  low: { pixelRatio: 1, antialias: false, fps: 30, stars: 900, galaxyStars: 3500, asteroids: 80, modulesPerCategory: 12 },
};
export const GRAPHICS_OPTIONS = ['auto', 'high', 'low', 'off'];

export function resolveQuality(setting, device = {}) {
  if (setting === 'off') return null;
  if (setting === 'high' || setting === 'low') return { name: setting, ...QUALITY[setting] };
  const weak = (device.cores ?? 8) <= 4 || (device.memory ?? 8) <= 3 || (device.dpr ?? 1) >= 3 && (device.cores ?? 8) <= 6;
  const name = weak ? 'low' : 'high';
  return { name, ...QUALITY[name] };
}

// Station modules: each building category occupies an arc of the station
// ring; the number of modules grows with the square root of the category's
// total building levels, so early purchases are visible and late game stays bounded.
export const RING_CATEGORIES = ['energy', 'mining', 'processing', 'infrastructure', 'science', 'space'];

export function categoryLevels(state) {
  const totals = Object.fromEntries(RING_CATEGORIES.map((c) => [c, 0]));
  for (const b of BUILDINGS) {
    if (totals[b.category] === undefined) continue;
    totals[b.category] += state.buildings[b.id]?.level ?? 0;
  }
  return totals;
}

export function moduleCount(levels, max) {
  if (levels <= 0) return 0;
  return Math.min(max, Math.ceil(Math.sqrt(levels) * 1.5));
}

// Number of asteroids/solar panels shown for a building level (bounded).
export function scaledCount(level, perLevel, max) {
  return Math.max(0, Math.min(max, Math.round(level * perLevel)));
}

// Ships visible around the station: owned ships, capped per type and overall.
export function visibleShips(fleetShips, perType = 6, total = 30) {
  const out = [];
  for (const [id, entry] of Object.entries(fleetShips ?? {})) {
    const n = Math.min(perType, entry?.owned ?? 0);
    for (let i = 0; i < n && out.length < total; i++) out.push({ id, index: i });
  }
  return out;
}

// Sector map layout in percent (shared by the 2D SVG map and the 3D galaxy,
// so both modes show the same geography). Unlisted sectors get a fallback spot.
export const SECTOR_MAP_2D = {
  innerBelt: [14, 52], cometCloud: [30, 22], outerReach: [34, 70], jovianDeep: [50, 18],
  toxicVeil: [56, 58], verdantArm: [54, 86], pirateHaven: [74, 80], precursorRuins: [74, 42], anomalyRift: [90, 22],
};

export function sectorMapPosition(id, index = 0) {
  return SECTOR_MAP_2D[id] ?? [20 + ((index * 37) % 60), 20 + ((index * 53) % 60)];
}

// Galaxy layout: 2D map spread over the disk (x, z) with a little height (y).
export const GALAXY_RADIUS = 30;

export function sectorPositions() {
  const pos = {};
  SECTORS.forEach((s, i) => {
    const [px, py] = sectorMapPosition(s.id, i);
    pos[s.id] = [(px - 50) * 0.62, Math.sin(i * 1.7) * 1.5, (py - 50) * 0.62];
  });
  return pos;
}

// Links between sectors follow the discovery graph (who reveals whom).
export function sectorLinks() {
  const links = [];
  for (const s of SECTORS) {
    for (const e of s.expeditions) {
      for (const d of e.discovers?.sectors ?? []) links.push([s.id, d]);
    }
  }
  return links;
}

export const HOME_SECTOR = SECTORS.find((s) => s.startsDiscovered)?.id ?? SECTORS[0].id;

// Fleet marker position for an active expedition: flies out during the
// first half, returns home during the second. Returns [x, y, z].
export function expeditionPosition(positions, sectorId, progress) {
  const home = positions[HOME_SECTOR];
  const target = positions[sectorId] ?? home;
  const p = Math.min(1, Math.max(0, progress));
  const leg = p < 0.5 ? p * 2 : (1 - p) * 2; // 0 -> 1 -> 0
  const ease = leg * leg * (3 - 2 * leg);
  const arc = Math.sin(ease * Math.PI) * 2.5;
  return [
    home[0] + (target[0] - home[0]) * ease,
    home[1] + (target[1] - home[1]) * ease + arc,
    home[2] + (target[2] - home[2]) * ease,
  ];
}

// Visual state of a sector node.
export function sectorState(game, sector) {
  if (!game.planets.isSectorDiscovered(sector.id)) return 'unknown';
  const planets = sector.expeditions.flatMap((e) => e.discovers?.planets ?? []);
  if (planets.some((p) => game.colonies.has(p))) return 'colonized';
  return sector.danger >= 3 ? 'hostile' : 'known';
}

// Planet shown on the Planets screen when none was picked: first colony,
// otherwise first known planet, otherwise null.
export function defaultPlanet(game) {
  return game.colonies.ids()[0] ?? game.planets.knownPlanets()[0]?.id ?? null;
}

// Visual parameters per planet type, shared by tools/build-models.mjs (GLB
// textures and extras) and the runtime fallback. relief = normal-map strength
// (0 = smooth); clouds = has a cloud layer; rings = gas-giant rings.
export const PLANET_LOOK = {
  rocky: { atmosphere: 0xc9b9a6, atmosphereIntensity: 0.5, relief: 3, clouds: false, roughness: 0.95 },
  oceanic: { atmosphere: 0x6fc3ff, atmosphereIntensity: 1.1, relief: 0.6, clouds: true, roughness: 0.55 },
  desert: { atmosphere: 0xffd28a, atmosphereIntensity: 1.0, relief: 1.6, clouds: false, roughness: 0.95 },
  ice: { atmosphere: 0xd8f3ff, atmosphereIntensity: 1.1, relief: 1.4, clouds: true, roughness: 0.6 },
  volcanic: { atmosphere: 0xff7a3d, atmosphereIntensity: 1.1, relief: 3.5, clouds: false, roughness: 0.9 },
  gas: { atmosphere: 0xf7d9a6, atmosphereIntensity: 1.1, relief: 0, clouds: false, roughness: 1, rings: true, radius: 5.2 },
  toxic: { atmosphere: 0xb8ff6a, atmosphereIntensity: 1.1, relief: 0.8, clouds: true, roughness: 0.9 },
  terraformable: { atmosphere: 0x9fd0ff, atmosphereIntensity: 1.1, relief: 2.5, clouds: false, roughness: 0.9 },
  ruins: { atmosphere: 0xc9b8ff, atmosphereIntensity: 1.1, relief: 2.5, clouds: false, roughness: 0.9 },
  anomaly: { atmosphere: 0xd48bff, atmosphereIntensity: 1.1, relief: 1.2, clouds: false, roughness: 0.8 },
};

// GLB file id for a planet, including terraforming stage variants (eden-t1…t3).
export function planetModelId(planetId, terraformStage = 0) {
  return terraformStage > 0 ? `${planetId}-t${terraformStage}` : planetId;
}
