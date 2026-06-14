# Sirály Regatta — Vitorla- és sebességfizika újratervezése

**Cél:** olyan modell, ahol a vitorlaválasztás *valóban* meghatározza a sebességet, a számok realisztikusak, és nincs „genakkerrel bárhol 80%+" lyuk. A dokumentum a **specifikáció**, amiből az új `lib/units.ts` + `lib/engine-physics.ts` (és a vele azonos engine `index.js`) felépül.

---

## 1. Miért rossz a jelenlegi modell

A sebesség jelenleg:

```
boatSpeed = polár(TWA,TWS) × trimMult × driftMult × sailPenaltyMult × reefSogMult
```

Három, egymástól független architekturális hiba:

1. **A polár már feltételezi a helyes vitorlát.** Az `interpolatePolar` a sebességet kizárólag TWA+TWS alapján adja. A „melyik vitorla van fent" csak a szorzókon át hat — ha a szorzók nem büntetnek, rossz vitorla is megkapja a *teljes* polár-sebességet.

2. **A `sailPenaltyMult` bináris szikla.** Értéke 1.0 vagy 0.4/0.5 — nincs köztes. A genakker „bőszél szélbe" büntetése ráadásul csak `abs < 90`-re fut, így **90–100° között a genakker büntetlen** (teljes sebesség). Ez a konkrét „oldalszélben 80%+" lyuk.

3. **A `trimEff` alapszintje túl magas, és összemossa a vitorla-helyességet a trim-minőséggel.** Rossz vitorlával is `base=45`, +25 trim-bónusz = 70 → `trimMult = 0.6+0.4×0.7 = 0.88`. Vagyis teljesen rossz vitorla is ~88% szorzót kap. A `sailMatch` a trim-számításban van — emiatt a „vitorla jó-e" és a „trim jó-e" nem szétválasztható.

**Következmény:** a vitorlaválasztás alig kötődik a sebességhez. Bármilyen vitorla ~0.88×polár körül teljesít, hacsak épp el nem találja a bináris büntetés-feltételt.

---

## 2. Tervezési elvek

Három **független** tényezőre bontjuk a sebességet, és kikötjük, hogy **a hajó soha nem mehet gyorsabban a polárnál**:

```
boatSpeed = polár(TWA,TWS) × η_sail × η_trim × η_drift × η_reef
                              └─ mind ∈ [0,1], a polár a felső korlát ─┘
```

| Tényező | Mit modellez | Tartomány | Függ |
|---|---|---|---|
| `polár(TWA,TWS)` | hajótest-potenciál az **optimális** vitorlával | csomó | TWA, TWS |
| `η_sail` | a **fent lévő** vitorla mennyire illik a ponthoz | 0–1 | vitorlák, TWA, TWS |
| `η_trim` | a vitorla beállításának minősége | 0.5–1 | trim vs optimum |
| `η_drift` | sodródási veszteség (dőlés→drift) | 0–1 | dőlés, drift |
| `η_reef` | reef/fockroller felület-illesztés | 0–1 | reef, TWS |

A kulcsváltozás a **`η_sail`**: minden vitorlának **sima hatékonyság-görbéje** van a TWA mentén (TWS-kapuval), ami a vitorla édes pontján 1, és onnan **fokozatosan** cseng le. Ez váltja ki a polár-feltételezést *és* a bináris büntetést egyszerre. A „vitorla helyes-e" kikerül a trimből → a két dolog szétválik.

---

## 3. A vitorla-hatékonyság modell (`η_sail`)

### 3.1 Görbe-alak: plató + rámpa (crossover-cella)

