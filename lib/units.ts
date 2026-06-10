// Egységváltó segédfüggvények

/** km/h -> csomó */
export function kmhToKnots(kmh: number): number {
  return kmh / 1.852
}

/** csomó -> km/h */
export function knotsToKmh(knots: number): number {
  return knots * 1.852
}

/** Formázott csomó érték */
export function formatKnots(kmh: number, decimals = 1): string {
  return kmhToKnots(kmh).toFixed(decimals) + ' kn'
}

/** Formázott csomó szám */
export function toKnots(kmh: number, decimals = 1): string {
  return kmhToKnots(kmh).toFixed(decimals)
}

// POLAR ADATOK - Ys osztályok
// Forrás: Dehler 25 (Ys.I ref), ORC VPP modell alapján számítva
// TWA = True Wind Angle (fok), TWS = True Wind Speed (csomó)
// Értékek: Boat Speed (csomó)

export interface PolarPoint {
  twa: number    // szélirány szög
  speeds: Record<number, number>  // TWS -> BSP (csomó)
}

// Ys.I polar (1200-1800 kg, ~7.5m, Dehler 25 referencia)
export const YS1_POLAR: PolarPoint[] = [
  { twa: 52,  speeds: { 6: 4.2, 8: 5.1, 10: 5.8, 12: 6.2, 14: 6.5, 16: 6.6 } },
  { twa: 60,  speeds: { 6: 4.6, 8: 5.5, 10: 6.1, 12: 6.5, 14: 6.8, 16: 6.9 } },
  { twa: 75,  speeds: { 6: 5.0, 8: 5.9, 10: 6.4, 12: 6.7, 14: 7.0, 16: 7.1 } },
  { twa: 90,  speeds: { 6: 5.2, 8: 6.1, 10: 6.6, 12: 6.9, 14: 7.1, 16: 7.2 } },
  { twa: 110, speeds: { 6: 5.0, 8: 6.0, 10: 6.6, 12: 7.0, 14: 7.3, 16: 7.4 } },
  { twa: 120, speeds: { 6: 4.8, 8: 5.8, 10: 6.5, 12: 6.9, 14: 7.3, 16: 7.5 } },
  { twa: 135, speeds: { 6: 4.3, 8: 5.4, 10: 6.2, 12: 6.7, 14: 7.1, 16: 7.4 } },
  { twa: 150, speeds: { 6: 3.8, 8: 4.9, 10: 5.7, 12: 6.3, 14: 6.8, 16: 7.1 } },
  { twa: 180, speeds: { 6: 3.2, 8: 4.1, 10: 4.9, 12: 5.5, 14: 6.0, 16: 6.3 } },
]

// Ys.II polar (800-1200 kg, ~6.5m)
export const YS2_POLAR: PolarPoint[] = [
  { twa: 52,  speeds: { 6: 3.6, 8: 4.4, 10: 5.0, 12: 5.4, 14: 5.6, 16: 5.7 } },
  { twa: 60,  speeds: { 6: 4.0, 8: 4.8, 10: 5.3, 12: 5.7, 14: 5.9, 16: 6.0 } },
  { twa: 75,  speeds: { 6: 4.3, 8: 5.1, 10: 5.6, 12: 5.9, 14: 6.1, 16: 6.2 } },
  { twa: 90,  speeds: { 6: 4.4, 8: 5.3, 10: 5.7, 12: 6.0, 14: 6.2, 16: 6.3 } },
  { twa: 110, speeds: { 6: 4.3, 8: 5.2, 10: 5.7, 12: 6.1, 14: 6.3, 16: 6.4 } },
  { twa: 120, speeds: { 6: 4.1, 8: 5.0, 10: 5.6, 12: 6.0, 14: 6.3, 16: 6.4 } },
  { twa: 135, speeds: { 6: 3.7, 8: 4.6, 10: 5.3, 12: 5.8, 14: 6.1, 16: 6.3 } },
  { twa: 150, speeds: { 6: 3.2, 8: 4.1, 10: 4.8, 12: 5.3, 14: 5.7, 16: 6.0 } },
  { twa: 180, speeds: { 6: 2.7, 8: 3.5, 10: 4.1, 12: 4.7, 14: 5.1, 16: 5.4 } },
]

