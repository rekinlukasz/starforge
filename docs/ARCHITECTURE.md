# Architektura

Czysty JavaScript (ES Modules), bez frameworka i bez kroku budowania — `www/` działa bezpośrednio
w przeglądarce i w Cordovie. Zależności deweloperskie: Vitest, happy-dom (testy UI).

## Warstwy

```
www/data/            konfiguracja: zasoby, receptury, budynki, ulepszenia, technologie, zadania,
                     osiągnięcia, statki, planety, sektory, megastruktury, prestiż, fabuła
www/js/core/         Game (stan + akcje), GameState (model v5), GameLoop (czas), EventBus
www/js/systems/      logika domenowa bez DOM (patrz niżej)
www/js/persistence/  SaveManager, SaveMigration (v1→v5), StorageAdapter
www/js/ui/           UIManager, 7 ekranów, panele, okna; tylko czytają stan i wołają akcje Game
www/js/utils/        BigNumber, Formatter, Validation (+ ValidationSpace)
www/js/render3d/     opcjonalna warstwa 3D (Three.js): Renderer3D, StationView, PlanetView,
                     GalaxyView, proceduralne tekstury/modele, czysta logika układu (layout.js)
www/vendor/          three.module.min.js (kopiowany przez `npm run vendor`)
tools/               serwer deweloperski, symulacje ekonomii (sim, fullrun)
tests/               Vitest: 9 plików, 150 testów (logika bez DOM + ścieżki UI w happy-dom)
```

Systemy (`www/js/systems/`): Modifier, Resource, Building, Production, Click, Upgrade, Research,
Mission, Achievement, Automation, Fleet, Combat, Planet, Expedition, Colony, Logistics,
Megastructure, Prestige, OfflineProgress oraz wspólny `Conditions`.

## Zasady

- **Źródło prawdy**: `game.state`. DOM nie przechowuje stanu gry.
- **Zmiany stanu** wyłącznie przez metody `Game` (lub systemów, które one wołają).
  `ResourceSystem` jest jedynym miejscem zmieniającym ilości zasobów stacji, `ColonySystem` —
  magazynów kolonii.
- **Transakcje atomowe**: każdy zakup najpierw sprawdza pełny koszt, potem pobiera całość.
- **Nagrody dokładnie raz**: rekord ekspedycji jest usuwany przed przyznaniem nagród; dostawa
  logistyczna usuwa rekord przesyłki; zadanie oznaczane jako odebrane przed dodaniem nagrody;
  efekty technologii wynikają ze zbioru ukończonych (nie są „doliczane”).
- **Modyfikatory**: migawka budowana od zera po każdej zmianie (`invalidate`). Systemy późnej gry
  (megastruktury, prestiż) dodają źródła przez `modifiers.addSource`.
- **UI**: DOM budowany raz; co 250 ms aktualizowane są tylko teksty/klasy aktywnego ekranu;
  listy przebudowywane przy zmianie sygnatury. Delegowanie zdarzeń. Brak `innerHTML`, `eval`
  i atrybutów `style` (CSP `style-src 'self'` — pozycje ustawiane przez CSSOM).

## Czas i symulacja

- `GameLoop` co 200 ms wywołuje `game.update(Date.now())`; ilość symulacji wynika wyłącznie
  z różnicy znaczników czasu.
- `simulate(seconds, maxStep)` → `step(dt)`: produkcja stacji, autozapłon, badania, automatyzacja,
  kolonie, stocznia/naprawy, logistyka, megastruktury, czas symulacji, ekspedycje, zadania, osiągnięcia.
- `meta.lastSimulationAt` nigdy się nie cofa (ochrona przed cofaniem zegara); `meta.simTime`
  napędza wszystkie timery w grze.
- Luka > 60 s → `OfflineProgressSystem`: ta sama funkcja `simulate` na kopii stanu, krok adaptacyjny
  (≤ 4000 kroków), raport, a stan podmieniany dopiero po „Odbierz”.

## Produkcja

Zagregowana (typ budynku × poziom). `solveEfficiency` (wspólny dla stacji i kolonii) wylicza
wydajność każdego producenta w kilku przejściach bilansujących. Test „niezależność od częstotliwości
wywołań”: 1 × 60 s = 600 × 0,1 s.

## Duże liczby

`BigNumber`: niezmienna para mantysa/wykładnik, ułamki i wartości > 1e308, porównania, potęgi.
Serializacja `"<m>e<e>"` (dokładna w obie strony). `toNumber()` tylko dla małych wartości.

