// Megastructures: multi-stage, long-term projects built at the Stellar
// Engineering Platform. Their costs include resources that only colonies
// produce in quantity (biomass, chemicals, exotic matter, antimatter), and
// each requires a minimum number of colonies, so they coordinate the empire.
// Effects are granted per completed stage.

const M = (o) => o;

export const MEGASTRUCTURES = [
  M({ id: 'dysonSwarm', name: 'Rój Dysona', icon: 'solar',
    description: 'Miliony kolektorów krążących wokół gwiazdy.',
    requires: { tech: ['megastructureTheory'], colonies: 2 },
    stages: 5, duration: 3600,
    stageCost: { nanomaterials: 200, alloy: 200000, polymers: 50000, machinery: 20000 },
    effectsPerStage: [{ type: 'resourceMult', target: 'energy', value: 1.5 }] }),
  M({ id: 'stellarForge', name: 'Kuźnia Gwiezdna', icon: 'foundry',
    description: 'Hutnictwo w plazmie koronalnej.',
    requires: { tech: ['megastructureTheory'], colonies: 3 },
    stages: 4, duration: 5400,
    stageCost: { nanomaterials: 300, chemicals: 100000, biomass: 50000, fusionCells: 2000 },
    effectsPerStage: [{ type: 'categoryMult', target: 'processing', value: 1.4 }, { type: 'categoryMult', target: 'mining', value: 1.4 }] }),
  M({ id: 'matrioshkaBrain', name: 'Mózg Matrioszka', icon: 'ai',
    description: 'Komputer zasilany całą energią gwiazdy.',
    requires: { tech: ['megastructureTheory', 'quantumCognition'], colonies: 4 },
    stages: 4, duration: 7200,
    stageCost: { quantumCrystals: 500, electronics: 200000, exoticMatter: 5, nanomaterials: 500 },
    effectsPerStage: [{ type: 'researchSpeed', value: 0.5 }, { type: 'resourceMult', target: 'researchData', value: 1.5 }] }),
  M({ id: 'galacticGate', name: 'Brama Galaktyczna', icon: 'galaxy',
    description: 'Odbudowana brama dawnej cywilizacji, łącząca odległe układy.',
    requires: { tech: ['megastructureTheory', 'precursorCodex'], colonies: 6 },
    stages: 3, duration: 10800,
    stageCost: { exoticMatter: 20, antimatter: 50, ancientArtifacts: 10, nanomaterials: 1000 },
    effectsPerStage: [{ type: 'expeditionDuration', value: 0.7 }, { type: 'colonyProduction', value: 1.5 }, { type: 'globalMult', value: 1.25 }] }),
];

export const MEGASTRUCTURE_MAP = Object.fromEntries(MEGASTRUCTURES.map((m) => [m.id, m]));
