// Planets. Each has one clear advantage and one cost/limitation.
// Colonization stages: undiscovered -> discovered (scouted sector) ->
// analyzed (survey expedition) -> colony (colony ship arrived) -> developed
// (colony buildings) -> specialized -> logistics -> optional terraforming.
//
// deposits:    per-second output of one Extraction Complex level
// multipliers: suitability per specialization (1 = normal)
// upkeep:      per habitat level per second, drawn from the colony's stock
// slots:       max total colony building levels (terraforming adds more)

export const PLANET_TYPES = {
  rocky: 'Planeta skalista',
  oceanic: 'Planeta oceaniczna',
  desert: 'Planeta pustynna',
  ice: 'Planeta lodowa',
  volcanic: 'Planeta wulkaniczna',
  gas: 'Gazowy olbrzym',
  toxic: 'Planeta toksyczna',
  terraformable: 'Świat terraformowalny',
  ruins: 'Planeta z ruinami obcych',
  anomaly: 'Planeta anomalii',
};

const P = (o) => o;

export const PLANETS = [
  P({ id: 'kepler', name: 'Kepler Prime', type: 'rocky', sector: 'innerBelt', danger: 0,
    description: 'Stabilna, skalista planeta w strefie umiarkowanej.',
    advantage: 'Wszechstronne złoża metalu i krzemu, dużo miejsca pod zabudowę.',
    drawback: 'Brak wody — habitaty wymagają dostaw biomasy.',
    deposits: { metal: 4, silicon: 1.5 }, multipliers: { mining: 1.2, industry: 1.2, research: 1, agriculture: 0.6, trade: 1 },
    upkeep: { biomass: 0.2 }, slots: 30,
    colonizeCost: { constructionMaterials: 100, energy: 2000 }, requires: { tech: ['colonyShips'] } }),
  P({ id: 'thalassa', name: 'Thalassa', type: 'oceanic', sector: 'innerBelt', danger: 0,
    description: 'Glob pokryty płytkim oceanem pełnym mikroorganizmów.',
    advantage: 'Ogromne ilości wody i biomasy — spichlerz imperium.',
    drawback: 'Niemal brak metali; mało miejsca na lądzie.',
    deposits: { water: 6, biomass: 3 }, multipliers: { mining: 0.8, industry: 0.7, research: 1, agriculture: 1.6, trade: 1.1 },
    upkeep: {}, slots: 20,
    colonizeCost: { constructionMaterials: 150, energy: 3000 }, requires: { tech: ['colonyShips'] } }),
  P({ id: 'glacius', name: 'Glacius', type: 'ice', sector: 'cometCloud', danger: 0,
    description: 'Zamarznięty świat pokryty kilometrowym lodem.',
    advantage: 'Najbogatsze źródło wody w układzie.',
    drawback: 'Wysokie zużycie energii przez habitaty (ogrzewanie).',
    deposits: { water: 10, silicon: 1 }, multipliers: { mining: 1.3, industry: 0.9, research: 1.1, agriculture: 0.5, trade: 0.9 },
    upkeep: { energy: 3, biomass: 0.1 }, slots: 24,
    colonizeCost: { constructionMaterials: 150, energy: 4000 }, requires: { tech: ['colonyShips'] } }),
  P({ id: 'dunarr', name: 'Dunarr', type: 'desert', sector: 'outerReach', danger: 1,
    description: 'Pustynia pod dwoma słońcami.',
    advantage: 'Bogate złoża krzemu i stałe nasłonecznienie (energia).',
    drawback: 'Habitaty zużywają wodę.',
    deposits: { silicon: 6, energy: 20 }, multipliers: { mining: 1.3, industry: 1, research: 1, agriculture: 0.4, trade: 1.2 },
    upkeep: { water: 0.5 }, slots: 28,
    colonizeCost: { constructionMaterials: 250, polymers: 50 }, requires: { tech: ['colonyShips'] } }),
  P({ id: 'vulcan', name: 'Vulcan', type: 'volcanic', sector: 'outerReach', danger: 1,
    description: 'Aktywna wulkanicznie planeta o płynnym płaszczu.',
    advantage: 'Najbogatsze złoża metali — wydobycie x2.',
    drawback: 'Mało slotów; habitaty wymagają dużo wody do chłodzenia.',
    deposits: { metal: 12, chemicals: 0.5 }, multipliers: { mining: 1.5, industry: 1.4, research: 0.8, agriculture: 0.3, trade: 0.8 },
    upkeep: { water: 1, biomass: 0.2 }, slots: 18,
    colonizeCost: { constructionMaterials: 300, polymers: 100 }, requires: { tech: ['colonyShips', 'thermalShielding'] } }),
  P({ id: 'aurelion', name: 'Aurelion', type: 'gas', sector: 'jovianDeep', danger: 1,
    description: 'Gazowy olbrzym z pierścieniami. Kolonia unosi się w atmosferze.',
    advantage: 'Lotne związki: chemikalia i paliwo fuzyjne.',
    drawback: 'Brak metali i krzemu; tylko 14 slotów.',
    deposits: { chemicals: 4, fusionCells: 0.2 }, multipliers: { mining: 1.4, industry: 1, research: 1, agriculture: 0.2, trade: 1.3 },
    upkeep: { energy: 2 }, slots: 14,
    colonizeCost: { constructionMaterials: 400, machinery: 100 }, requires: { tech: ['colonyShips', 'floatingHabitats'] } }),
  P({ id: 'miasma', name: 'Miasma', type: 'toxic', sector: 'toxicVeil', danger: 2,
    description: 'Atmosfera z kwasów i związków siarki.',
    advantage: 'Związki chemiczne w ilościach przemysłowych; badania nad egzotyczną chemią.',
    drawback: 'Habitaty zużywają polimery (uszczelnienia).',
    deposits: { chemicals: 8, polymers: 0.5 }, multipliers: { mining: 1.2, industry: 1.2, research: 1.4, agriculture: 0.2, trade: 0.9 },
    upkeep: { polymers: 0.2 }, slots: 20,
    colonizeCost: { constructionMaterials: 500, polymers: 200 }, requires: { tech: ['colonyShips', 'environmentalSuits'] } }),
  P({ id: 'eden', name: 'Eden', type: 'terraformable', sector: 'verdantArm', danger: 1,
    description: 'Martwy świat o idealnej masie i orbicie. Czeka na atmosferę.',
    advantage: 'Można go terraformować: każdy etap +25% produkcji i +6 slotów.',
    drawback: 'Przed terraformowaniem ubogie złoża.',
    deposits: { metal: 2, water: 2, biomass: 1 }, multipliers: { mining: 1, industry: 1, research: 1, agriculture: 1.2, trade: 1 },
    upkeep: { biomass: 0.1 }, slots: 16, terraformable: true,
    colonizeCost: { constructionMaterials: 300, polymers: 100 }, requires: { tech: ['colonyShips'] } }),
  P({ id: 'ossuary', name: 'Ossuarium', type: 'ruins', sector: 'precursorRuins', danger: 2,
    description: 'Planeta-cmentarz dawnej cywilizacji, pokryta ruinami miast.',
    advantage: 'Kolonia odkopuje artefakty i dane — specjalizacja naukowa x2.',
    drawback: 'Ubogie złoża i mało miejsca między ruinami.',
    deposits: { researchData: 20, ancientArtifacts: 0.0005 }, multipliers: { mining: 0.6, industry: 0.6, research: 2, agriculture: 0.5, trade: 1 },
    upkeep: { biomass: 0.2, energy: 2 }, slots: 16,
    colonizeCost: { constructionMaterials: 600, machinery: 200 }, requires: { tech: ['colonyShips', 'xenoarchaeology'] } }),
  P({ id: 'singularis', name: 'Singularis', type: 'anomaly', sector: 'anomalyRift', danger: 4,
    description: 'Planeta w zakrzywionej czasoprzestrzeni wokół mikroosobliwości.',
    advantage: 'Jedyne naturalne źródło egzotycznej materii i antymaterii.',
    drawback: 'Habitaty zużywają ogniwa fuzyjne; tylko 10 slotów.',
    deposits: { exoticMatter: 0.02, antimatter: 0.05 }, multipliers: { mining: 1, industry: 0.8, research: 1.5, agriculture: 0.1, trade: 0.5 },
    upkeep: { fusionCells: 0.05, energy: 5 }, slots: 10,
    colonizeCost: { constructionMaterials: 2000, nanomaterials: 50, fusionCells: 200 }, requires: { tech: ['colonyShips', 'anomalyStabilization'] } }),
];