// Ys.III polar (400-800 kg, ~5.5m)
export const YS3_POLAR: PolarPoint[] = [
  { twa: 52,  speeds: { 6: 2.8, 8: 3.5, 10: 4.0, 12: 4.3, 14: 4.5, 16: 4.6 } },
  { twa: 60,  speeds: { 6: 3.2, 8: 3.9, 10: 4.3, 12: 4.6, 14: 4.8, 16: 4.9 } },
  { twa: 75,  speeds: { 6: 3.5, 8: 4.1, 10: 4.6, 12: 4.8, 14: 5.0, 16: 5.1 } },
  { twa: 90,  speeds: { 6: 3.6, 8: 4.3, 10: 4.7, 12: 5.0, 14: 5.1, 16: 5.2 } },
  { twa: 110, speeds: { 6: 3.5, 8: 4.2, 10: 4.7, 12: 5.0, 14: 5.2, 16: 5.3 } },
  { twa: 120, speeds: { 6: 3.3, 8: 4.0, 10: 4.5, 12: 4.9, 14: 5.1, 16: 5.3 } },
  { twa: 135, speeds: { 6: 2.9, 8: 3.7, 10: 4.2, 12: 4.6, 14: 4.9, 16: 5.1 } },
  { twa: 150, speeds: { 6: 2.5, 8: 3.2, 10: 3.8, 12: 4.2, 14: 4.5, 16: 4.8 } },
  { twa: 180, speeds: { 6: 2.1, 8: 2.7, 10: 3.2, 12: 3.7, 14: 4.0, 16: 4.3 } },
]

/** Interpolált sebesség a polar táblázatból
 * @param polar - polar adatok
 * @param twa - szélirány szög (0-180)
 * @param tws - szélsebesség csomóban
 * @returns hajósebesség csomóban
 */
export function interpolatePolar(polar: PolarPoint[], twa: number, tws: number): number {
  // TWA klampelés
  const absTwa = Math.abs(twa)
  const clampedTwa = Math.min(180, Math.max(0, absTwa))

  // Szélben (< 40 fok) nem lehet vitorlázni
  if (clampedTwa < 40) return 0

  // TWA interpoláció
  let lower = polar[0], upper = polar[polar.length - 1]
  for (let i = 0; i < polar.length - 1; i++) {
    if (polar[i].twa <= clampedTwa && polar[i + 1].twa >= clampedTwa) {
      lower = polar[i]
      upper = polar[i + 1]
      break
    }
  }

  const twaSpeeds = [6, 8, 10, 12, 14, 16]
  const clampedTws = Math.min(16, Math.max(6, tws))

  // TWS interpoláció
  let tws1 = twaSpeeds[0], tws2 = twaSpeeds[twaSpeeds.length - 1]
  for (let i = 0; i < twaSpeeds.length - 1; i++) {
    if (twaSpeeds[i] <= clampedTws && twaSpeeds[i + 1] >= clampedTws) {
      tws1 = twaSpeeds[i]
      tws2 = twaSpeeds[i + 1]
      break
    }
  }

  const t = tws1 === tws2 ? 0 : (clampedTws - tws1) / (tws2 - tws1)
  const lSpeed = lower.speeds[tws1] + t * (lower.speeds[tws2] - lower.speeds[tws1])
  const uSpeed = upper.speeds[tws1] + t * (upper.speeds[tws2] - upper.speeds[tws1])

  const u = lower.twa === upper.twa ? 0 : (clampedTwa - lower.twa) / (upper.twa - lower.twa)
  return lSpeed + u * (uSpeed - lSpeed)
}

// =====================================================
// REEF & FOCKROLLER RENDSZER - V3
// =====================================================

/** Gross reef fokozat (0=teljes, 1=Reef1, 2=Reef2, 3=Reef3/Storm) */
export type GrossReef = 0 | 1 | 2 | 3

/** Fockroller állás (0-100%): 0=le, 15=vihar fock, 40=fock, 65=rolled genua, 100=teljes genua */
export type FockrollerPct = number  // 0-100

/** Ajánlott gross reef az aktuális TWS alapján */
export function recommendGrossReef(tws: number): GrossReef {
  if (tws > 28) return 3
  if (tws > 22) return 2
  if (tws > 16) return 1
  return 0
}

/** Gross reef area szorzó (vitorlafelület arány) */
export function grossReefMultiplier(reef: GrossReef): number {
  if (reef === 3) return 0.4
  if (reef === 2) return 0.6
  if (reef === 1) return 0.8
  return 1.0
}

/** Fockroller % → hatékonysági szorzó és típus */
export function fockrollerEfficiency(pct: number): { multiplier: number; type: 'none' | 'storm' | 'fock' | 'rolled_genua' | 'genua' } {
  if (pct <= 0)   return { multiplier: 0,    type: 'none' }
  if (pct <= 20)  return { multiplier: 0.55, type: 'storm' }
  if (pct <= 50)  return { multiplier: 0.85, type: 'fock' }
  if (pct <= 80)  return { multiplier: 0.92, type: 'rolled_genua' }
  return             { multiplier: 1.0,  type: 'genua' }
}

/** Ajánlott fockroller % az AWS és AWA alapján */
export function recommendFockrollerPct(awa: number, aws: number): number {
  const abs = Math.abs(awa)
  if (aws > 26) return 40   // heavy: fock méret
  if (aws > 20) return 55   // rolled genua
  if (aws > 14 && abs <= 60) return 55  // upwind erős: rolled
  return 100                // teljes genua
}

