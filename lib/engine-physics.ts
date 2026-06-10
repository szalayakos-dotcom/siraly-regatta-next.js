// Fizikai motor — trim és drift számítások

import { interpolatePolar, YS1_POLAR, YS2_POLAR, YS3_POLAR, kmhToKnots, recommendSails, calcSailPenalty, grossReefMultiplier, calcReefPenalty, fockrollerEfficiency, GrossReef, FockrollerPct } from './units'

export type BoatClass = 'ys1' | 'ys2' | 'ys3'

export interface SailState {
  gross: boolean
  fock: boolean
  genua: boolean
  spinn: boolean
  genakker: boolean
}

export interface TrimState {
  mainsheet: number
  jibtrim: number
  boomvang: number
  backstay: number
  cunningham: number
  spinnshot: number
  genakkershot: number
  grossReef: GrossReef        // 0-3
  fockrollerPct: FockrollerPct // 0-100 (ha van fockroller), -1 ha nincs
  hasFockroller: boolean
}

export interface PhysicsResult {
  boatSpeed: number      // csomó
  driftAngle: number     // fok
  cog: number            // valódi haladási irány (fok)
  heel: number           // dőlési szög (fok)
  leszurasRisk: boolean  // leszúrás veszély
  speedEfficiency: number // 0-1 szorzó
  sailPenalty: number    // 1.0=OK, <1=penalty
  sailWarning: string | null // penalty figyelmeztetés
  reefWarning: string | null // reef figyelmeztetés
  reefDanger: boolean        // kritikus reef hiány
}

/** Optimális trim értékek adott szélirányban */
function getOptimalTrim(twa: number, tws: number): TrimState {
  const abs = Math.abs(twa)
  const strong = tws > 12
  const light = tws < 8

  if (abs < 70) return { mainsheet:88, jibtrim:85, boomvang:55, backstay:78, cunningham:65, spinnshot:0, genakkershot:0 }
  if (abs < 100) return { mainsheet:68, jibtrim:62, boomvang:55, backstay:78, cunningham:65, spinnshot:0, genakkershot: light ? 50 : 0 }
  if (abs < 140) return { mainsheet:45, jibtrim:40, boomvang:60, backstay:35, cunningham:20, spinnshot:0, genakkershot: abs < 130 ? 60 : 50 }
  if (abs < 160) return { mainsheet:30, jibtrim:25, boomvang:72, backstay:22, cunningham:12, spinnshot:45, genakkershot:40 }
  return { mainsheet:18, jibtrim:15, boomvang:85, backstay:15, cunningham:8, spinnshot:32, genakkershot:0 }
}

/** Trim hatékonyság 0-100 */
export function calcTrimEfficiency(
  sails: SailState,
  trim: TrimState,
  twa: number,
  tws: number
): number {
  if (!Object.values(sails).some(Boolean)) return 0

  const optimal = getOptimalTrim(twa, tws)
  const keys: (keyof TrimState)[] = [
    'mainsheet', 'boomvang', 'backstay', 'cunningham',
    ...(sails.fock || sails.genua ? ['jibtrim' as keyof TrimState] : []),
    ...(sails.spinn ? ['spinnshot' as keyof TrimState] : []),
    ...(sails.genakker ? ['genakkershot' as keyof TrimState] : []),
  ].filter(k => optimal[k] > 0)

  if (!keys.length) return 75

  const diffs = keys.map(k => Math.abs(trim[k] - optimal[k]))
  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length
  const trimBonus = Math.round((1 - avgDiff / 100) * 25)

  // Vitorla match
  const rec = recommendSails(twa, tws)
  const sailMatch = rec.gross === sails.gross && rec.fock === sails.fock &&
    rec.genua === sails.genua && rec.spinn === sails.spinn && rec.genakker === sails.genakker
  const base = sailMatch ? 75 : Math.max(20, 45)

  return Math.min(100, base + trimBonus)
}

