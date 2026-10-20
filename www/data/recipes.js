// Production recipes. A recipe describes one batch of one building level:
// `inputs` are consumed and `outputs` produced every `duration` seconds.
// The simulation treats batches as a continuous flow (amount / duration per
// second), which keeps offline and online production identical and lets us
// aggregate many building levels into a single rate.

export const RECIPES = {
  solarPower:          { inputs: {}, outputs: { energy: 2 }, duration: 1, batch: 1 },
  asteroidMining:      { inputs: { energy: 0.4 }, outputs: { metal: 1 }, duration: 2, batch: 1 },
  siliconDrilling:     { inputs: { energy: 0.6 }, outputs: { silicon: 0.6 }, duration: 2, batch: 1 },
  iceExtraction:       { inputs: { energy: 0.8 }, outputs: { water: 1 }, duration: 2, batch: 1 },
  basicResearch:       { inputs: { energy: 2 }, outputs: { researchData: 1 }, duration: 4, batch: 1 },
  alloySmelting:       { inputs: { metal: 4, energy: 2 }, outputs: { alloy: 1.5 }, duration: 4, batch: 1 },
  electronicsAssembly: { inputs: { silicon: 3, metal: 1.5, water: 1, energy: 4 }, outputs: { electronics: 1 }, duration: 5, batch: 1 },
  deuteriumFusion:     { inputs: { water: 2 }, outputs: { energy: 30 }, duration: 2, batch: 1 },
  chemicalSynthesis:   { inputs: { water: 2, silicon: 1, energy: 3 }, outputs: { chemicals: 1 }, duration: 4, batch: 1 },
  gasCollection:       { inputs: { energy: 4 }, outputs: { chemicals: 1.2 }, duration: 4, batch: 1 },
  hydroponicGrowth:    { inputs: { water: 1, energy: 1 }, outputs: { biomass: 1 }, duration: 2, batch: 1 },
  polymerization:      { inputs: { chemicals: 2, biomass: 2, energy: 2 }, outputs: { polymers: 1.5 }, duration: 5, batch: 1 },
  machineAssembly:     { inputs: { electronics: 1, alloy: 2, energy: 4 }, outputs: { machinery: 1 }, duration: 6, batch: 1 },
  prefabrication:      { inputs: { alloy: 2, polymers: 1, metal: 4 }, outputs: { constructionMaterials: 2 }, duration: 6, batch: 1 },
  neuralResearch:      { inputs: { electronics: 0.5, energy: 8 }, outputs: { researchData: 4 }, duration: 2, batch: 1 },
  quantumResearch:     { inputs: { electronics: 2, machinery: 0.5, energy: 40 }, outputs: { researchData: 60 }, duration: 3, batch: 1 },
  crystalGrowth:       { inputs: { chemicals: 3, electronics: 1, energy: 50 }, outputs: { quantumCrystals: 0.5 }, duration: 10, batch: 1 },
  fusionCellPacking:   { inputs: { water: 3, machinery: 0.5, energy: 10 }, outputs: { fusionCells: 0.5 }, duration: 5, batch: 1 },
  nanoAssembly:        { inputs: { alloy: 3, electronics: 1, quantumCrystals: 0.05, energy: 60 }, outputs: { nanomaterials: 0.3 }, duration: 6, batch: 1 },
  xenologyResearch:    { inputs: { energy: 30 }, outputs: { researchData: 40 }, duration: 2, batch: 1 },
  stellarHarvest:      { inputs: {}, outputs: { energy: 2000 }, duration: 1, batch: 1 },
  annihilation:        { inputs: { antimatter: 0.01 }, outputs: { energy: 20000 }, duration: 1, batch: 1 },
};

// Per-second flow of one building level running at full efficiency.
export function recipeRates(recipe) {
  const perSec = (map) => Object.fromEntries(
    Object.entries(map).map(([id, amt]) => [id, (amt * recipe.batch) / recipe.duration]),
  );
  return { inputs: perSec(recipe.inputs), outputs: perSec(recipe.outputs) };
}
