// Resource definitions. Logic refers to resources only through these ids.
// `cap: null` means the resource has no storage limit.
// `unlocked: true` makes the resource visible from the start; others become
// visible the first time any amount is gained (see ResourceSystem.add).

export const RESOURCE_CATEGORIES = {
  basic: 'Podstawowe',
  industrial: 'Przemysłowe',
  advanced: 'Zaawansowane',
  special: 'Specjalne',
};

export const RESOURCES = [
  { id: 'energy', name: 'Energia', icon: 'energy', category: 'basic', cap: 500, start: 50, unlocked: true,
    description: 'Zasila każdą instalację stacji.',
    sources: 'Reaktor orbitalny (kliknięcia), panele słoneczne, rdzeń stacji.',
    uses: 'Zużywana przez kopalnie, laboratoria i fabryki.' },
  { id: 'metal', name: 'Metal', icon: 'metal', category: 'basic', cap: 500, start: 20, unlocked: true,
    description: 'Surowa ruda z pasa asteroid.',
    sources: 'Kopalnie asteroid, drony odzyskujące złom z wraku stacji.',
    uses: 'Budowa niemal wszystkiego, przetop na stopy.' },
  { id: 'silicon', name: 'Krzem', icon: 'silicon', category: 'basic', cap: 300, start: 10, unlocked: true,
    description: 'Półprzewodnik niezbędny do elektroniki.',
    sources: 'Odwierty głębinowe.',
    uses: 'Laboratoria, elektronika, magazyny.' },
  { id: 'water', name: 'Woda', icon: 'water', category: 'basic', cap: 300, start: 0,
    description: 'Lód z komet i księżyców, przetapiany na wodę.',
    sources: 'Ekstraktory lodu.',
    uses: 'Chłodzenie fabryk elektroniki, przyszłe kolonie.' },
  { id: 'biomass', name: 'Biomasa', icon: 'biomass', category: 'basic', cap: 300, start: 0,
    description: 'Organiczna masa z hydroponiki i kolonii.',
    sources: 'Kolonie (kolejne etapy).',
    uses: 'Polimery, utrzymanie kolonii.' },

  { id: 'alloy', name: 'Stop metali', icon: 'alloy', category: 'industrial', cap: 200, start: 0,
    description: 'Wytrzymały stop konstrukcyjny.',
    sources: 'Odlewnie stopów.',
    uses: 'Zaawansowane budynki i ulepszenia.' },
  { id: 'electronics', name: 'Elektronika', icon: 'electronics', category: 'industrial', cap: 150, start: 0,
    description: 'Układy sterujące i czujniki.',
    sources: 'Fabryki elektroniki.',
    uses: 'Automatyzacja, laboratoria, statki.' },
  { id: 'polymers', name: 'Polimery', icon: 'polymers', category: 'industrial', cap: 200, start: 0,
    description: 'Lekkie tworzywa syntetyczne.', sources: 'Zakłady chemiczne (kolejne etapy).', uses: 'Moduły habitatów.' },
  { id: 'machinery', name: 'Maszyny', icon: 'machinery', category: 'industrial', cap: 150, start: 0,
    description: 'Ciężkie podzespoły mechaniczne.', sources: 'Kolejne etapy.', uses: 'Stocznie, megastruktury.' },
  { id: 'chemicals', name: 'Związki chemiczne', icon: 'chemicals', category: 'industrial', cap: 200, start: 0,
    description: 'Reagenty przemysłowe.', sources: 'Kolejne etapy.', uses: 'Polimery, paliwo.' },
  { id: 'constructionMaterials', name: 'Materiały konstrukcyjne', icon: 'construction', category: 'industrial', cap: 200, start: 0,
    description: 'Prefabrykaty do budowy kolonii.', sources: 'Kolejne etapy.', uses: 'Infrastruktura kolonii.' },

  { id: 'fusionCells', name: 'Ogniwa fuzyjne', icon: 'fusion', category: 'advanced', cap: 100, start: 0,
    description: 'Skondensowane paliwo fuzyjne.', sources: 'Kolejne etapy.', uses: 'Napędy, reaktory.' },
  { id: 'nanomaterials', name: 'Nanomateriały', icon: 'nano', category: 'advanced', cap: 100, start: 0,
    description: 'Struktury samoorganizujące się.', sources: 'Kolejne etapy.', uses: 'Zaawansowane technologie.' },
  { id: 'antimatter', name: 'Antymateria', icon: 'antimatter', category: 'advanced', cap: 50, start: 0,
    description: 'Najgęstsze źródło energii.', sources: 'Kolejne etapy.', uses: 'Reaktory antymaterii.' },
  { id: 'quantumCrystals', name: 'Kryształy kwantowe', icon: 'crystal', category: 'advanced', cap: 50, start: 0,
    description: 'Kryształy o splątanej sieci.', sources: 'Kolejne etapy.', uses: 'Przekaźniki kwantowe.' },
  { id: 'exoticMatter', name: 'Egzotyczna materia', icon: 'exotic', category: 'advanced', cap: 25, start: 0,
    description: 'Materia o ujemnej gęstości energii.', sources: 'Kolejne etapy.', uses: 'Megastruktury.' },

  { id: 'researchData', name: 'Dane badawcze', icon: 'research', category: 'special', cap: null, start: 0,
    description: 'Wyniki pomiarów i symulacji.',
    sources: 'Laboratoria badawcze.',
    uses: 'Drzewko technologiczne (kolejny etap).' },
  { id: 'ancientArtifacts', name: 'Artefakty', icon: 'artifact', category: 'special', cap: null, start: 0,
    description: 'Pozostałości dawnej cywilizacji.', sources: 'Ekspedycje.', uses: 'Technologie obcych.' },
  { id: 'credits', name: 'Kredyty', icon: 'credits', category: 'special', cap: null, start: 0,
    description: 'Waluta handlowa.', sources: 'Kolejne etapy.', uses: 'Handel.' },
  { id: 'prestigePoints', name: 'Punkty prestiżu', icon: 'prestige', category: 'special', cap: null, start: 0,
    description: 'Trwała waluta Galactic Rebirth.', sources: 'Prestiż.', uses: 'Trwałe ulepszenia.' },
];

export const RESOURCE_MAP = Object.fromEntries(RESOURCES.map((r) => [r.id, r]));
export const RESOURCE_IDS = RESOURCES.map((r) => r.id);

// Passive production of the damaged station core, independent of buildings.
// The metal trickle (salvage drones stripping the old wreck) guarantees the
// player can never soft-lock by spending all starting metal on non-miners.
export const BASE_PRODUCTION = { energy: 1, metal: 0.2 };
