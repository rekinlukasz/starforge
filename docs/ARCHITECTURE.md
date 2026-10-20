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