export const PLANET_MAP = Object.fromEntries(PLANETS.map((p) => [p.id, p]));

// Colony specializations. `focus` names the planet multiplier that applies.
export const SPECIALIZATIONS = {
  none: { name: 'Brak', description: 'Kolonia bez specjalizacji.', effects: {} },
  mining: { name: 'Górnicza', description: 'Kompleksy wydobywcze x1,5 (razy przydatność planety).', effects: { extractor: 1.5 } },
  industry: { name: 'Przemysłowa', description: 'Fabryki kolonialne x1,5 (razy przydatność planety).', effects: { factory: 1.5 } },
  research: { name: 'Naukowa', description: 'Każdy poziom habitatu daje 2 dane badawcze/s (razy przydatność).', effects: { research: 2 } },
  agriculture: { name: 'Rolnicza', description: 'Każdy poziom habitatu daje 1 biomasy/s (razy przydatność).', effects: { agriculture: 1 } },
  trade: { name: 'Handlowa', description: 'Każdy poziom habitatu daje 0,5 kredytu/s (razy przydatność).', effects: { trade: 0.5 } },
};
export const SPECIALIZATION_CHANGE_COST = { credits: 200, constructionMaterials: 100 };

// Colony buildings. Costs are paid from station stock (shipped as prefabs).
export const COLONY_BUILDINGS = [
  { id: 'extractor', name: 'Kompleks wydobywczy', icon: 'mine',
    description: 'Wydobywa złoża planety (patrz „Złoża”).',
    baseCost: { constructionMaterials: 20, machinery: 5 }, growth: 1.25 },
  { id: 'habitat', name: 'Habitat', icon: 'colony',
    description: 'Każdy poziom: +10% produkcji kolonii. Zużywa zasoby z magazynu kolonii.',
    baseCost: { constructionMaterials: 30, polymers: 10 }, growth: 1.3 },
  { id: 'factory', name: 'Fabryka kolonialna', icon: 'factory',
    description: 'Przetapia lokalne surowce: metal → stop, chemikalia → polimery, woda → biomasa.',
    baseCost: { constructionMaterials: 40, machinery: 15 }, growth: 1.3 },
  { id: 'spaceport', name: 'Port kosmiczny', icon: 'cargo',
    description: 'Infrastruktura: każdy poziom podwaja magazyn kolonii i skraca loty transportów o 10%.',
    baseCost: { constructionMaterials: 50, alloy: 100 }, growth: 1.5 },
];
export const COLONY_BUILDING_MAP = Object.fromEntries(COLONY_BUILDINGS.map((b) => [b.id, b]));

// Factory conversions (per factory level per second), first available input wins.
export const COLONY_FACTORY_RECIPES = [
  { inputs: { metal: 2 }, outputs: { alloy: 0.8 } },
  { inputs: { chemicals: 1.5 }, outputs: { polymers: 0.6 } },
  { inputs: { water: 2 }, outputs: { biomass: 0.8 } },
  { inputs: { silicon: 2 }, outputs: { electronics: 0.3 } },
];

export const COLONY_BASE_STORAGE = 2000;
export const HABITAT_BONUS = 0.1;

// Development stages derived from total building levels.
export const COLONY_STAGES = [
  { min: 0, name: 'Placówka' },
  { min: 5, name: 'Osada' },
  { min: 15, name: 'Kolonia' },
  { min: 30, name: 'Miasto' },
  { min: 50, name: 'Metropolia' },
];

// Terraforming (terraformable worlds only): each stage consumes a Terraformer ship + cost.
export const TERRAFORMING = {
  maxStage: 3,
  productionBonus: 0.25,
  slotBonus: 6,
  duration: 1800, // seconds of simulation time per stage
  cost: { polymers: 2000, water: 5000, biomass: 2000 },
  stageNames: ['Atmosfera', 'Hydrosfera', 'Biosfera'],
};