/** Fő fizikai számítás */
export function calcPhysics(
  boatClass: BoatClass,
  sails: SailState,
  trim: TrimState,
  hdg: number,          // hajó iránya (fok)
  windDir: number,       // szélirány (fok)
  windSpeedKn: number,   // szélsebesség (csomó)
): PhysicsResult {
  // Ha nincs vitorla → áll
  if (!Object.values(sails).some(Boolean)) {
    return { boatSpeed: 0, driftAngle: 0, cog: hdg, heel: 0, leszurasRisk: false, speedEfficiency: 0, sailPenalty: 1, sailWarning: null, reefWarning: null, reefDanger: false }
  }

  // TWA számítás
  const rawTwa = windDir - hdg
  const twa = ((rawTwa + 180) % 360) - 180  // -180..+180
  const absTwa = Math.abs(twa)

  // Polar sebesség
  const polar = boatClass === 'ys1' ? YS1_POLAR : boatClass === 'ys2' ? YS2_POLAR : YS3_POLAR
  const idealSpeed = interpolatePolar(polar, absTwa, windSpeedKn)

  // Gross reef
  const grossReef = (trim.grossReef ?? 0) as GrossReef
  const reefAreaMult = grossReefMultiplier(grossReef)
  const { sogMultiplier: reefSogMult, heelAdd: reefHeelAdd, warning: reefWarning, danger: reefDanger } = calcReefPenalty(grossReef, windSpeedKn)

  // Fockroller (ha van)
  const hasFockroller = trim.hasFockroller ?? false
  const fockrollerPct = hasFockroller ? (trim.fockrollerPct ?? 100) : -1
  const fockrollerMult = hasFockroller
    ? fockrollerEfficiency(fockrollerPct).multiplier
    : (sails.fock || sails.genua ? 1.0 : 0.9)  // fockroller nélkül fock/genua normál, semmi = kis veszteség

  // Sail penalty ellenőrzés
  const { multiplier: sailPenaltyMult, warning: sailWarning } = calcSailPenalty(sails, twa, windSpeedKn)

  // Ideal speed módosítása reef és fockroller alapján
  const adjustedIdealSpeed = idealSpeed * reefAreaMult * fockrollerMult

  // Trim hatékonyság
  const trimEff = calcTrimEfficiency(sails, trim, twa, windSpeedKn)
  const trimMult = 0.6 + (trimEff / 100) * 0.4  // 60-100% sebesség sávban

  // Oldalirányú erő (F_side)
  const fSide = windSpeedKn * Math.sin((absTwa * Math.PI) / 180)

  // Dőlés (heel) - trim minőségétől függ
  const trimPenalty = 1 - trimEff / 100
  const heel = Math.min(45, fSide * (1 - 0.35) * (1 + trimPenalty * 2.5) + reefHeelAdd)

  // Drift szög
  const driftAngle = heel > 5
    ? Math.max(0, 0.3 * fSide * Math.tan((Math.min(heel, 35) * Math.PI) / 180))
    : 0

  // Sebesség drift büntetéssel
  const driftMult = Math.cos((driftAngle * Math.PI) / 180)
  const boatSpeed = Math.max(0, adjustedIdealSpeed * trimMult * driftMult * sailPenaltyMult * reefSogMult)

  // COG = HDG ± drift (szél irányától függően)
  const driftSign = twa > 0 ? 1 : -1  // jobb/balcsapás
  const cog = (hdg + driftSign * driftAngle + 360) % 360

  // Leszúrás veszély: hátszél + rossz trim + spinnaker
  const leszurasRisk = absTwa > 150 && trimEff < 55 && (sails.spinn || sails.gross)

  return {
    boatSpeed: Math.round(boatSpeed * 100) / 100,
    driftAngle: Math.round(driftAngle * 10) / 10,
    cog: Math.round(cog * 10) / 10,
    heel: Math.round(heel * 10) / 10,
    leszurasRisk,
    speedEfficiency: Math.round(trimMult * driftMult * sailPenaltyMult * reefSogMult * 100),
    sailPenalty: sailPenaltyMult,
    sailWarning,
    reefWarning,
    reefDanger,
  }
}