## Zapis

- Klucze: `starforge.save`, `starforge.save.backup` (poprzedni poprawny), `starforge.save.corrupt`.
- Odczyt: główny → kopia → nowa gra (z komunikatem).
- Migracje v1→v2 (format płaskich liczb) → v3 (badania) → v4 (kosmos) → v5 (prestiż).
- `sanitizeState` + `sanitizeSpace`: świeży stan + kopiowanie wyłącznie znanych, poprawnych pól;
  odrzucane są nieznane id, wartości ujemne, zduplikowane rekordy przesyłek i ekspedycji.
- Eksport/import: `SF1:` + base64(JSON UTF-8), walidacja prefiksu, rozmiaru i treści.

## Cordova

Brak pluginów. `deviceready` → start; `pause` → symulacja do teraz + zapis + stop pętli;
`resume` → krótka luka na żywo, długa przez raport; `backbutton` → okno → poprzednia zakładka →
zapis i wyjście. Orientacja pozioma (`config.xml`), obszary bezpieczne przez `env(safe-area-inset-*)`.

## Warstwa 3D

- Jedno płótno WebGL (`.scene3d`, `position: fixed`) pod całym interfejsem; HTML pozostaje na
  wierzchu (`#root`, z-index 1). Klasa `html.has-3d` przełącza style na półprzezroczyste panele.
- Ładowana leniwie przez `import()` w `app.js` po starcie gry; brak WebGL, błąd lub ustawienie
  „Wyłączona” = interfejs 2D bez zmian. Zmiana jakości w Ustawieniach odtwarza renderer w locie.
- Sceny tylko **czytają** `game.state` (nigdy nie zapisują); przebudowują geometrię wyłącznie, gdy
  zmienia się sygnatura widocznych liczników (moduły, asteroidy, statki, planeta w centrum).
- `layout.js` (bez Three.js, testowany): mapowanie zakładka → scena, profile jakości, liczba modułów
  z poziomów budynków, pozycje sektorów (wspólne z mapą 2D), trasy flot, stan sektora.
- Kotwiczenie: każdy ekran podaje `sceneOptions()` z punktem na ekranie; `camera.setViewOffset`
  przesuwa projekcję tak, by środek sceny wypadał w tym punkcie (np. reaktor 3D pod przyciskiem
  reaktora, galaktyka w oknie mapy). Etykiety sektorów to elementy DOM pozycjonowane co klatkę.
- Wydajność: limit klatek (60/30, 12 przy „Ogranicz animacje”), pixelRatio ≤ 1,5, `InstancedMesh`
  dla modułów/asteroid/paneli, statki scalane do jednej siatki, pauza w tle, obsługa
  `webglcontextlost/restored`.
- Bez zewnętrznych zasobów: tekstury planet, mgławice i poświaty rysowane na płótnie 2D z
  deterministycznego szumu.
- Planety GLB: `www/assets/planets/*.glb` (tekstury PNG osadzone w pliku, relief jako mapa
  normalnych, chmury i pierścienie jako osobne węzły). Ładowane na żądanie
  (`modelLibrary.ensure`); do czasu wczytania `PlanetView` rysuje tę samą planetę z generatorów
  w `textures.js` (czyste funkcje pikseli, wspólne z Node). Poświata atmosfery, światła miast i
  księżyc są dodawane w grze. CSP dopuszcza `blob:` w `img-src`/`connect-src`, bo GLTFLoader
  dekoduje osadzone obrazy przez adresy blob.
- Modele GLB: `www/assets/ships/*.glb` (statki) i `www/assets/station/*.glb` (moduły pierścienia,
  po jednym na kategorię budynków) budowane przez `tools/build-models.mjs` z `tools/models/`
  (własny zapis GLB: jeden węzeł, warstwy `Body` (PBR, COLOR_0) i `Glow` (unlit), `extras` z
  danymi rozgrywki, np. punkty dysz). W grze ładuje je `modelLibrary` (vendorowany GLTFLoader):
  statki jako klony współdzielące geometrię, moduły jako `InstancedMesh` (po jednym na warstwę i
  kategorię). Zasoby biblioteki są oznaczone `userData.shared` i pomijane przy zwalnianiu sceny.
  Brak pliku → model zastępczy. `tests/models.test.js` sprawdza format, wczytanie GLTFLoaderem,
  kolory wierzchołków, orientację, wymiary modułów i rozmiar plików.
