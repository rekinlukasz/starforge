# Starforge: Galactic Empire

Sci-fi idle clicker / incremental economy / kolonizacja kosmosu na Androida (Apache Cordova),
działający też w przeglądarce. Interfejs po polsku, kod po angielsku. Bez backendu, bez konta,
w pełni offline, orientacja pozioma.

## Zawartość

- 19 zasobów, 31 budynków stacji, 12 ulepszeń, 84 technologie (12 kategorii, drzewko + lista),
  22 zadania, 20 osiągnięć, automatyczny zakup i zapłon.
- 9 sektorów, 10 planet (10 typów), kolonie z budynkami, specjalizacjami i terraformowaniem,
  trasy logistyczne, 9 typów statków ze stocznią, ulepszeniami i naprawami.
- Ekspedycje: zwiad, analiza, kolonizacja, wydobycie, nauka, fabuła, opcjonalna walka
  z deterministyczną prognozą.
- 4 megastruktury, Galactic Rebirth z 7 ulepszeniami trwałymi i 5 specjalizacjami.
- Zapis automatyczny, kopia zapasowa, migracje, eksport/import, produkcja offline z raportem.
- Grafika 3D (Three.js, lokalnie): stacja z reaktorem i modułami rosnącymi z poziomami budynków,
  planety 3D z atmosferą i światłami kolonii, interaktywna spiralna galaktyka z flotami w locie.
  Interfejs pozostaje 2D (HTML) na wierzchu. Ustawienia → Grafika 3D: automatycznie / wysoka /
  niska / wyłączona; bez WebGL gra działa w 2D.

Dokumentacja: [GAME_DESIGN](docs/GAME_DESIGN.md) · [ARCHITECTURE](docs/ARCHITECTURE.md) ·
[ECONOMY_BALANCE](docs/ECONOMY_BALANCE.md).

## Wymagania

| Narzędzie | Wersja | Do czego |
|---|---|---|
| Node.js | ≥ 20 (testowane na 22.18) | serwer deweloperski, testy, symulacje |
| Cordova CLI | 12.x | budowanie Androida |
| cordova-android | 14.x | platforma (target SDK 35) |
| Java JDK | 17 | Gradle |
| Android SDK | platform 35, build-tools 35 | budowanie Androida |

## Przeglądarka

```bash
npm install
```

```bash
npm start
```

Otwórz `http://localhost:8080`. W konsoli dostępny jest obiekt `starforge.game` (debugowanie).

## Testy i symulacje

```bash
npm test
```

```bash
npm run sim -- 60
```

```bash
npm run fullrun -- 40 1 --rebirth
```

Three.js jest dołączony do repozytorium w `www/vendor/` (licencja MIT w `three.LICENSE.txt`).
Po aktualizacji pakietu `three` skopiuj go ponownie:

```bash
npm run vendor
```

## Modele 3D (GLB)

Statki, moduły stacji i planety są plikami glTF binarnymi:

- `www/assets/ships/<id>.glb` — 9 typów statków (276–2912 trójkątów),
- `www/assets/station/<kategoria>.glb` — 6 modułów pierścienia stacji (energetyka, wydobycie,
  przetwarzanie, infrastruktura, nauka, kosmos; 556–1656 trójkątów),
- `www/assets/planets/<id>.glb` — 10 planet + 3 etapy terraformowania Edenu (`eden-t1…t3`):
  kula z teksturą 1024 × 512 i mapą reliefu (kratery, góry), chmury z przezroczystością, pierścienie
  gazowego olbrzyma (ok. 0,35–0,5 MB każda, łącznie ok. 6 MB; wczytywane dopiero, gdy potrzebne).

Generuje je skrypt z projektów w `tools/models/` (`ships.mjs`, `station.mjs`, `planets.mjs`,
wspólne `kit.mjs`, `gltf.mjs`, `png.mjs`); tekstury planet pochodzą z tych samych generatorów,
których gra używa jako zapasu (`www/js/render3d/textures.js`):

```bash
npm run build:models
```

Każdy model to jeden węzeł z dwiema warstwami: `Body` (oświetlony materiał PBR, kolory zapisane
w wierzchołkach) i `Glow` (świecące elementy, `KHR_materials_unlit`) — dwa wywołania rysowania na
model; moduły stacji są rysowane instancjami. Modele można otworzyć w Blenderze
(File → Import → glTF 2.0) albo podmienić na własne pod tą samą nazwą:

- statki: przód w kierunku +Z, góra +Y, ok. 1 jednostka długości dla małych statków; opcjonalna
  właściwość niestandardowa `engines` (glTF extras) na obiekcie statku: `[[x, y, z, rozmiar], …]`,
