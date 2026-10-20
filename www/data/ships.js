// Ship types. Built in the Shipyard (station building) through a queue.
// Stats: speed (travel time divisor), cargo (units per trip / mining haul),
// attack, armor (damage reduction), shields (absorbed each round), hull (HP).
// `unlock` uses the Conditions format.

export const SHIP_ROLES = {
  civil: 'Cywilne',
  military: 'Wojskowe',
};

const S = (id, name, icon, role, cost, buildTime, stats, unlock, description) =>
  ({ id, name, icon, role, cost, buildTime, stats, unlock, description });

export const SHIPS = [
  S('scout', 'Zwiadowca', 'scout', 'civil',
    { metal: 400, electronics: 40, energy: 300 }, 30,
    { speed: 3, cargo: 0, attack: 1, armor: 2, shields: 2, hull: 20 },
    { tech: ['spaceflight'] }, 'Szybki statek rozpoznawczy. Odkrywa sektory i planety.'),
  S('miner', 'Statek wydobywczy', 'mine', 'civil',
    { metal: 700, alloy: 80, energy: 300 }, 45,
    { speed: 1.5, cargo: 60, attack: 0, armor: 5, shields: 0, hull: 50 },
    { tech: ['spaceflight'] }, 'Wydobywa surowce w odległych sektorach podczas ekspedycji górniczych.'),
  S('researchVessel', 'Statek badawczy', 'research', 'civil',
    { electronics: 250, alloy: 150, metal: 500 }, 90,
    { speed: 2, cargo: 10, attack: 0, armor: 3, shields: 5, hull: 40 },
    { tech: ['deepSpaceSensors'] }, 'Analizuje planety i prowadzi ekspedycje naukowe.'),
  S('transporter', 'Transportowiec', 'cargo', 'civil',
    { metal: 1000, alloy: 200, electronics: 50 }, 60,
    { speed: 2, cargo: 200, attack: 0, armor: 8, shields: 0, hull: 80 },
    { tech: ['interplanetaryLogistics'] }, 'Obsługuje trasy logistyczne między stacją a koloniami.'),
  S('colonyShip', 'Statek kolonizacyjny', 'colony', 'civil',
    { constructionMaterials: 150, polymers: 80, machinery: 40, biomass: 150 }, 180,
    { speed: 1, cargo: 0, attack: 0, armor: 10, shields: 5, hull: 120 },
    { tech: ['colonyShips'] }, 'Zakłada placówkę na przeanalizowanej planecie. Zużywany przy kolonizacji.'),
  S('escort', 'Jednostka eskortowa', 'escort', 'military',
    { alloy: 400, electronics: 100, metal: 800 }, 60,
    { speed: 2.5, cargo: 0, attack: 8, armor: 10, shields: 10, hull: 60 },
    { tech: ['defenseSystems'] }, 'Lekka osłona konwojów i ekspedycji.'),
  S('frigate', 'Fregata', 'frigate', 'military',
    { alloy: 1500, machinery: 200, electronics: 300 }, 150,
    { speed: 2, cargo: 0, attack: 25, armor: 40, shields: 20, hull: 200 },
    { tech: ['warships'] }, 'Podstawowy okręt liniowy.'),
  S('cruiser', 'Krążownik', 'cruiser', 'military',
    { alloy: 8000, machinery: 1500, electronics: 2000, fusionCells: 150 }, 400,
    { speed: 1.5, cargo: 0, attack: 120, armor: 200, shields: 150, hull: 1000 },
    { tech: ['heavyWarships'] }, 'Ciężki okręt zdolny do walki z silnymi flotami.'),
  S('terraformer', 'Jednostka terraformująca', 'terraform', 'civil',
    { machinery: 2500, nanomaterials: 40, fusionCells: 150, polymers: 1000 }, 600,
    { speed: 1, cargo: 0, attack: 0, armor: 20, shields: 20, hull: 300 },
    { tech: ['atmosphericProcessing'] }, 'Przekształca atmosferę planety. Zużywana przy etapie terraformowania.'),
];

export const SHIP_MAP = Object.fromEntries(SHIPS.map((s) => [s.id, s]));

// Per-type upgrade levels: each level +10% to all combat stats and speed.
export const SHIP_UPGRADE = { maxLevel: 10, statBonus: 0.1, costGrowth: 1.6 };
