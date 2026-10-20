// Missions: concrete goals with rewards. `goal` uses the Conditions format.
// `after` lists missions that must be claimed first (tutorial chain).
// Rewards are resources added on claim (subject to storage caps; the claim
// button warns when a reward would overflow).

export const MISSION_TYPES = {
  tutorial: 'Samouczek',
  development: 'Rozwój',
  technology: 'Technologia',
  production: 'Produkcja',
  longterm: 'Cel długoterminowy',
};

const M = (id, type, name, description, goal, reward, after = []) => ({ id, type, name, description, goal, reward, after });

export const MISSIONS = [
  // Tutorial chain. The click mission stands alone so no play style is
  // required to progress (idle players never tap the reactor).
  M('firstSpark', 'tutorial', 'Pierwsza iskra', 'Dotknij reaktora orbitalnego 10 razy.',
    { clicks: 10 }, { metal: 15 }),
  M('firstMine', 'tutorial', 'Uruchom pierwszą automatyczną kopalnię', 'Zbuduj kopalnię asteroid.',
    { buildings: { asteroidMine: 1 } }, { metal: 20, energy: 30 }),
  M('powerUp', 'tutorial', 'Stabilne zasilanie', 'Zbuduj 3 panele słoneczne.',
    { buildings: { solarArray: 3 } }, { metal: 40 }, ['firstMine']),
  M('siliconRush', 'tutorial', 'Krzemowa żyła', 'Uruchom odwiert głębinowy.',
    { buildings: { deepCoreDrill: 1 } }, { silicon: 30 }, ['powerUp']),
  M('scienceReborn', 'tutorial', 'Nauka odrodzona', 'Zbuduj laboratorium badawcze.',
    { buildings: { researchLab: 1 } }, { researchData: 25 }, ['siliconRush']),
  M('firstTech', 'tutorial', 'Pierwszy przełom', 'Ukończ dowolną technologię.',
    { techCount: 1 }, { metal: 100, silicon: 50 }, ['scienceReborn']),
  M('firstAlloy', 'tutorial', 'Wyprodukuj pierwsze stopy', 'Wyprodukuj łącznie 50 stopu metali.',
    { resourcesEarned: { alloy: 50 } }, { metal: 200, researchData: 100 }, ['firstTech']),

  // Development ------------------------------------------------------------
  M('industrialBase', 'development', 'Baza przemysłowa', 'Osiągnij łącznie 50 poziomów budynków.',
    { totalBuildingLevels: 50 }, { metal: 1000, alloy: 50 }, ['firstMine']),
  M('electronicsLine', 'development', 'Linia elektroniki', 'Zbuduj fabrykę elektroniki.',
    { buildings: { electronicsFactory: 1 } }, { silicon: 300, researchData: 300 }, ['firstAlloy']),
  M('bigStorage', 'development', 'Pojemne ładownie', 'Rozbuduj magazyn ładunkowy do poziomu 5.',
    { buildings: { cargoDepot: 5 } }, { metal: 1500 }, ['firstMine']),
  M('fusionAge', 'development', 'Era fuzji', 'Zbuduj reaktor fuzyjny.',
    { buildings: { fusionReactor: 1 } }, { water: 500, researchData: 2000 }, ['electronicsLine']),
  M('chemistryChain', 'development', 'Łańcuch chemiczny', 'Uruchom polimeryzator.',
    { buildings: { polymerPlant: 1 } }, { chemicals: 100, biomass: 100 }, ['electronicsLine']),
  M('heavyIndustry', 'development', 'Przemysł ciężki', 'Uruchom zakłady maszynowe.',
    { buildings: { machineWorks: 1 } }, { alloy: 300, electronics: 100 }, ['electronicsLine']),
  M('prefabModules', 'development', 'Moduły dla kolonii', 'Wyprodukuj 200 materiałów konstrukcyjnych.',
    { resourcesEarned: { constructionMaterials: 200 } }, { researchData: 10000 }, ['chemistryChain', 'heavyIndustry']),

  // Technology -------------------------------------------------------------
  M('fiveTechs', 'technology', 'Archiwista', 'Ukończ 5 technologii.',
    { techCount: 5 }, { researchData: 500 }, ['firstTech']),
  M('automationEra', 'technology', 'Era automatyzacji', 'Opracuj autonomicznych budowniczych.',
    { tech: ['autoBuilders'] }, { electronics: 100, alloy: 200 }, ['fiveTechs']),
  M('thinkingMachines', 'technology', 'Myślące maszyny', 'Opracuj sieci neuronowe.',
    { tech: ['neuralNetworks'] }, { researchData: 20000 }, ['fiveTechs']),
  M('quantumLeap', 'technology', 'Skok kwantowy', 'Opracuj teorię kwantową.',
    { tech: ['quantumTheory'] }, { electronics: 2000, machinery: 500 }, ['thinkingMachines']),

  // Production -------------------------------------------------------------
  M('metalTycoon', 'production', 'Metalowy magnat', 'Wydobądź łącznie 100 tys. metalu.',
    { resourcesEarned: { metal: 1e5 } }, { alloy: 500 }, ['industrialBase']),
  M('dataFlood', 'production', 'Zalew danych', 'Zbierz łącznie 1 mln danych badawczych.',
    { resourcesEarned: { researchData: 1e6 } }, { electronics: 1000 }, ['thinkingMachines']),

  // Long term --------------------------------------------------------------
  M('crystalHeart', 'longterm', 'Serce z kryształu', 'Wyhoduj 50 kryształów kwantowych.',
    { resourcesEarned: { quantumCrystals: 50 } }, { researchData: 1e6 }, ['quantumLeap']),
  M('unifiedTheory', 'longterm', 'Teoria wszystkiego', 'Opracuj teorię pola zunifikowanego.',
    { tech: ['unifiedField'] }, { quantumCrystals: 50 }, ['crystalHeart']),
];

export const MISSION_MAP = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));