/** Gross reef penalty ha nincs meg a szükséges reef */
export function calcReefPenalty(grossReef: GrossReef, tws: number): {
  sogMultiplier: number; heelAdd: number; warning: string | null; danger: boolean
} {
  const needed = recommendGrossReef(tws)
  const missing = needed - grossReef
  if (missing <= 0) {
    // Túl sok reef — kis sebességveszteség (felesleges felületveszteség)
    const over = grossReef - needed
    return { sogMultiplier: over > 0 ? 0.92 : 1.0, heelAdd: 0, warning: over > 0 ? 'Felesleges reef — veszítesz sebességet' : null, danger: false }
  }
  if (missing === 1) return { sogMultiplier: 0.85, heelAdd: 12, warning: 'Reffelj! Túl nagy vitorlafelület a szélhez', danger: false }
  if (missing === 2) return { sogMultiplier: 0.60, heelAdd: 25, warning: '⚠ Veszélyes! Azonnali reeffelés szükséges!', danger: true }
  return { sogMultiplier: 0.30, heelAdd: 40, warning: '🆘 KRITIKUS! Vitorlaszakadás / borulás veszélye!', danger: true }
}

/** Optimális vitorla ajánlás — V2 mátrix alapján (AWA fokban, AWS csomóban) */
/** Optimális vitorla ajánlás — V2 mátrix alapján (AWA fokban, AWS csomóban) */
export function recommendSails(twa: number, tws: number): {
  gross: boolean, fock: boolean, genua: boolean, spinn: boolean, genakker: boolean
} {
  const abs = Math.abs(twa)

  // Holttér (0–34°) — nem lehet vitorlázni
  if (abs < 35) return { gross: true, fock: true, genua: false, spinn: false, genakker: false }

  // Negyedszél (35–60°) — gross kötelező, fock/genua szélsebesség alapján
  if (abs <= 60) {
    return { gross: true, fock: tws >= 13.5, genua: tws < 13.5, spinn: false, genakker: false }
  }

  // Félszél (61–100°) — gross + headsail + esetleg genakker könnyű szélben
  if (abs <= 100) {
    const genakker = tws < 12.0
    const fock = tws > 15.0
    const genua = !fock
    return { gross: true, fock, genua: genua && !genakker, spinn: false, genakker }
  }

  // Háromnegyedszél / raum (101–145°) — genakker erős szélig, felette fock
  if (abs <= 145) {
    return { gross: true, fock: tws >= 19.0, genua: false, spinn: false, genakker: tws < 19.0 }
  }

  // Hátszél (146–180°) — spinnaker könnyű szélben, genakker erősebben
  return { gross: true, fock: false, genua: false, spinn: tws < 16.0, genakker: tws >= 16.0 }
}

/** Vitorla penalty ellenőrzés — hibás vitorlaválasztás esetén szorzó
 * @returns 1.0 = OK, 0.4 = súlyos penalty (drag + broach risk)
 */
export function calcSailPenalty(sails: {
  gross: boolean, fock: boolean, genua: boolean, spinn: boolean, genakker: boolean
}, twa: number, tws: number): { multiplier: number; warning: string | null } {
  const abs = Math.abs(twa)

  // Kizárólagossági szabályok
  if (sails.genua && sails.fock)     return { multiplier: 0.4, warning: 'Genua és fock egyszerre nem lehetséges!' }
  if (sails.spinn && sails.genakker) return { multiplier: 0.4, warning: 'Spinnaker és genakker egyszerre nem lehetséges!' }
  if (sails.spinn && sails.genua)    return { multiplier: 0.4, warning: 'Spinnaker és genua egyszerre nem lehetséges!' }

  // Holttér
  if (abs < 35) return { multiplier: 0.0, warning: 'Holttér — nem lehet vitorlázni!' }

  // Genua erős szélben negyedszélben
  if (abs <= 60 && sails.genua && tws >= 13.5)
    return { multiplier: 0.4, warning: 'Genua túl erős szélben — válts fockra!' }

  // Genua erős szélben félszélben
  if (abs <= 100 && sails.genua && tws > 15.0)
    return { multiplier: 0.4, warning: 'Genua túl erős szélben — válts fockra!' }

  // Genakker erős szélben raumban
  if (abs <= 145 && sails.genakker && tws >= 19.0)
    return { multiplier: 0.5, warning: 'Genakker veszélyes erős szélben — dobd le!' }

  // Spinnaker erős szélben
  if (abs >= 146 && sails.spinn && tws >= 16.0)
    return { multiplier: 0.5, warning: 'Spinnaker veszélyes erős szélben — válts genakkerre!' }

  // Downwind vitorla upwind pozícióban
  if (abs < 90 && (sails.spinn || sails.genakker))
    return { multiplier: 0.4, warning: 'Bőszeles vitorla szélbe fordulásnál — nem hatékony!' }

  return { multiplier: 1.0, warning: null }
}
