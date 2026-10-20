// Sectors of space and the expeditions available in them.
//
// Expedition fields:
//   type        scout | mining | science | story | combat
//   ships       minimum fleet { shipId: count } (all assigned ships travel)
//   cost        resources paid at launch (fuel and supplies)
//   duration    base seconds (divided by slowest ship speed / 2 and fleet speed bonuses)
//   rewards     resources granted on claim; for mining, multiplied by fleet cargo / 100
//   discovers   { sectors: [], planets: [] } revealed on claim (deterministic)
//   repeatable  can run again after claiming
//   enemy       combat missions only: { attack, armor, shields, hull }; the listed
//               minimum fleet at base stats must win (tested), more ships cut losses
//   requires    Conditions format (tech, etc.)
//   everyN      { count, rewards }: deterministic bonus every N-th completion
//
// Core progression (discovering every planet) never requires combat.

export const SECTORS = [
  { id: 'innerBelt', name: 'Pas Wewnętrzny', danger: 0, startsDiscovered: true,
    description: 'Gruz po dawnej stoczni orbitalnej. Bezpieczny i dobrze znany.',
    expeditions: [
      { id: 'innerBelt_scout', type: 'scout', name: 'Zwiad pasa', ships: { scout: 1 }, cost: { energy: 500 }, duration: 120,
        rewards: { metal: 500 }, discovers: { planets: ['kepler', 'thalassa'], sectors: ['cometCloud', 'outerReach'] } },
      { id: 'innerBelt_mining', type: 'mining', name: 'Wydobycie z wraków', ships: { miner: 1 }, cost: { energy: 300 }, duration: 180,
        rewards: { metal: 2000, alloy: 100 }, repeatable: true },
    ] },
  { id: 'cometCloud', name: 'Obłok Komet', danger: 0,
    description: 'Lodowe ciała na skraju układu.',
    expeditions: [
      { id: 'cometCloud_scout', type: 'scout', name: 'Mapowanie obłoku', ships: { scout: 1 }, cost: { energy: 1000 }, duration: 240,
        rewards: { water: 1000 }, discovers: { planets: ['glacius'], sectors: ['jovianDeep'] } },
      { id: 'cometCloud_mining', type: 'mining', name: 'Zbiór lodu kometarnego', ships: { miner: 1 }, cost: { energy: 500 }, duration: 240,
        rewards: { water: 3000, chemicals: 200 }, repeatable: true },
    ] },
  { id: 'outerReach', name: 'Zewnętrzna Rubież', danger: 1,
    description: 'Granica dawnego terytorium. Sygnały wraków i aktywność piratów.',
    expeditions: [
      { id: 'outerReach_scout', type: 'scout', name: 'Rozpoznanie Rubieży', ships: { scout: 1 }, cost: { energy: 2000 }, duration: 480,
        rewards: { credits: 200 }, discovers: { planets: ['dunarr', 'vulcan'], sectors: ['toxicVeil', 'verdantArm', 'pirateHaven'] } },
      { id: 'outerReach_science', type: 'science', name: 'Pomiary promieniowania', ships: { researchVessel: 1 }, cost: { energy: 1500 }, duration: 600,
        rewards: { researchData: 5000 }, repeatable: true, everyN: { count: 3, rewards: { ancientArtifacts: 1 } } },
      { id: 'outerReach_patrol', type: 'combat', name: 'Rozbicie patrolu piratów', ships: { escort: 2 }, cost: { energy: 1000 }, duration: 300,
        enemy: { attack: 12, armor: 10, shields: 10, hull: 90 }, rewards: { credits: 800, alloy: 500 }, repeatable: true },
    ] },
  { id: 'jovianDeep', name: 'Głębia Jowiszowa', danger: 1,
    description: 'Strefa gazowych olbrzymów i ich księżyców.',
    expeditions: [
      { id: 'jovianDeep_scout', type: 'scout', name: 'Przelot przez pierścienie', ships: { scout: 1 }, cost: { energy: 3000 }, duration: 600,
        rewards: { chemicals: 500 }, discovers: { planets: ['aurelion'] }, requires: { tech: ['deepSpaceSensors'] } },
      { id: 'jovianDeep_mining', type: 'mining', name: 'Zbieranie helu-3', ships: { miner: 2 }, cost: { energy: 2000 }, duration: 600,
        rewards: { chemicals: 2000, fusionCells: 20 }, repeatable: true },
    ] },
  { id: 'toxicVeil', name: 'Toksyczna Zasłona', danger: 2,
    description: 'Mgławica bogata w reaktywne związki.',
    expeditions: [
      { id: 'toxicVeil_scout', type: 'scout', name: 'Sondowanie mgławicy', ships: { scout: 2 }, cost: { energy: 5000, polymers: 100 }, duration: 900,
        rewards: { chemicals: 2000 }, discovers: { planets: ['miasma'], sectors: ['precursorRuins'] } },
      { id: 'toxicVeil_science', type: 'science', name: 'Analiza egzotycznej chemii', ships: { researchVessel: 2 }, cost: { energy: 5000 }, duration: 1200,
        rewards: { researchData: 40000, chemicals: 1000 }, repeatable: true },
    ] },
  { id: 'verdantArm', name: 'Zielone Ramię', danger: 1,
    description: 'Ramię spiralne z młodymi gwiazdami i planetami w strefie życia.',
    expeditions: [
      { id: 'verdantArm_scout', type: 'scout', name: 'Poszukiwanie światów', ships: { scout: 1, researchVessel: 1 }, cost: { energy: 6000 }, duration: 1200,
        rewards: { biomass: 1000 }, discovers: { planets: ['eden'] } },
    ] },
  { id: 'pirateHaven', name: 'Przystań Piratów', danger: 3,
    description: 'Ufortyfikowana baza rabusiów żerujących na szlakach. W pełni opcjonalna.',
    expeditions: [
      { id: 'pirateHaven_raid', type: 'combat', name: 'Atak na przystań', ships: { frigate: 3 }, cost: { energy: 10000, fusionCells: 50 }, duration: 900,
        enemy: { attack: 70, armor: 30, shields: 40, hull: 250 }, rewards: { credits: 5000, ancientArtifacts: 2, machinery: 1000 }, repeatable: true },
      { id: 'pirateHaven_fortress', type: 'combat', name: 'Szturm na cytadelę', ships: { cruiser: 2 }, cost: { energy: 50000, fusionCells: 300 }, duration: 1800,
        enemy: { attack: 400, armor: 100, shields: 200, hull: 650 }, rewards: { credits: 30000, ancientArtifacts: 5, nanomaterials: 100 } },
    ] },
  { id: 'precursorRuins', name: 'Pole Ruin', danger: 2,
    description: 'Szczątki bram i stacji dawnej cywilizacji.',
    expeditions: [
      { id: 'precursorRuins_scout', type: 'scout', name: 'Wejście w pole ruin', ships: { scout: 1, researchVessel: 1 }, cost: { energy: 10000 }, duration: 1500,
        rewards: { ancientArtifacts: 1 }, discovers: { planets: ['ossuary'], sectors: ['anomalyRift'] } },
      { id: 'precursorRuins_story', type: 'story', name: 'Archiwum Strażników', ships: { researchVessel: 2 }, cost: { energy: 20000, electronics: 2000 }, duration: 2400,
        rewards: { ancientArtifacts: 3, researchData: 200000 }, requires: { tech: ['xenoarchaeology'] },
        story: 'Archiwum zawiera mapę bram łączących dawne kolonie. Jedna z nich wciąż pulsuje energią w Szczelinie Anomalii.' },
      { id: 'precursorRuins_science', type: 'science', name: 'Wykopaliska orbitalne', ships: { researchVessel: 1 }, cost: { energy: 8000 }, duration: 1800,
        rewards: { researchData: 60000 }, repeatable: true, everyN: { count: 2, rewards: { ancientArtifacts: 1 } }, requires: { tech: ['xenoarchaeology'] } },
    ] },
  { id: 'anomalyRift', name: 'Szczelina Anomalii', danger: 4,
    description: 'Zakrzywiona czasoprzestrzeń wokół mikroosobliwości.',
    expeditions: [
      { id: 'anomalyRift_scout', type: 'scout', name: 'Lot w zakrzywieniu', ships: { scout: 3, researchVessel: 1 }, cost: { energy: 50000, fusionCells: 200 }, duration: 3600,
        rewards: { exoticMatter: 1 }, discovers: { planets: ['singularis'] }, requires: { tech: ['warpTheory'] } },
      { id: 'anomalyRift_harvest', type: 'mining', name: 'Zbiór egzotycznej materii', ships: { miner: 3 }, cost: { energy: 30000, fusionCells: 100 }, duration: 2400,
        rewards: { exoticMatter: 0.5, antimatter: 1 }, repeatable: true, requires: { tech: ['warpTheory'] } },
      { id: 'anomalyRift_story', type: 'story', name: 'Brama Strażników', ships: { researchVessel: 3, scout: 2 }, cost: { energy: 200000, exoticMatter: 5 }, duration: 7200,
        rewards: { ancientArtifacts: 10, exoticMatter: 10 }, requires: { tech: ['precursorCodex'] },
        story: 'Brama otworzyła się na ułamek sekundy. Po drugiej stronie widać światła tysięcy stacji — dawna cywilizacja nie zginęła. Odeszła.' },
    ] },
];

export const SECTOR_MAP = Object.fromEntries(SECTORS.map((s) => [s.id, s]));
export const EXPEDITION_MAP = Object.fromEntries(SECTORS.flatMap((s) => s.expeditions.map((e) => [e.id, { ...e, sector: s.id }])));

// Planet survey (analysis) and colonization are generated per planet.
export const SURVEY = { ships: { researchVessel: 1 }, altShips: { scout: 2 }, cost: { energy: 1500 }, duration: 300 };
export const COLONIZE = { ships: { colonyShip: 1 }, duration: 600 };
