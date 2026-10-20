# Balans ekonomii

Wyniki poniżej zostały **obliczone** narzędziami z `tools/` na danych z 2026-10-20.
Po zmianie danych należy je wygenerować ponownie:

```bash
npm run sim -- 60
```

```bash
npm run fullrun -- 40 1 --rebirth
```

- `sim` — 4 boty (idle / active / research / production) przez N minut, stacja i badania.
- `fullrun` — 1 bot grający pełną kampanię (stocznia, zwiad, analiza, kolonizacja, trasy,
  megastruktury, opcjonalnie odrodzenie) bez walki, 1 kliknięcie/s, decyzja co 10 s.

## Wartości startowe

| Parametr | Wartość |
|---|---|
| Energia / metal / krzem | 50 / 20 / 10 |
| Rdzeń stacji | +1 energii/s, +0,2 metalu/s |
| Pierwsza kopalnia | 10 metalu (+0,5 metalu/s) |
| Pierwsze laboratorium | 50 metalu + 25 krzemu |
| Kliknięcie | 1 energii |

Krzywe kosztów `base × g^n`: podstawowe 1,15 · przemysłowe 1,18 · nauka 1,22 · infrastruktura 1,35 ·
magazyn 1,3 (pojemność x1,2/poziom). Statki: koszt stały na sztukę; ulepszenia typów x1,6/poziom.
Technologie: koszt danych × {1, 1, 5, 15, 30} wg poziomu, czas {20 s, 90 s, 10 min, 30 min, 60 min}.

## Pierwsze 10 minut (`npm run sim -- 10`)

| Pierwszy zakup | idle | active | research | production |
|---|---|---|---|---|
| Laboratorium | 4m 00s | 2m 55s | 5m 20s | 3m 50s |
| Odlewnia stopów | 8m 30s | 5m 25s | 9m 10s | 4m 20s |
| Fabryka elektroniki | — | 6m 45s | — | 6m 30s |

## Pierwsza godzina (`npm run sim -- 60`)

| | idle (0 klik.) | active (5/s) | research | production |
|---|---|---|---|---|
| Technologie | 32 | 33 | 33 | 32 |
| Teoria fuzji | 22m 29s | 19m 24s | 22m 19s | 19m 49s |
| Autonomiczni budowniczowie | 41m 26s | 31m 19s | 34m 58s | 33m 16s |

Różnica między stylami: ok. 25% w czasie, ±1 technologia po godzinie — brak dominującego stylu.

## Pełna kampania (`npm run fullrun -- 40 1 --rebirth`)

| Kamień milowy | Cykl 1 | Cykl 2 (po odrodzeniu) |
|---|---|---|
| Loty międzyplanetarne | 31m 56s | 23m 40s |
| Pierwsza odkryta planeta | 33m 50s | 25m 30s |
| Pierwsza kolonia | 1h 52m | 1h 19m |
| Trzy kolonie | 1h 55m | 1h 22m |
| 50 technologii | 4h 02m | 2h 27m |
| Sześć kolonii | 4h 00m | 2h 39m |
| Pierwszy etap megastruktury | ~25 h | 14h 31m |
| Galactic Rebirth dostępny | ~25 h | 14h 31m |

Pierwsze odrodzenie dało 35 PP (bot kupił: zestaw startowy 3, matryca 4, dziedzictwo 2,
plany flot 1, przywołanie archiwum 1). Kolejny cykl jest o ok. 40% krótszy — prestiż ma
realny wpływ. W 36 h pierwszego cyklu bot ukończył 82/84 technologii (2 pozostałe są dostępne
dopiero po odrodzeniu), skolonizował 10/10 planet i ukończył 3/4 megastruktur.

## Wykryte i naprawione problemy

| Problem (jak wykryty) | Naprawa |
|---|---|
| Blokada startu: 15 z 20 metalu na panel → brak źródła metalu (bot „research”) | Rdzeń odzyskuje 0,2 metalu/s; test `cannot soft-lock` |
| Limity magazynów rosły liniowo, koszty wykładniczo → nieosiągalne koszty >100 tys. (analiza) | Magazyn mnożnikowy x1,2/poziom przy koszcie 1,3^n |
| Zakleszczenie: napęd warp kosztował egzotyczną materię, której źródło wymaga napędu warp | Usunięty koszt; test regresyjny |
| Łańcuch zadań wymagał klikania — bot idle odebrał 0/22 zadań | Zadanie kliknięć poza łańcuchem; test „tutorial does not require clicking” |
| Minimalna flota misji bojowej nie mogła wygrać (prognoza w UI) | Przestrojeni przeciwnicy, 12 rund; test „minimum fleet wins” |
| Zbyt szybka progresja: odrodzenie po 1h44m, 143 mln danych po 12 h (`fullrun`) | Skalowanie kosztów/czasu badań wg poziomu, ostrzejszy wymóg prestiżu |
| Artefakty z Ossuarium w nadmiarze (11 tys. po 24 h) | Złoże 0,01 → 0,0005/s na poziom |
| Platforma inżynierii gwiezdnej wymagała 5 egzotycznej materii przy jednym jednorazowym źródle | Koszt 2; nowa powtarzalna misja „Zbiór egzotycznej materii” |

## Znane kwestie balansu

- Megastruktura „Brama Galaktyczna” wymaga 50 antymaterii — w kampanii bota nie została zbudowana,
  bo bot nie przydzielił trasy z Singularis (limit 20 tras). Gracz może to zrobić ręcznie;
  to świadomie najdłuższy cel gry.
- Bot nie walczy, więc balans nagród za walkę oceniono tylko testami prognozy, nie symulacją ekonomii.
- Dane badawcze w późnej grze rosną szybciej niż inne zasoby (miliardy po 36 h) — koszty
  poziomu 5 (do 150 mln) nadal pozostają celem kilkugodzinnym.
