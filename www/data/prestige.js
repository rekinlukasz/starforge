// Galactic Rebirth (prestige).
//
// Requirement: 60 completed technologies, 3 colonies and one completed
// megastructure stage.
// Points: floor(sqrt(energy produced this cycle / 1e8)) + 3 per colony
//         + 5 per completed megastructure stage.
//
// RESET: resources (except Prestige Points), station buildings, upgrades,
// research, colonies, fleet, expeditions, logistics, sector/planet discovery,
// megastructures, reactor charge.
// KEPT: Prestige Points and prestige upgrades, achievements, claimed missions,
// lifetime statistics, journal, settings.

export const PRESTIGE_REQUIREMENT = { techCount: 60, colonies: 3, megastructureStages: 1 };

export const PRESTIGE_FORMULA = {
  energyDivisor: 1e8,
  perColony: 3,
  perMegastructureStage: 5,
};

export const PRESTIGE_RESET = [
  'Wszystkie zasoby (poza punktami prestiżu)',
  'Budynki stacji i ulepszenia',
  'Badania (z wyjątkiem zachowanych przez ulepszenia prestiżu)',
  'Kolonie, flota, ekspedycje i trasy logistyczne',
  'Odkryte sektory i planety (chyba że zachowuje je Pamięć kartografów)',
  'Megastruktury',
];

export const PRESTIGE_KEPT = [
  'Punkty prestiżu i ulepszenia prestiżu',
  'Osiągnięcia (wraz z premią do produkcji)',
  'Odebrane zadania',
  'Dziennik i ustawienia',
];

// Permanent upgrades bought with Prestige Points. cost(level) = base * growth^level.
export const PRESTIGE_UPGRADES = [
  { id: 'productionMatrix', name: 'Matryca produkcyjna', icon: 'production', maxLevel: 20, base: 1, growth: 1.5,
    description: 'Cała produkcja +15% na poziom (addytywnie).', effect: { type: 'globalAdd', value: 0.15 } },
  { id: 'researchLegacy', name: 'Dziedzictwo nauki', icon: 'research', maxLevel: 10, base: 2, growth: 1.6,
    description: 'Szybkość badań +20% na poziom.', effect: { type: 'researchSpeed', value: 0.2 } },
  { id: 'startingKit', name: 'Zestaw startowy', icon: 'storage', maxLevel: 5, base: 1, growth: 2,
    description: 'Nowy cykl zaczyna się z zapasami: metal, krzem i energia x10 na poziom.', kit: { metal: 500, silicon: 200, energy: 500 } },
  { id: 'archiveRecall', name: 'Przywołanie archiwum', icon: 'journal', maxLevel: 2, base: 5, growth: 3,
    description: 'Nowy cykl zaczyna się z ukończonymi technologiami poziomu 1 (poziom 1) oraz 1–2 (poziom 2).' },
  { id: 'cartographyMemory', name: 'Pamięć kartografów', icon: 'explore', maxLevel: 1, base: 8, growth: 1,
    description: 'Odkryte sektory i planety pozostają odkryte po odrodzeniu.' },
  { id: 'fleetBlueprints', name: 'Plany flot', icon: 'frigate', maxLevel: 5, base: 3, growth: 1.8,
    description: 'Szybkość budowy statków +25% na poziom.', effect: { type: 'buildSpeed', value: 0.25 } },
  { id: 'offlineAnchor', name: 'Kotwica czasu', icon: 'settings', maxLevel: 4, base: 2, growth: 2,
    description: 'Limit produkcji offline +2 h na poziom.', effect: { type: 'offlineCapHours', value: 2 } },
];

export const PRESTIGE_UPGRADE_MAP = Object.fromEntries(PRESTIGE_UPGRADES.map((u) => [u.id, u]));

// One specialization is active per cycle; chosen when performing a rebirth.
export const PRESTIGE_SPECIALIZATIONS = {
  industrialist: { name: 'Przemysłowiec', description: 'Przetwórstwo i wydobycie +50%.',
    effects: [{ type: 'categoryMult', target: 'processing', value: 1.5 }, { type: 'categoryMult', target: 'mining', value: 1.5 }] },
  explorer: { name: 'Odkrywca', description: 'Ekspedycje -30% czasu, ładowność +30%.',
    effects: [{ type: 'expeditionDuration', value: 0.7 }, { type: 'shipCargo', value: 1.3 }] },
  scientist: { name: 'Naukowiec', description: 'Szybkość badań +50%.',
    effects: [{ type: 'researchSpeed', value: 0.5 }] },
  admiral: { name: 'Admirał', description: 'Siła ognia i osłony floty +50%.',
    effects: [{ type: 'shipAttack', value: 1.5 }, { type: 'shipShields', value: 1.5 }] },
  architect: { name: 'Architekt', description: 'Budynki i infrastruktura tańsze o 25%.',
    effects: [{ type: 'costMult', value: 0.75 }] },
};