- moduły: podstawa ok. 1 × 1 jednostki wyśrodkowana w zerze, spód przy y ≈ −0,3, front (strona
  zewnętrzna pierścienia) w kierunku +X, góra +Y,
- planety: kula o promieniu 1 w obiekcie o nazwie planety (np. `kepler`) z dziećmi `Surface`
  (obowiązkowe), `Clouds` i `Rings` (opcjonalne); extras `atmosphere` (kolor) i `radius`.

Jeśli plik się nie wczyta, gra użyje prostszych modeli zastępczych.

## Android (Cordova)

```bash
cordova platform add android@14
```

```bash
cordova build android
```

```bash
cordova run android
```

Pluginy: brak (cykl życia i przycisk Wstecz obsługuje rdzeń Cordovy, zapis — `localStorage` WebView).

**Stan buildu:** APK **nie zostało zbudowane**. Próba `cordova platform add android@14.0.1` na
maszynie deweloperskiej kończy się błędem `EIO` („Odmowa dostępu”) przy kopiowaniu szablonu
projektu. Najbardziej prawdopodobna przyczyna to znak spoza ASCII w ścieżce (`C:\Users\Łukasz\…`).
Obejście do sprawdzenia: skopiować projekt do ścieżki ASCII (np. `C:\dev\starforge`) i tam dodać platformę.

## Ręczna checklista Androida

- [ ] Pierwsze uruchomienie: ekran Centrum, zasoby, reaktor reaguje na dotyk bez opóźnienia.
- [ ] Wielodotyk na reaktorze nie nalicza ponad limit 20/s.
- [ ] Zakup budynku w trybach x1 / x10 / Do progu / Maks.; włączenie „Auto” po zbadaniu automatyzacji.
- [ ] Drzewko badań: przewijanie palcem, przybliżanie/oddalanie, widok listy z filtrami.
- [ ] Przycisk Wstecz: okno → poprzednia zakładka → zapis i zamknięcie aplikacji.
- [ ] Wyjście do ekranu głównego i powrót po < 1 min: brak raportu, produkcja ciągła.
- [ ] Powrót po > 1 min: raport z nieobecności (zasoby, badania, ekspedycje), nagrody po „Odbierz”.
- [ ] Zabicie aplikacji i ponowne uruchomienie: postęp, kolejki, ekspedycje i trasy zachowane.
- [ ] Zmiana daty systemowej wstecz i do przodu: brak ponownego naliczenia.
- [ ] Wycięcie ekranu: pasek zasobów i 8 przycisków nawigacji widoczne i czytelne.
- [ ] Wysłanie ekspedycji bojowej: prognoza, ostrzeżenie i wymagane potwierdzenie przy ryzyku strat.
- [ ] Galactic Rebirth: podsumowanie resetu, checkbox, drugie potwierdzenie.
- [ ] Eksport → reset → import zapisu.
- [ ] „Ogranicz animacje” wyłącza animacje (sceny 3D zatrzymują ruch i rysują ~12 klatek/s).
- [ ] Grafika 3D: płynność na słabszym telefonie w trybie „Niska”; zmiana jakości w Ustawieniach bez restartu.
- [ ] Galaktyka 3D: obrót palcem, przybliżanie szczypnięciem, wybór sektora dotknięciem.
- [ ] Flota: dotknięcie karty statku pokazuje jego model GLB obok stacji; modele wczytują się w APK.
- [ ] Moduły stacji GLB pojawiają się na pierścieniu po zakupie budynków danej kategorii.
- [ ] Wyjście do tła i powrót: scena 3D wznawia się (także po utracie kontekstu WebGL).

## Znane ograniczenia

- Brak zbudowanego APK (patrz wyżej) i brak testów na fizycznym urządzeniu.
- Modele GLB (statki, moduły stacji, planety) są generowane skryptem — bryły z prymitywów,
  tekstury planet z szumu i kraterów — nie zostały wykonane ręcznie przez grafika; pliki można
  podmienić bez zmian w kodzie (patrz „Modele 3D”).
- Wydajność 3D sprawdzona tylko w przeglądarce na komputerze (30 kl./s w trybie „Niska”,
  ~50 wywołań rysowania); brak pomiarów na fizycznym telefonie.
- Model transportu jest celowo prosty (jeden kurs naraz na trasę, stałe czasy lotu).
- Walka jest deterministyczna (bez losowości), więc prognoza zawsze odpowiada wynikowi.
- Balans późnej gry oparty na symulacjach botów; „Brama Galaktyczna” nie została osiągnięta przez bota.
