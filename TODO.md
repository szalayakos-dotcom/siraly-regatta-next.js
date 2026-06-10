# Sirály Regatta — Fejlesztési napló

## Megoldandó bugok

- [ ] **Trim csúszka végpontfeliratok** — `leftLabel`/`rightLabel` prop átadva de nem renderel. Valószínű ok: Tailwind `pl-28` osztály nem töltődik be (purge), vagy a label div nem kap magasságot. Megoldás: inline style-ra váltás a Tailwind helyett.
- [ ] **Kredit szinkron** — `player_profiles.credits` (200 kr) nincs szinkronban a `player_races.credits`-szel. Bejelentkezés + nevezés után kell egy seed lépés.
- [ ] **Drift értékek írása** — az `engine-physics.ts` kiszámolja a `drift_angle`/`cog`/`heel` értékeket, de a `race_positions` táblába nem írja vissza. Kell egy server-side tick vagy client-side interval.
- [ ] **COG nyíl az iránytűn** — csak `drift_angle > 1` esetén jelenik meg, de a DB-ben nincs még valós érték.

## Következő fejlesztések

- [ ] **Railway deploy** — Next.js + PocketBase egyszerre Railway-en
- [ ] **Bejelentkezés / regisztráció oldal** — `/login` route, PocketBase auth
- [ ] **Lobby → Dashboard átmenet** — a lobby.html Next.js-be portolása
- [ ] **Engine tick** — szerver oldali vagy client-side interval ami 10mp-enként kiszámolja a fizikát és frissíti a `race_positions`-t
- [ ] **Hangjelzések** — Warning Panel lámpákhoz Web Audio API alapú hangok
- [ ] **Ys osztály választás** — Ys.I / Ys.II / Ys.III kiválasztása induláskor, polar adatok ennek megfelelően
- [ ] **Kínai halzolás animáció** — leszúrás warning után vizuális feedback a térképen
- [ ] **Mobile layout** — a dashboard mobilon nem optimális

## Architektúra notes

- PocketBase: `http://127.0.0.1:8090`, RACE_ID: `gzg9yq85dofs8cs`
- Polar adatok: `lib/units.ts` — YS1/YS2/YS3_POLAR
- Fizikai motor: `lib/engine-physics.ts` — `calcPhysics()`, `calcTrimEfficiency()`
- Warning state: `SailTrim` → `onWarningsChange` → `page.tsx` → `WarningPanel`
- Egységek: DB-ben km/h, UI-ban csomó (kn), konverzió: `kmhToKnots()`
