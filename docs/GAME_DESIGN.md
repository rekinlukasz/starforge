# Game Design

Wszystkie liczby i treści są w `www/data/*.js`. Ten dokument opisuje decyzje projektowe.

## Pętla gry

1. Dotyk reaktora → energia (aktywny styl; nigdy nie jest wymagany).
2. Budynki stacji → automatyczna produkcja → łańcuchy przetwórcze.
3. Laboratoria → dane badawcze → drzewko technologii (84 technologie, 12 kategorii).
4. „Loty międzyplanetarne” → stocznia → zwiadowca odkrywa sektory i planety.
5. Analiza planety (statek badawczy albo 2 zwiadowców) → kolonizacja (statek kolonizacyjny).
6. Kolonia produkuje do własnego magazynu → trasy logistyczne przewożą zasoby na stację.
7. Flota: ekspedycje wydobywcze, naukowe, fabularne i opcjonalne starcia.
8. Megastruktury wymagają zasobów wielu kolonii.
9. Galactic Rebirth: reset z trwałymi bonusami i specjalizacją cyklu.

Trzy style gry (sprawdzone botami, patrz ECONOMY_BALANCE.md): po 60 minutach bot bez kliknięć
ma 32 technologie, bot klikający 5×/s — 33. Kliknięcia przyspieszają start, ale nie są obowiązkowe.

## Systemy

| System | Gdzie | Najważniejsze decyzje |
|---|---|---|
| Zasoby (19) | `resources.js` | Odblokowanie przy pierwszym pozyskaniu; limity magazynów rosną mnożnikowo (magazyn ładunkowy x1,2/poziom, kompleks magazynowy x1,3/poziom). |
| Budynki (31) | `buildings.js` | Wspólny system receptur; progi 10/25/50/100/200/400 poziomów dają x1,5 do wyjść. |
| Receptury | `recipes.js` | Ciągły przepływ (ilość/czas partii) — agregacja i offline są dokładne. Brak wejść → proporcjonalne spowolnienie. |
| Kliknięcia | `upgrades.js`, `ClickSystem` | Wartość płaska + mnożnik + udział w produkcji energii; przeciążenie; limit 20/s; autozapłon (2/s) późno. |
| Ulepszenia (12) | `upgrades.js` | Jednorazowe, z warunkami odblokowania. |
| Technologie (84) | `technologies.js` | Czas badań wg poziomu (20 s … 1 h), koszt danych skalowany wg poziomu (x1…x30). Kolejka 5 pozycji, płatność przy starcie, anulowanie ze zwrotem. Gałąź „po odrodzeniu” (2 technologie). |
| Zadania (22) | `missions.js` | Łańcuch samouczka nie wymaga klikania; ukończenie jest zapamiętywane; nagroda raz. |
| Osiągnięcia (20) | `achievements.js` | Każde +2% produkcji (addytywnie). |
| Automatyzacja | `AutomationSystem` | Autozakup tylko wskazanych budynków, gdy koszt ≤ wybrany % zapasów (5–50%). |
| Sektory (9) i ekspedycje | `sectors.js` | Każdy sektor osiągalny zwiadem bez walki (test). Nagrody deterministyczne, bonusy „co N-tą wyprawę”. |
| Planety (10 typów) | `planets.js` | Każda: przewaga + wada, złoża, przydatność dla specjalizacji, utrzymanie habitatów, sloty. |
| Kolonie | `ColonySystem` | Kompleks wydobywczy, habitat (+10% produkcji, wymaga utrzymania), fabryka (lokalna konwersja), port (magazyn x2, krótsze loty). Specjalizacje: górnicza, przemysłowa, naukowa, rolnicza, handlowa. Dane, kredyty i artefakty trafiają od razu na stację. |
| Terraformowanie | `TERRAFORMING` | Tylko Eden: 3 etapy, każdy zużywa jednostkę terraformującą, +25% produkcji i +6 slotów. |
| Logistyka | `LogisticsSystem` | Trasa: źródło, cel, zasób, ilość, częstotliwość, transportowce. Jeden kurs naraz na trasę; ładunek pobierany atomowo przy odlocie, dostarczany raz. Paliwo: energia stacji. |
| Flota (9 typów) | `ships.js`, `FleetSystem` | Kolejka stoczni (sloty = poziom stoczni), ulepszenia typów (+10%/poziom), naprawy w doku. |
| Walka | `CombatSystem` | Deterministyczna; prognoza = wynik. Odwrót przy 25/50/75% kadłuba (ustawienie). Minimalna flota misji zawsze wygrywa (test). Walka nie blokuje progresji. |
| Megastruktury (4) | `megastructures.js` | Etapy z kosztami z kolonii i wymaganą liczbą kolonii (2–6). |
| Prestiż | `prestige.js` | Wymóg: 60 technologii, 3 kolonie, 1 etap megastruktury. Punkty: √(energia/1e8) + 3/kolonia + 5/etap. 7 ulepszeń trwałych, 5 specjalizacji, dwustopniowe potwierdzenie. Ulepszenia można zaplanować w oknie odrodzenia za obecne + zdobywane PP (kupowane przy odrodzeniu, działają od razu w nowym cyklu); później dostępne w menu „Więcej” → Prestiż. |

## Zasady stosowania bonusów

- Ten sam typ „Add” — suma; „Mult” — iloczyn; różne grupy — iloczyn.
- Wyjście budynku = receptura × poziom × mnożnik budynku × mnożnik kategorii × próg × mnożnik zasobu × globalny.
- Wejścia mnożone tylko przez `inputMult` (efektywność), nigdy przez bonusy produkcji.
- Każde źródło (ulepszenie, technologia, poziom budynku, osiągnięcie, etap megastruktury, prestiż)
  jest naliczane raz, bo migawka modyfikatorów jest budowana od zera po każdej zmianie.

## Fabuła

Krótkie wpisy w dzienniku (budynki, technologie, ekspedycje fabularne: Archiwum Strażników,
Brama Strażników). Żadnych blokujących dialogów.

## Zakres resetu prestiżu

Resetowane: zasoby (poza PP), budynki, ulepszenia, badania, kolonie, flota, ekspedycje, trasy,
odkrycia, megastruktury. Zachowane: PP i ulepszenia prestiżu, osiągnięcia, odebrane zadania,
dziennik, ustawienia, łączna liczba kliknięć. Lista jest pokazywana przed potwierdzeniem.