Minden vitorlához tartozik egy **mag-tartomány `[lo, hi]`**, ahol η ≈ 1 (itt „optimális" a vitorla), és a magon kívül egy **rámpa `m` szélességgel**, ahol simán lecseng egy `floor` szintre. Ez pontosan a valós crossover-diagramok logikája (TWA × TWS → optimális vitorla sávokban).

```
f_angle(TWA; lo, hi, m, floor):
    if lo ≤ TWA ≤ hi:        return 1
    d = (TWA < lo) ? (lo - TWA) : (TWA - hi)
    if d ≥ m:                return floor
    s = smoothstep(1 - d/m)              # 0..1 sima
    return floor + (1 - floor) * s
```

`smoothstep(x) = x*x*(3 - 2x)` (sima, deriváltja 0 a végeken — nincs törés).

### 3.2 TWS-kapu (alul-/túlerőltetés)

A szél *erőssége* külön kapu — egy vitorla a saját szélsávján kívül veszít (túl gyenge: kevés erő; túl erős: veszélyes/laposodik):

```
f_tws(TWS; tlo, thi, tfloor):
    if tlo ≤ TWS ≤ thi:      return 1
    d = (TWS < tlo) ? (tlo - TWS) : (TWS - thi)
    return max(tfloor, 1 - d * k_tws)    # k_tws ≈ 0.06 / csomó
```

### 3.3 Egy headsail hatékonysága

```
η_headsail(sail, TWA, TWS) = f_angle(TWA; sail.lo, sail.hi, sail.m, sail.floor)
                           × f_tws (TWS; sail.tlo, sail.thi, sail.tfloor)
```

### 3.4 A fő (gross) és a teljes `η_sail`

A **gross** (nagyvitorla) nem headsail — szinte mindig fent van, és a hajtás bázisa. Saját szög-faktora a mély hátszélen csökken (a főt kitakarja a hajó / a spinnaker viszi a munkát):

```
f_gross(TWA) = f_angle(TWA; 35, 150, 40, 0.55)   # 150° felett fokozatosan kevésbé hatékony
```

A teljes vitorla-hatékonyság = a **fent lévő, az adott ponthoz legjobb headsail** kombinálva a gross-szal:

```
η_sail = mainComponent × headsailComponent

mainComponent   = sails.gross ? f_gross(TWA) : 0.45      # gross nélkül nagy veszteség
headsailComponent =
    ha nincs headsail fent:    g0(TWA)                   # csak gross: ld. 3.5
    különben:                  max feletti aktív headsail η-ja
```

ahol egy „aktív headsail" a `sails`-ben true értékű headsail (fock / genua / genakker / spinn).

**Kizárólagossági szabályok** (megmaradnak, kemény büntetéssel — fizikailag lehetetlen kombók):

```
genua && fock      → η_sail × 0.35   (két orrvitorla egyszerre)
spinn && genakker  → η_sail × 0.35
spinn && genua     → η_sail × 0.35
spinn && fock      → η_sail × 0.35
```

### 3.5 „Csak gross" eset

Ha nincs headsail, a hajó megy, de gyengén — szélbe rosszul, mély hátszélen elfogadhatóbban:

```
g0(TWA) = 0.45 + 0.20 * clamp((TWA - 60) / 120, 0, 1)   # 0.45 (szélbe) … 0.65 (hátszél)
```

---

## 4. Alapértelmezett paramétertábla (a hangolási felület)

Ez a modell **szíve és egyetlen hangolandó része**. A tartományok a valós vitorla-irodalomból (PredictWind crossover, North/Doyle, aszimmetrikus spinnaker 90–165°, Code 0 50–120° / édes pont 75°, spinnaker mély hátszél) származnak, a Sirály 5-vitorlás készletére adaptálva. A számokat Akos szabadon finomhangolhatja.

| Vitorla | Szög-mag `[lo,hi]` | Rámpa `m` | `floor` | TWS-sáv `[tlo,thi]` | `tfloor` | Megjegyzés |
|---|---|---|---|---|---|---|
| **gross** | 35–150 | 40 | 0.55 | — | — | mindig fent; >150° csökken |
| **fock** (kis, lapos orrvitorla) | 42–95 | 25 | 0.20 | 12–30 | 0.45 | szélbe/félszél, **erős** szél |
| **genua** (nagy, átfedő) | 38–90 | 25 | 0.20 | 4–14 | 0.40 | szélbe/félszél, **könnyű** szél |
| **genakker** (aszim. reacher) | 100–150 | 20 | 0.22 | 5–18 | 0.35 | **raum/reaching**; <80° rossz |
| **spinn** (szimmetrikus) | 135–180 | 22 | 0.20 | 5–17 | 0.35 | **mély hátszél**; <115° rossz |

**Mit old meg ez konkrétan:**
- **genakker @ 90°**: a mag 100-nál kezdődik, 90° a rámpán van (`d=10`, `m=20` → `s=smoothstep(0.5)=0.5` → `η_angle≈0.22+0.78×0.5≈0.61`)… **de** lásd lentebb: a `f_tws` is rajta van, és a genua/fock ugyanitt **1.0** → az orrvitorla nyer. A „oldalszélben genakker az optimális" lyuk megszűnik.
- **genakker @ 60° (szélbe-félszél)**: `d=40 ≥ m=20` → `η_angle = floor = 0.22`. Genakkerrel szélbe ~0.22× a polár → reálisan lassú, nem 80%+.
- **spinn @ 90°**: `d=45 ≥ 22` → `floor=0.20`. Spinnakerrel oldalszélbe ~0.2× → reálisan rossz.

---

## 5. Trim-minőség (`η_trim`) — szétválasztva

A trim mostantól **csak a beállítás minőségét** méri, a vitorla-helyességet nem (az a `η_sail`-ban van). Marad a `getOptimalTrim(TWA,TWS)` és az eltérés-számítás, de:

```
avgDiff   = átlagos |trim[k] - optimal[k]|  a releváns kulcsokra (0..100)
η_trim    = clamp(1 - avgDiff/100 * 0.5, 0.5, 1.0)
```

- Tökéletes trim → `η_trim = 1.0`.
- Teljesen rossz trim → `η_trim = 0.5` (lassít, de nem áll le).
- **Nincs `sailMatch` tag** a trimben → megszűnik a „rossz vitorla, mégis 88%".

A RIG panel „hatékonyság" kijelzője **a `η_sail × η_trim`-et** mutassa (a valós, vitorlát is figyelembe vevő hatékonyságot), ne csak a trimet — így a 98%-os hamis érték eltűnik.

---

## 6. Reef és fockroller (`η_reef`, terület)

A meglévő reef/fockroller rendszer jó, csak konzisztensen illesztjük:

- **Terület-szorzó** (gross reef): `grossReefMultiplier` (1.0 / 0.8 / 0.6 / 0.4) — ez a polár *potenciálját* csökkenti (kevesebb vitorla = kevesebb erő), tehát a `polár`-ra hat, nem külön η.
- **Reef-illeszkedés** `η_reef`: ha a TWS-hez képest alá-reffelsz, `calcReefPenalty` adja a `sogMultiplier`-t és a `heelAdd`-ot (marad). Túl-reffelés kis veszteség (marad).
- **Fockroller**: ha van, a `fockrollerEfficiency` szorzó a headsail terület-hatékonysága — ez a `headsailComponent`-be szorzódik be (nem külön ágon).

```
adjustedPolar = polár(TWA,TWS) × grossReefMultiplier(grossReef)
η_reef        = calcReefPenalty(grossReef, TWS).sogMultiplier
headsailComponent ×= hasFockroller ? fockrollerEfficiency(pct).multiplier : 1
```

---

## 7. Új `calcPhysics` (pszeudokód)

```
function calcPhysics(boatClass, sails, trim, hdg, windDir, windSpeedKn):
    if nincs vitorla fent: return áll  (speed 0)

    twa     = normalize(windDir - hdg)          # -180..180
    absTwa  = |twa|
    tws     = windSpeedKn

    # 1) Hajótest-potenciál (optimális vitorlával) + reef-terület
    base    = interpolatePolar(polar[boatClass], absTwa, tws)
    base   *= grossReefMultiplier(trim.grossReef)

    # 2) Vitorla-hatékonyság (ÚJ)
    ηsail   = computeSailEfficiency(sails, absTwa, tws, trim.hasFockroller, trim.fockrollerPct)

    # 3) Trim-minőség (szétválasztva)
    ηtrim   = computeTrimQuality(sails, trim, absTwa, tws)     # 0.5..1.0

    # 4) Dőlés és sodródás (a meglévő logika, de ηsail-ből számolt „hajtásból")
    fSide   = tws * sin(absTwa°)
    heel    = clamp(fSide * 0.65 * (1 + (1-ηtrim)*2) + reefHeelAdd, 0, 45)
    drift   = heel>5 ? 0.3*fSide*tan(min(heel,35)°) : 0
    ηdrift  = cos(drift°)

    # 5) Reef-illeszkedés
    ηreef   = calcReefPenalty(trim.grossReef, tws).sogMultiplier

    # 6) Eredő — a polár a felső korlát
    speed   = base * ηsail * ηtrim * ηdrift * ηreef
    cog     = hdg + sign(twa)*drift
    return { boatSpeed: speed, heel, driftAngle: drift, cog,
             speedEfficiency: round(ηsail*ηtrim*ηdrift*ηreef*100),
             ... figyelmeztetések ... }
```

`computeSailEfficiency` a 3–4. szakasz szerint (plató+rámpa, TWS-kapu, kizárólagosság, gross-bázis). A figyelmeztetések (rossz vitorla, leszúrás, reef) abból jönnek, hogy `ηsail` egy küszöb alá esik-e adott ponton — nem külön bináris szabályból.

---

## 8. Kidolgozott példák (YS1, ellenőrzéshez)

A `polár` értékek a meglévő `YS1_POLAR`-ból. `η_trim≈0.95` (jól trimmelt), `η_drift≈0.97`, `η_reef=1` feltételezve.

| Helyzet | TWA | TWS | polár | η_sail (számolt) | **eredő sebesség** | Valós? |
|---|---|---|---|---|---|---|
| **genua**, oldalszél | 90 | 10 | 6.6 | genua mag (38–90) → **1.0** | **≈6.1 kn** | ✅ gyors |
| **genakker**, oldalszél | 90 | 10 | 6.6 | rámpa (mag 100) → **≈0.61** | **≈3.7 kn** | ✅ lassabb, mint genua |
| **genakker**, szélbe | 55 | 10 | 4.4 | floor → **0.22** | **≈0.9 kn** | ✅ majdnem áll |
| **genakker**, raum | 120 | 10 | 6.5 | mag → **1.0** | **≈6.0 kn** | ✅ itt a király |
| **spinn**, hátszél | 165 | 10 | ~5.3 | mag (135–180) → **1.0** | **≈4.9 kn** | ✅ |
| **spinn**, oldalszél | 90 | 10 | 6.6 | floor → **0.20** | **≈1.2 kn** | ✅ rossz vitorla |
| **fock**, szélbe erős | 50 | 16 | ~5.x | fock mag + TWS 12–30 → **1.0** | gyors | ✅ |
| **genua**, szélbe erős | 50 | 16 | ~5.x | TWS-kapu (thi=14) → **<1**, túlerő | lassabb + dőlés | ✅ válts fockra |

A korábbi tünet (genakker+gross 98% → 3.4 kn, miközben fock+gross 78% → 4.8 kn **ugyanazon** a ponton) megszűnik: ugyanazon a TWA/TWS-en a **gyorsabb kombó kapja a magasabb hatékonyságot is**, mert mindkettő a *közös polár*-ból indul, és a `η_sail` rangsorolja őket.

---

## 9. Mit kell lecserélni (migráció)

**`lib/units.ts`:**
- `recommendSails` → marad, de a **plató/rámpa magokból** származtatva (az „optimális" = amelyik vitorla η-ja a legnagyobb adott TWA/TWS-en). Egyetlen forrás a paramétertábla.
- **ÚJ** `SAIL_PROFILES` konstans (a 4. tábla) + `sailAngleFactor`, `sailTwsFactor`, `computeSailEfficiency`.
- `calcSailPenalty` → **elhagyható**; a kizárólagosság és a „rossz vitorla" a `computeSailEfficiency`-be olvad. (A figyelmeztető szövegeket átemeljük.)
- polár adatok, reef, fockroller → maradnak.

**`lib/engine-physics.ts`:**
- `calcTrimEfficiency` → `computeTrimQuality` (sailMatch tag nélkül, 0.5–1 közé fogva).
- `calcPhysics` → a 7. szakasz szerinti sorrend; `boatSpeed = base × ηsail × ηtrim × ηdrift × ηreef`.

**Engine (`siraly-engine/index.js`):** a `calcPhysics`/`units` logikát **tükrözni kell** (az engine külön repó, saját másolattal). A frontend és az engine ugyanazt a képletet kell hogy futtassa, különben a kijelzett és a tényleges sebesség eltér. Javasolt: a fizikát egy közös, bemásolható modulként tartani szinkronban.

---

## 10. Nyitott hangolási kérdések (neked)

1. **Arcade vagy realisztikus?** A fenti realisztikus (polár-alapú). Ha „arcade-osabb", nagyobb különbségeket akarsz a vitorlák közt, a `floor` értékeket vidd lejjebb (pl. 0.10) — akkor a rossz vitorla még jobban büntet.
2. **A genua/fock határa** (most TWS 13.5–14 körül vált). Maradjon, vagy told?
3. **Code-0 jellegű genakker?** Ha a genakkered inkább lapos reacher (Code 0), a magját vidd lejjebb (pl. 75–120) — akkor félszélben is jó lesz. Ha klasszikus aszimmetrikus spinnaker, marad a 100–150.
4. **Leszúrás (leszúrás-kockázat)**: most absTwa>150 + rossz trim + spinn/gross. Az új modellben kössük inkább a `η_sail` és a `heel` küszöbéhez?

---

**Következő lépés:** ha jóváhagyod a paramétertáblát (4. szakasz) és az arcade/realisztikus irányt (10.1), megírom a kész `units.ts` + `engine-physics.ts` fájlokat e spec szerint, majd az engine `index.js` tükrözését. Addig egyik fájlt sem írom át, hogy ne legyen fél kész állapot.
