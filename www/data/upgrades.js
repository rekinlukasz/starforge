// One-time upgrades. Effect types (resolved by ModifierSystem):
//   clickAdd        +value to base click energy (additive with other clickAdd)
//   clickMult       x value to click energy (multiplicative)
//   clickRateShare  + value seconds of current energy production per click (additive)
//   overcharge      unlocks reactor overcharge (charge from clicks -> timed boost)
//   overchargeBoost + value to overcharge production multiplier (additive)
//   buildingMult    x value to outputs of `target` building (multiplicative)
//   capMult         x value to all storage caps (multiplicative)
// `unlock` uses the same condition format as buildings, plus { clicks: n }.

export const UPGRADES = [
  { id: 'reinforcedCoils', name: 'Wzmocnione cewki', icon: 'click',
    description: 'Kliknięcie reaktora daje +1 energii.',
    cost: { metal: 25 }, effects: [{ type: 'clickAdd', value: 1 }], unlock: {} },
  { id: 'focusedInjectors', name: 'Skupione wtryskiwacze', icon: 'click',
    description: 'Kliknięcie daje +3 energii.',
    cost: { metal: 120, silicon: 30 }, effects: [{ type: 'clickAdd', value: 3 }],
    unlock: { clicks: 50 } },
  { id: 'plasmaCapacitor', name: 'Kondensator plazmowy', icon: 'click',
    description: 'Energia z kliknięcia x2.',
    cost: { metal: 300, silicon: 120 }, effects: [{ type: 'clickMult', value: 2 }],
    unlock: { clicks: 150, buildings: { researchLab: 1 } } },
  { id: 'harmonicResonance', name: 'Rezonans harmoniczny', icon: 'click',
    description: 'Każde kliknięcie dodaje energię równą 0,5 s produkcji energii.',
    cost: { metal: 400, alloy: 60 }, effects: [{ type: 'clickRateShare', value: 0.5 }],
    unlock: { buildings: { alloyFoundry: 1 } } },
  { id: 'reactorOvercharge', name: 'Przeciążenie reaktora', icon: 'overcharge',
    description: 'Kliknięcia ładują reaktor. Pełne naładowanie daje 20 s produkcji x1,5.',
    cost: { metal: 200, silicon: 60 }, effects: [{ type: 'overcharge', value: 1 }],
    unlock: { clicks: 30, buildings: { deepCoreDrill: 1 } } },
  { id: 'stabilizedPlasma', name: 'Stabilizowana plazma', icon: 'overcharge',
    description: 'Przeciążenie daje dodatkowe +0,5 do mnożnika produkcji.',
    cost: { metal: 600, alloy: 80, electronics: 10 }, effects: [{ type: 'overchargeBoost', value: 0.5 }],
    unlock: { upgrades: ['reactorOvercharge'], buildings: { electronicsFactory: 1 } } },
  { id: 'photonCoating', name: 'Powłoka fotonowa', icon: 'solar',
    description: 'Panele słoneczne produkują x1,5.',
    cost: { metal: 150, silicon: 40 }, effects: [{ type: 'buildingMult', target: 'solarArray', value: 1.5 }],
    unlock: { buildings: { solarArray: 5 } } },
  { id: 'diamondDrillHeads', name: 'Diamentowe głowice', icon: 'mine',
    description: 'Kopalnie asteroid produkują x2.',
    cost: { metal: 120, silicon: 30 }, effects: [{ type: 'buildingMult', target: 'asteroidMine', value: 2 }],
    unlock: { buildings: { asteroidMine: 5 } } },
  { id: 'thermalBore', name: 'Wiertło termiczne', icon: 'drill',
    description: 'Odwierty głębinowe produkują x2.',
    cost: { metal: 250, silicon: 80 }, effects: [{ type: 'buildingMult', target: 'deepCoreDrill', value: 2 }],
    unlock: { buildings: { deepCoreDrill: 5 } } },
  { id: 'spectralAnalysis', name: 'Analiza spektralna', icon: 'lab',
    description: 'Laboratoria produkują x1,5 danych.',
    cost: { metal: 300, silicon: 150 }, effects: [{ type: 'buildingMult', target: 'researchLab', value: 1.5 }],
    unlock: { buildings: { researchLab: 3 } } },
  { id: 'arcFurnace', name: 'Piec łukowy', icon: 'foundry',
    description: 'Odlewnie stopów produkują x1,5.',
    cost: { metal: 800, alloy: 100 }, effects: [{ type: 'buildingMult', target: 'alloyFoundry', value: 1.5 }],
    unlock: { buildings: { alloyFoundry: 3 } } },
  { id: 'compressionRacks', name: 'Regały kompresyjne', icon: 'depot',
    description: 'Wszystkie magazyny x1,5.',
    cost: { metal: 500, alloy: 80 }, effects: [{ type: 'capMult', value: 1.5 }],
    unlock: { buildings: { cargoDepot: 3 } } },
];

export const UPGRADE_MAP = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

export const OVERCHARGE = {
  chargePerClick: 1,
  chargeRequired: 100,
  duration: 20, // seconds of simulation time
  baseMultiplier: 1.5,
};
