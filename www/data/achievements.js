// Achievements unlock automatically and permanently. Each grants
// ACHIEVEMENT_BONUS to all production (additive with other achievements).
export const ACHIEVEMENT_BONUS = 0.02;

const A = (id, name, description, goal, icon = 'artifact') => ({ id, name, description, goal, icon });

export const ACHIEVEMENTS = [
  A('clicks100', 'Pewna ręka', 'Dotknij reaktora 100 razy.', { clicks: 100 }, 'click'),
  A('clicks1000', 'Niestrudzony operator', 'Dotknij reaktora 1000 razy.', { clicks: 1000 }, 'click'),
  A('clicks10000', 'Legenda mostka', 'Dotknij reaktora 10 000 razy.', { clicks: 10000 }, 'click'),
  A('mines10', 'Górnik pasa', 'Rozbuduj kopalnię asteroid do poziomu 10.', { buildings: { asteroidMine: 10 } }, 'mine'),
  A('mines50', 'Pożeracz asteroid', 'Rozbuduj kopalnię asteroid do poziomu 50.', { buildings: { asteroidMine: 50 } }, 'mine'),
  A('solar25', 'Morze paneli', 'Rozbuduj panele słoneczne do poziomu 25.', { buildings: { solarArray: 25 } }, 'solar'),
  A('levels100', 'Stocznia przemysłu', 'Osiągnij łącznie 100 poziomów budynków.', { totalBuildingLevels: 100 }, 'production'),
  A('levels500', 'Kombinat orbitalny', 'Osiągnij łącznie 500 poziomów budynków.', { totalBuildingLevels: 500 }, 'production'),
  A('metal1e4', 'Pierwsze tony', 'Wydobądź łącznie 10 tys. metalu.', { resourcesEarned: { metal: 1e4 } }, 'metal'),
  A('metal1e6', 'Góra metalu', 'Wydobądź łącznie milion metalu.', { resourcesEarned: { metal: 1e6 } }, 'metal'),
  A('energy1e6', 'Gigadżul', 'Wytwórz łącznie milion energii.', { resourcesEarned: { energy: 1e6 } }, 'energy'),
  A('alloy1e3', 'Hutnik', 'Wyprodukuj 1000 stopu metali.', { resourcesEarned: { alloy: 1e3 } }, 'alloy'),
  A('electronics1e3', 'Inżynier układów', 'Wyprodukuj 1000 elektroniki.', { resourcesEarned: { electronics: 1e3 } }, 'electronics'),
  A('tech10', 'Uczony', 'Ukończ 10 technologii.', { techCount: 10 }, 'research'),
  A('tech25', 'Akademik', 'Ukończ 25 technologii.', { techCount: 25 }, 'research'),
  A('tech40', 'Strażnik wiedzy', 'Ukończ 40 technologii.', { techCount: 40 }, 'research'),
  A('research1e5', 'Archiwum odtworzone', 'Zbierz łącznie 100 tys. danych badawczych.', { resourcesEarned: { researchData: 1e5 } }, 'research'),
  A('fusionOnline', 'Słońce w butelce', 'Uruchom reaktor fuzyjny.', { buildings: { fusionReactor: 1 } }, 'fusion'),
  A('firstCrystal', 'Kryształowe serce', 'Wyhoduj pierwszy kryształ kwantowy.', { resourcesEarned: { quantumCrystals: 1 } }, 'crystal'),
  A('nanoAge', 'Era nano', 'Wyprodukuj pierwsze nanomateriały.', { resourcesEarned: { nanomaterials: 1 } }, 'nano'),
];

export const ACHIEVEMENT_MAP = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
