// Technology tree. Every tech: id, name, category, tier, cost, requires, effects.
// Research time comes from the tier (TIER_DURATION) divided by research speed.
//
// Effect types (resolved in ModifierSystem; text in ui/effectText.js):
//   buildingMult   { target: buildingId, value }   x outputs of one building
//   categoryMult   { target: categoryId, value }   x outputs of a building category
//   resourceMult   { target: resourceId, value }   x every producer of a resource
//   inputMult      { target: buildingId, value }   x inputs (consumption) of one building
//   capMult        { value }                       x all storage caps
//   resourceCapMult{ target: resourceId, value }   x one storage cap
//   costMult       { value }                       x every building cost
//   researchSpeed  { value }                       + research speed (additive, base 1)
//   clickAdd / clickMult / clickRateShare          see upgrades.js
//   overchargeBoost / overchargeDuration { value } + multiplier / + seconds
//   offlineCapHours{ value }                       + hours of offline progress
//   unlockBuilding { target }                      enables a building (must match building.unlock.tech)
//   feature        { target }                      enables a mechanic: autobuy | autoclick | logistics | autoclaim
//   globalMult     { value }                       x all production
//   unlockShip     { target }                      enables a ship (must match ship.unlock.tech)
//   unlockColonization { target }                 enables colonizing a planet (planet.requires.tech)
//   shipSpeed / shipCargo / shipAttack / shipShields / shipArmor { value }  x fleet stats
//   fuelMult       { value }                       x fuel cost of routes and expeditions
//   expeditionDuration / terraformDuration { value } x durations
//   colonyProduction / colonyStorage { value }     x colony output / storage
//   colonySlots    { value }                       + building slots in every colony
//   repairCost     { value }                       x fleet repair cost

export const TECH_CATEGORIES = {
  energy: 'Energetyka',
  automation: 'Automatyzacja',
  metallurgy: 'Metalurgia',
  electronics: 'Elektronika',
  ai: 'Sztuczna inteligencja',
  propulsion: 'Napędy',
  colonization: 'Kolonizacja',
  logistics: 'Logistyka',
  quantum: 'Fizyka kwantowa',
  terraforming: 'Terraformowanie',
  stellar: 'Inżynieria gwiezdna',
  alien: 'Technologie obcych',
};

// Base research time in seconds per tier.
export const TIER_DURATION = { 1: 20, 2: 90, 3: 600, 4: 1800, 5: 3600 };

// Research Data costs below are written as base values and scaled by tier, so
// late tiers keep pace with late-game data production (tuned with
// tools/fullrun.mjs; see docs/ECONOMY_BALANCE.md). Other resource costs are unscaled.
export const TIER_COST_SCALE = { 1: 1, 2: 1, 3: 5, 4: 15, 5: 30 };

const T = (id, name, category, tier, cost, requires, effects, description) => ({
  id, name, category, tier,
  cost: cost.researchData ? { ...cost, researchData: cost.researchData * TIER_COST_SCALE[tier] } : cost,
  requires, effects, description,
});
const RD = (n, extra = {}) => ({ researchData: n, ...extra });

