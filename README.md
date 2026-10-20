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
- [ ] „Ogranicz animacje” wyłącza animacje.

## Znane ograniczenia

- Brak zbudowanego APK (patrz wyżej) i brak testów na fizycznym urządzeniu.
- Ilustracje planet i ikony są proceduralne/wektorowe (lokalne SVG), bez grafik rastrowych.
- Model transportu jest celowo prosty (jeden kurs naraz na trasę, stałe czasy lotu).
- Walka jest deterministyczna (bez losowości), więc prognoza zawsze odpowiada wynikowi.
- Balans późnej gry oparty na symulacjach botów; „Brama Galaktyczna” nie została osiągnięta przez bota.