export const TECHNOLOGIES = [
  // Energy -----------------------------------------------------------------
  T('solarEfficiency', 'Wydajne ogniwa', 'energy', 1, RD(40), [],
    [{ type: 'buildingMult', target: 'solarArray', value: 1.5 }],
    'Odzyskane schematy paneli o wyższej sprawności.'),
  T('kineticCapture', 'Przechwyt kinetyczny', 'energy', 1, RD(60), [],
    [{ type: 'clickMult', value: 2 }],
    'Cewki reaktora przechwytują energię impulsów sterujących.'),
  T('powerGrid', 'Sieć energetyczna', 'energy', 1, RD(150), ['solarEfficiency'],
    [{ type: 'resourceMult', target: 'energy', value: 1.25 }],
    'Wspólna magistrala zasilania eliminuje straty przesyłu.'),
  T('coreResonance', 'Rezonans rdzenia', 'energy', 2, RD(700), ['kineticCapture'],
    [{ type: 'overchargeDuration', value: 10 }],
    'Przeciążenie reaktora trwa dłużej.'),
  T('resonanceFeedback', 'Sprzężenie rezonansowe', 'energy', 2, RD(1500), ['coreResonance'],
    [{ type: 'clickRateShare', value: 1 }],
    'Każdy impuls ręczny wzmacnia przepływ całej sieci.'),
  T('fusionTheory', 'Teoria fuzji', 'energy', 2, RD(1500, { alloy: 100 }), ['powerGrid', 'alloyTheory'],
    [{ type: 'unlockBuilding', target: 'fusionReactor' }],
    'Kontrolowana synteza deuteru z wody.'),
  T('plasmaContainment', 'Pułapka plazmowa', 'energy', 2, RD(3000), ['fusionTheory'],
    [{ type: 'buildingMult', target: 'fusionReactor', value: 1.5 }],
    'Stabilniejsze pole magnetyczne komory reakcyjnej.'),
  T('superconductors', 'Nadprzewodniki', 'energy', 3, RD(15000, { electronics: 200 }), ['plasmaContainment', 'microcircuits'],
    [{ type: 'resourceMult', target: 'energy', value: 1.5 }],
    'Przewody bez oporu w temperaturze pokojowej.'),
  T('coldFusion', 'Zimna fuzja', 'energy', 3, RD(40000), ['superconductors'],
    [{ type: 'inputMult', target: 'fusionReactor', value: 0.5 }],
    'Reaktory fuzyjne zużywają o połowę mniej wody.'),
  T('fusionCells', 'Ogniwa fuzyjne', 'energy', 3, RD(30000, { machinery: 100 }), ['fusionTheory', 'heavyAlloys', 'machineWorks'],
    [{ type: 'unlockBuilding', target: 'fusionCellPlant' }],
    'Skondensowane paliwo dla przyszłych napędów.'),

  // Automation -------------------------------------------------------------
  T('basicAutomation', 'Podstawy automatyzacji', 'automation', 1, RD(100), [],
    [{ type: 'categoryMult', target: 'mining', value: 1.25 }],
    'Sterowniki pozwalają instalacjom wydobywczym pracować bez nadzoru.'),
  T('assemblyLines', 'Linie montażowe', 'automation', 2, RD(1200), ['basicAutomation'],
    [{ type: 'costMult', value: 0.9 }],
    'Standaryzacja modułów obniża koszt każdej budowy.'),
  T('dormantProtocols', 'Protokoły uśpienia', 'automation', 2, RD(2500), ['assemblyLines'],
    [{ type: 'offlineCapHours', value: 4 }],
    'Stacja pracuje dłużej pod nieobecność dowódcy.'),
  T('autoBuilders', 'Autonomiczni budowniczowie', 'automation', 2, RD(4000, { electronics: 50 }), ['assemblyLines', 'microcircuits'],
    [{ type: 'feature', target: 'autobuy' }],
    'Drony same rozbudowują wskazane instalacje, gdy są tanie.'),
  T('roboticWorkforce', 'Robotyczna siła robocza', 'automation', 3, RD(20000), ['autoBuilders'],
    [{ type: 'categoryMult', target: 'processing', value: 1.5 }],
    'Zakłady przetwórcze pracują na trzy zmiany.'),
  T('autoIgnition', 'Automatyczny zapłon', 'automation', 3, RD(25000), ['autoBuilders', 'resonanceFeedback'],
    [{ type: 'feature', target: 'autoclick' }],
    'Układ sterujący sam pobudza reaktor dwa razy na sekundę.'),
  T('selfReplication', 'Samoreplikacja', 'automation', 4, RD(300000, { machinery: 500 }), ['roboticWorkforce', 'neuralNetworks'],
    [{ type: 'costMult', value: 0.8 }],
    'Maszyny budują maszyny.'),

  // Metallurgy -------------------------------------------------------------
  T('oreAnalysis', 'Analiza rud', 'metallurgy', 1, RD(50), [],
    [{ type: 'buildingMult', target: 'asteroidMine', value: 1.5 }],
    'Spektrometria pozwala celować w najbogatsze skały.'),
  T('cryoDrills', 'Wiertła kriogeniczne', 'metallurgy', 1, RD(250), ['oreAnalysis'],
    [{ type: 'buildingMult', target: 'iceExtractor', value: 1.5 }],
    'Lód kometarny wydobywany bez topienia.'),
  T('alloyTheory', 'Teoria stopów', 'metallurgy', 1, RD(200), ['oreAnalysis'],
    [{ type: 'buildingMult', target: 'alloyFoundry', value: 1.25 }],
    'Lepsze proporcje składników stopu.'),
  T('deepCoreSurvey', 'Sondowanie rdzeni', 'metallurgy', 2, RD(900), ['oreAnalysis'],
    [{ type: 'buildingMult', target: 'deepCoreDrill', value: 1.5 }],
    'Mapy gęstości wskazują żyły krzemu.'),
  T('refining', 'Rafinacja', 'metallurgy', 2, RD(900), ['alloyTheory'],
    [{ type: 'unlockBuilding', target: 'metalRefinery' }],
    'Rafinerie zwiększają uzysk metalu z każdej tony rudy.'),
  T('heavyAlloys', 'Stopy ciężkie', 'metallurgy', 2, RD(2000), ['refining'],
    [{ type: 'buildingMult', target: 'alloyFoundry', value: 1.5 }, { type: 'resourceCapMult', target: 'alloy', value: 2 }],
    'Gęstsze stopy, łatwiejsze w składowaniu.'),
  T('machineWorks', 'Inżynieria maszyn', 'metallurgy', 2, RD(3000, { electronics: 40 }), ['heavyAlloys', 'microcircuits'],
    [{ type: 'unlockBuilding', target: 'machineWorks' }],
    'Ciężkie podzespoły dla stoczni i kolonii.'),
  T('gasHarvesting', 'Pozyskiwanie gazów', 'metallurgy', 3, RD(20000), ['deepCoreSurvey', 'fusionTheory'],
    [{ type: 'unlockBuilding', target: 'gasHarvester' }],
    'Zbieranie lotnych związków z ogonów komet.'),
  T('metamaterials', 'Metamateriały', 'metallurgy', 3, RD(25000), ['machineWorks', 'polymerScience'],
    [{ type: 'buildingMult', target: 'machineWorks', value: 1.5 }, { type: 'buildingMult', target: 'constructionYard', value: 1.5 }],
    'Struktury o właściwościach niespotykanych w naturze.'),
  T('nanoMetallurgy', 'Nanometalurgia', 'metallurgy', 4, RD(400000, { quantumCrystals: 20 }), ['metamaterials', 'crystalGrowth'],
    [{ type: 'unlockBuilding', target: 'nanofabricator' }],
    'Składanie materii atom po atomie.'),

  // Electronics ------------------------------------------------------------
  T('microcircuits', 'Mikroukłady', 'electronics', 1, RD(300), ['alloyTheory'],
    [{ type: 'buildingMult', target: 'electronicsFactory', value: 1.25 }],
    'Gęstsze upakowanie układów scalonych.'),
  T('industrialChemistry', 'Chemia przemysłowa', 'electronics', 2, RD(800), ['alloyTheory', 'cryoDrills'],
    [{ type: 'unlockBuilding', target: 'chemicalPlant' }],
    'Synteza reagentów z wody i krzemu.'),
  T('polymerScience', 'Nauka o polimerach', 'electronics', 2, RD(1800), ['industrialChemistry', 'hydroponics'],
    [{ type: 'unlockBuilding', target: 'polymerPlant' }],
    'Lekkie tworzywa z chemikaliów i biomasy.'),
  T('advancedCircuits', 'Zaawansowane obwody', 'electronics', 2, RD(2500), ['microcircuits'],
    [{ type: 'resourceMult', target: 'electronics', value: 1.5 }],
    'Wielowarstwowe płytki i lepsze testy jakości.'),
  T('prefabrication', 'Prefabrykacja', 'electronics', 3, RD(12000), ['polymerScience', 'heavyAlloys'],
    [{ type: 'unlockBuilding', target: 'constructionYard' }],
    'Gotowe moduły konstrukcyjne dla przyszłych kolonii.'),
  T('photonics', 'Fotonika', 'electronics', 3, RD(30000), ['advancedCircuits', 'superconductors'],
    [{ type: 'inputMult', target: 'electronicsFactory', value: 0.7 }],
    'Układy optyczne zużywają mniej surowców.'),

  // AI ---------------------------------------------------------------------
  T('dataMining', 'Eksploracja danych', 'ai', 1, RD(150), [],
    [{ type: 'buildingMult', target: 'researchLab', value: 1.5 }],
    'Algorytmy wyłuskują wiedzę z uszkodzonych archiwów.'),
  T('expertSystems', 'Systemy eksperckie', 'ai', 2, RD(1500), ['dataMining', 'microcircuits'],
    [{ type: 'researchSpeed', value: 0.25 }],
    'Asystenci badawczy planują eksperymenty.'),
  T('commNetwork', 'Sieć komunikacyjna', 'ai', 2, RD(2000), ['dataMining'],
    [{ type: 'unlockBuilding', target: 'communicationArray' }],
    'Anteny wymieniają dane z czujnikami w całym systemie.'),
  T('neuralNetworks', 'Sieci neuronowe', 'ai', 3, RD(15000), ['expertSystems', 'advancedCircuits'],
    [{ type: 'unlockBuilding', target: 'aiResearchCenter' }],
    'Odtworzenie architektury dawnych umysłów syntetycznych.'),
  T('predictiveLogistics', 'Logistyka predykcyjna', 'ai', 3, RD(25000), ['neuralNetworks'],
    [{ type: 'capMult', value: 1.5 }],
    'SI przewiduje przepływy i optymalizuje składowanie.'),
  T('overseerAI', 'Nadzorca SI', 'ai', 3, RD(30000), ['neuralNetworks', 'dormantProtocols'],
    [{ type: 'offlineCapHours', value: 4 }],
    'SI prowadzi stację pod nieobecność dowódcy.'),
  T('quantumCognition', 'Poznanie kwantowe', 'ai', 4, RD(500000), ['neuralNetworks', 'entanglement'],
    [{ type: 'researchSpeed', value: 0.5 }, { type: 'buildingMult', target: 'aiResearchCenter', value: 2 }],
    'Myślenie w superpozycji stanów.'),

  // Logistics (station scope) ---------------------------------------------
  T('storageCompression', 'Kompresja ładunku', 'logistics', 1, RD(200), [],
    [{ type: 'capMult', value: 1.5 }],
    'Gęstsze upakowanie ładowni.'),
  T('modularStorage', 'Magazyny modułowe', 'logistics', 2, RD(2000), ['storageCompression'],
    [{ type: 'capMult', value: 1.5 }],
    'Rozbudowa ładowni w standardzie kontenerowym.'),

  // Colonization (station scope) -------------------------------------------
  T('hydroponics', 'Hydroponika', 'colonization', 1, RD(250), ['cryoDrills'],
    [{ type: 'unlockBuilding', target: 'hydroponicsBay' }],
    'Uprawy bez gleby — pierwszy krok do samowystarczalnych kolonii.'),

  // Quantum ----------------------------------------------------------------
  T('quantumTheory', 'Teoria kwantowa', 'quantum', 3, RD(50000), ['superconductors', 'neuralNetworks'],
    [{ type: 'unlockBuilding', target: 'quantumLaboratory' }],
    'Laboratoria badające splątane układy.'),
  T('entanglement', 'Splątanie', 'quantum', 4, RD(250000), ['quantumTheory'],
    [{ type: 'unlockBuilding', target: 'quantumRelay' }],
    'Natychmiastowa synchronizacja instalacji stacji.'),
  T('crystalGrowth', 'Hodowla kryształów', 'quantum', 4, RD(400000, { chemicals: 500 }), ['entanglement', 'industrialChemistry'],
    [{ type: 'unlockBuilding', target: 'crystalVat' }],
    'Kryształy o splątanej sieci krystalicznej.'),
  T('unifiedField', 'Teoria pola zunifikowanego', 'quantum', 5, RD(5e6, { quantumCrystals: 100 }), ['crystalGrowth', 'quantumCognition'],
    [{ type: 'globalMult', value: 1.5 }],
    'Jedno równanie opisujące wszystkie siły.'),

  // Propulsion -------------------------------------------------------------
  T('spaceflight', 'Loty międzyplanetarne', 'propulsion', 2, RD(3000, { alloy: 300, electronics: 100 }), ['fusionTheory', 'assemblyLines'],
    [{ type: 'unlockBuilding', target: 'shipyard' }, { type: 'unlockShip', target: 'scout' }, { type: 'unlockShip', target: 'miner' }],
    'Odbudowa stoczni i pierwszych napędów jonowych.'),
  T('deepSpaceSensors', 'Czujniki głębokiego kosmosu', 'propulsion', 2, RD(5000, { electronics: 200 }), ['spaceflight'],
    [{ type: 'unlockShip', target: 'researchVessel' }],
    'Odczyty składu planet z odległości milionów kilometrów.'),
  T('ionDrives', 'Napęd jonowy', 'propulsion', 2, RD(6000), ['spaceflight'],
    [{ type: 'shipSpeed', value: 1.25 }],
    'Wszystkie statki latają o 25% szybciej.'),
  T('fusionDrives', 'Napęd fuzyjny', 'propulsion', 3, RD(40000, { fusionCells: 50 }), ['ionDrives', 'fusionCells'],
    [{ type: 'shipSpeed', value: 1.5 }],
    'Ciąg wielokrotnie większy od jonowego.'),
  T('galacticCartography', 'Kartografia galaktyczna', 'propulsion', 3, RD(30000), ['deepSpaceSensors'],
    [{ type: 'expeditionDuration', value: 0.75 }],
    'Ekspedycje trwają o 25% krócej.'),
  T('warpTheory', 'Teoria napędu warp', 'propulsion', 4, RD(800000, { quantumCrystals: 20 }), ['fusionDrives', 'entanglement'],
    [{ type: 'shipSpeed', value: 2 }],
    'Zakrzywianie przestrzeni otwiera drogę do Szczeliny Anomalii.'),

  // Colonization -----------------------------------------------------------
  T('colonyShips', 'Statki kolonizacyjne', 'colonization', 3, RD(15000, { constructionMaterials: 100 }), ['spaceflight', 'prefabrication', 'hydroponics'],
    [{ type: 'unlockShip', target: 'colonyShip' }],
    'Samowystarczalne moduły zdolne założyć placówkę.'),
  T('colonyAdministration', 'Administracja kolonialna', 'colonization', 3, RD(30000), ['colonyShips'],
    [{ type: 'colonyProduction', value: 1.25 }],
    'Produkcja wszystkich kolonii +25%.'),
  T('planetaryStorage', 'Magazyny planetarne', 'colonization', 3, RD(25000), ['colonyShips'],
    [{ type: 'colonyStorage', value: 2 }],
    'Magazyny kolonii x2.'),
  T('habitatModules', 'Moduły habitatowe', 'colonization', 3, RD(45000, { polymers: 500 }), ['colonyAdministration'],
    [{ type: 'colonySlots', value: 4 }],
    'Każda kolonia zyskuje 4 sloty budowlane.'),
  T('thermalShielding', 'Osłony termiczne', 'colonization', 3, RD(35000, { alloy: 2000 }), ['colonyShips', 'heavyAlloys'],
    [{ type: 'unlockColonization', target: 'vulcan' }],
    'Habitaty wytrzymujące temperaturę lawy.'),
  T('floatingHabitats', 'Pływające habitaty', 'colonization', 3, RD(50000, { polymers: 1000 }), ['colonyShips', 'polymerScience'],
    [{ type: 'unlockColonization', target: 'aurelion' }],
    'Kolonie unoszące się w atmosferze gazowych olbrzymów.'),
  T('environmentalSuits', 'Kombinezony środowiskowe', 'colonization', 3, RD(60000, { polymers: 1500 }), ['colonyShips', 'industrialChemistry'],
    [{ type: 'unlockColonization', target: 'miasma' }],
    'Ochrona przed toksyczną atmosferą.'),
  T('autonomousColonies', 'Autonomiczne kolonie', 'colonization', 4, RD(400000), ['habitatModules', 'neuralNetworks'],
    [{ type: 'colonyProduction', value: 1.5 }],
    'SI zarządza koloniami; produkcja kolonii +50%.'),

  // Logistics --------------------------------------------------------------
  T('interplanetaryLogistics', 'Logistyka międzyplanetarna', 'logistics', 3, RD(20000), ['colonyShips'],
    [{ type: 'unlockShip', target: 'transporter' }, { type: 'feature', target: 'logistics' }],
    'Stałe trasy transportowe między stacją a koloniami.'),
  T('cargoExpansion', 'Rozszerzone ładownie', 'logistics', 3, RD(40000), ['interplanetaryLogistics'],
    [{ type: 'shipCargo', value: 1.5 }],
    'Ładowność wszystkich statków +50%.'),
  T('routeOptimization', 'Optymalizacja tras', 'logistics', 3, RD(50000), ['interplanetaryLogistics', 'predictiveLogistics'],
    [{ type: 'fuelMult', value: 0.5 }],
    'Paliwo na trasy i ekspedycje -50%.'),
  T('orbitalElevators', 'Windy orbitalne', 'logistics', 4, RD(300000, { nanomaterials: 20 }), ['routeOptimization', 'metamaterials'],
    [{ type: 'unlockBuilding', target: 'orbitalElevator' }],
    'Tani transport z powierzchni na orbitę.'),
  T('expeditionAutomation', 'Automatyzacja ekspedycji', 'logistics', 3, RD(60000), ['interplanetaryLogistics', 'autoBuilders'],
    [{ type: 'feature', target: 'autoclaim' }],
    'Wyniki ekspedycji są odbierane automatycznie, a powtarzalne ekspedycje mogą się wznawiać.'),
  T('tradeNetworks', 'Sieci handlowe', 'logistics', 3, RD(45000), ['interplanetaryLogistics'],
    [{ type: 'resourceMult', target: 'credits', value: 1.5 }],
    'Kredyty +50%.'),

  // Fleet / defense ----------------------------------------------------------
  T('defenseSystems', 'Systemy obronne', 'propulsion', 2, RD(8000, { alloy: 500 }), ['spaceflight'],
    [{ type: 'unlockShip', target: 'escort' }, { type: 'unlockBuilding', target: 'orbitalDock' }],
    'Uzbrojenie dla eskort i dok naprawczy.'),
  T('warships', 'Okręty liniowe', 'propulsion', 3, RD(40000, { machinery: 300 }), ['defenseSystems', 'machineWorks'],
    [{ type: 'unlockShip', target: 'frigate' }],
    'Fregaty z pełnym pancerzem.'),
  T('weaponsResearch', 'Badania nad uzbrojeniem', 'propulsion', 3, RD(50000), ['warships'],
    [{ type: 'shipAttack', value: 1.25 }],
    'Siła ognia floty +25%.'),
  T('deflectorShields', 'Deflektory', 'propulsion', 3, RD(70000, { electronics: 3000 }), ['warships', 'superconductors'],
    [{ type: 'shipShields', value: 1.5 }, { type: 'unlockBuilding', target: 'shieldGenerator' }],
    'Osłony floty +50%, generatory osłon.'),
  T('repairDrones', 'Drony naprawcze', 'automation', 3, RD(40000), ['defenseSystems', 'autoBuilders'],
    [{ type: 'repairCost', value: 0.5 }],
    'Naprawy floty kosztują o połowę mniej.'),
  T('heavyWarships', 'Ciężkie okręty', 'propulsion', 4, RD(500000, { fusionCells: 200 }), ['weaponsResearch', 'deflectorShields', 'fusionDrives'],
    [{ type: 'unlockShip', target: 'cruiser' }],
    'Krążowniki zdolne do walki z cytadelami.'),

  // Terraforming -----------------------------------------------------------
  T('atmosphericProcessing', 'Przetwarzanie atmosfery', 'terraforming', 4, RD(300000, { nanomaterials: 20 }), ['colonyAdministration', 'nanoMetallurgy'],
    [{ type: 'unlockShip', target: 'terraformer' }, { type: 'unlockBuilding', target: 'terraformingFacility' }],
    'Pierwszy krok do przekształcania planet.'),
  T('ecosystemDesign', 'Projektowanie ekosystemów', 'terraforming', 4, RD(600000), ['atmosphericProcessing'],
    [{ type: 'terraformDuration', value: 0.5 }],
    'Etapy terraformowania trwają o połowę krócej.'),

  // Stellar ----------------------------------------------------------------
  T('stellarCollection', 'Kolektory gwiezdne', 'stellar', 4, RD(500000, { nanomaterials: 30 }), ['superconductors', 'orbitalElevators'],
    [{ type: 'unlockBuilding', target: 'stellarCollector' }],
    'Zbieranie energii bezpośrednio z korony gwiazdy.'),
  T('antimatterContainment', 'Pułapki antymaterii', 'stellar', 4, RD(1e6, { antimatter: 5 }), ['stellarCollection', 'anomalyStabilization'],
    [{ type: 'unlockBuilding', target: 'antimatterReactor' }],
    'Bezpieczne przechowywanie antymaterii.'),
  T('megastructureTheory', 'Teoria megastruktur', 'stellar', 5, RD(3e6, { nanomaterials: 200 }), ['stellarCollection', 'selfReplication'],
    [{ type: 'unlockBuilding', target: 'stellarEngineeringPlatform' }],
    'Budowle w skali układu planetarnego.'),

  // Alien ------------------------------------------------------------------
  T('xenoarchaeology', 'Ksenoarcheologia', 'alien', 3, RD(50000, { ancientArtifacts: 1 }), ['deepSpaceSensors'],
    [{ type: 'unlockBuilding', target: 'xenologyInstitute' }, { type: 'unlockColonization', target: 'ossuary' }],
    'Nauka o dawnej cywilizacji. Pozwala kolonizować Ossuarium.'),
  T('artifactAnalysis', 'Analiza artefaktów', 'alien', 4, RD(200000, { ancientArtifacts: 3 }), ['xenoarchaeology'],
    [{ type: 'researchSpeed', value: 0.5 }],
    'Artefakty ujawniają skróty w badaniach. Szybkość badań +50%.'),
  T('anomalyStabilization', 'Stabilizacja anomalii', 'alien', 4, RD(600000, { ancientArtifacts: 5, exoticMatter: 1 }), ['artifactAnalysis', 'warpTheory'],
    [{ type: 'unlockColonization', target: 'singularis' }],
    'Pozwala założyć kolonię na Singularis.'),
  // Rebirth branch: available only after a Galactic Rebirth.
  { ...T('echoesOfRebirth', 'Echa odrodzenia', 'quantum', 2, RD(5000), ['dataMining'],
    [{ type: 'researchSpeed', value: 0.25 }, { type: 'globalAdd', value: 0.1 }],
    'Wspomnienia poprzedniego cyklu prowadzą badania na skróty.'), condition: { rebirths: 1 } },
  { ...T('temporalEngineering', 'Inżynieria czasu', 'quantum', 4, RD(400000), ['echoesOfRebirth', 'entanglement'],
    [{ type: 'globalMult', value: 1.25 }, { type: 'offlineCapHours', value: 4 }],
    'Kontrola nad upływem czasu w zamkniętych układach.'), condition: { rebirths: 2 } },

  T('precursorCodex', 'Kodeks Strażników', 'alien', 5, RD(4e6, { ancientArtifacts: 10 }), ['anomalyStabilization'],
    [{ type: 'globalMult', value: 1.5 }],
    'Pełne odczytanie archiwum dawnej cywilizacji.'),
];

export const TECH_MAP = Object.fromEntries(TECHNOLOGIES.map((t) => [t.id, t]));
