'use client'

import { useEffect, useState } from 'react'
import { Panel } from './panel'
import { getPocketBase } from '@/lib/pocketbase'
import { useRace } from '@/components/race-context'
import { recommendSails, kmhToKnots, YS1_POLAR, interpolatePolar, grossReefMultiplier, fockrollerEfficiency, type GrossReef } from '@/lib/units'
import { calcPhysics, WarningState } from '@/lib/engine-physics'
import type { WarningState as WS } from '@/components/warning-panel'
import { cn } from '@/lib/utils'
import { TrimFader } from '@/components/trim-fader'

export interface SailState {
  gross: boolean
  fock: boolean
  genua: boolean
  spinn: boolean
  genakker: boolean
}

interface TrimState {
  mainsheet: number
  jibtrim: number
  boomvang: number
  backstay: number
  cunningham: number
  spinnshot: number
  genakkershot: number
  grossReef: GrossReef
  fockReef: 0 | 1 | 2  // 0=teljes, 1=kis fock, 2=vihar fock
  fockrollerPct: number
  hasFockroller: boolean
}

function calcOptimalTrim(twa: number, tws: number): TrimState {
  const abs = Math.abs(twa)
  // Upwind
  if (abs < 70) return { mainsheet: 85, jibtrim: 80, boomvang: 60, backstay: 75, cunningham: 50, spinnshot: 0, genakkershot: 0, grossReef: 0 as GrossReef, fockReef: 0 as (0|1|2), fockrollerPct: 100, hasFockroller: false }
  // Beam reach
  if (abs < 110) return { mainsheet: 65, jibtrim: 55, boomvang: 45, backstay: 50, cunningham: 30, spinnshot: 0, genakkershot: 0, grossReef: 0 as GrossReef, fockReef: 0 as (0|1|2), fockrollerPct: 100, hasFockroller: false }
  // Broad reach
  if (abs < 150) return { mainsheet: 45, jibtrim: 35, boomvang: 70, backstay: 30, cunningham: 15, spinnshot: 50, genakkershot: 50, grossReef: 0 as GrossReef, fockReef: 0 as (0|1|2), fockrollerPct: 100, hasFockroller: false }
  // Downwind
  return { mainsheet: 30, jibtrim: 20, boomvang: 85, backstay: 20, cunningham: 10, spinnshot: 30, genakkershot: 0, grossReef: 0 as GrossReef, fockReef: 0 as (0|1|2), fockrollerPct: 100, hasFockroller: false }
}

function TrimSlider({ label, value, onChange, disabled, leftLabel, rightLabel }: {
  label: string, value: number, onChange: (v: number) => void,
  disabled?: boolean, leftLabel?: string, rightLabel?: string
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", disabled && "opacity-30 pointer-events-none")}>
      <div className="flex items-center gap-3">
        <span className="label-caps w-28 shrink-0 text-[9px] text-muted-foreground">{label}</span>
        <div className="relative flex-1">
          <input
            type="range" min={0} max={100} value={value}
            disabled={disabled}
            onChange={e => onChange(Number(e.target.value))}
            className="w-full h-2 appearance-none rounded-sm bg-border cursor-pointer disabled:cursor-not-allowed"
            style={{ accentColor: 'var(--color-secondary)' }}
          />
        </div>
        <span className="w-8 shrink-0 text-right font-heading text-sm font-semibold text-foreground">{value}</span>
      </div>
      {(leftLabel || rightLabel) && (
        <div className="flex justify-between pr-8" style={{ paddingLeft: '7rem' }}>
          <span className="label-caps text-[8px] text-muted-foreground/50">{leftLabel}</span>
          <span className="label-caps text-[8px] text-muted-foreground/50">{rightLabel}</span>
        </div>
      )}
    </div>
  )
}

export interface TrimSnapshot { sails: SailState; trim: TrimState; windDir: number; windSpeedKn: number }

export function SailTrim({ onWarningsChange, onTrimChange }: {
  onWarningsChange?: (w: WS) => void
  onTrimChange?: (snapshot: TrimSnapshot) => void
}) {
  const [mounted, setMounted] = useState(false)
  const { raceId } = useRace()
  const [sails, setSails] = useState<SailState>({ gross: true, fock: true, genua: false, spinn: false, genakker: false })
  const [trim, setTrim] = useState<TrimState>({ mainsheet: 78, jibtrim: 64, boomvang: 52, backstay: 71, cunningham: 40, spinnshot: 50, genakkershot: 50, grossReef: 0, fockReef: 0, fockrollerPct: 100, hasFockroller: false })
  const [hasFockroller, setHasFockroller] = useState(false)
  const [windDir, setWindDir] = useState(225)
  const [windSpeedKn, setWindSpeedKn] = useState(10)
  const [credits, setCredits] = useState(0)
  const [trimEfficiency, setTrimEfficiency] = useState(0)

  useEffect(() => { setMounted(true) }, [])



  useEffect(() => {
    if (!mounted) return
    const pb = getPocketBase()
    pb.collection('weather_segments').getFullList({
      filter: `race_id="${raceId}"`, sort: 'from_cp_index',
    }).then(segs => {
      if (segs.length) {
        setWindDir(segs[0].wind_dir)
        setWindSpeedKn(kmhToKnots(segs[0].wind_speed))
      }
    }).catch(() => {})

    if (pb.authStore.isValid) {
      pb.collection('player_races').getList(1, 1, {
        filter: `race_id="${raceId}" && player_id="${pb.authStore.record?.id}"`,
      }).then(pr => {
        if (pr.items.length) setCredits(pr.items[0].credits || 0)
      }).catch(() => {})
    }
  }, [mounted])

  // Optimális Trim — vitorlaválasztás (max 75%) + trim (extra 25%)
  useEffect(() => {
    if (!mounted) return
    const activeSailCount = Object.values(sails).filter(Boolean).length
    if (activeSailCount === 0) {
      setTrimEfficiency(0)
      onWarningsChange?.({ vihar:0, leszuras:false, drift:0, vitorla:false, tuldoles:false, trimEfficiency:0 })
      return
    }

    const rec = recommendSails(windDir, windSpeedKn)
    const sailMatch =
      rec.gross === sails.gross &&
      rec.fock === sails.fock &&
      rec.genua === sails.genua &&
      rec.spinn === sails.spinn &&
      rec.genakker === sails.genakker

    const optimal = calcOptimalTrim(windDir, windSpeedKn)
    const activeTrimKeys = [
      'mainsheet', 'boomvang', 'backstay', 'cunningham',
      ...(sails.fock || sails.genua ? ['jibtrim'] : []),
      ...(sails.spinn ? ['spinnshot'] : []),
      ...(sails.genakker ? ['genakkershot'] : []),
    ] as (keyof TrimState)[]

    const diffs = activeTrimKeys
      .filter(k => typeof optimal[k] === 'number' && optimal[k] > 0)
      .map(k => Math.abs((trim[k] ?? 50) - optimal[k]))
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length
    const trimBonus = Math.round((1 - avgDiff / 100) * 25)

    const base = sailMatch ? 75 : Math.max(20, 55 - (activeSailCount === 0 ? 55 : 0))
    const eff = Math.min(100, base + trimBonus)
    setTrimEfficiency(eff)
    const rawTwa = windDir - 247
    const twaForWarning = Math.abs(((rawTwa + 180) % 360) - 180)
    onWarningsChange?.({
      vihar: 0,
      leszuras: twaForWarning > 150 && eff < 55 && (sails.spinn || sails.gross),
      drift: 0,
      vitorla: Object.values(sails).some(Boolean),
      tuldoles: false,
      trimEfficiency: eff,
    })
    onTrimChange?.({ sails, trim, windDir, windSpeedKn })
  }, [trim, sails, windDir, windSpeedKn])

  function toggle(sail: keyof SailState) {
    setSails(prev => {
      const next = { ...prev }
      if (sail === 'fock') { if (!prev.fock) { next.fock = true; next.genua = false } else next.fock = false }
      else if (sail === 'genua') { if (!prev.genua) { next.genua = true; next.fock = false; next.genakker = false } else next.genua = false }
      else if (sail === 'spinn') { if (!prev.spinn) { next.spinn = true; next.genakker = false; next.fock = false; next.genua = false } else next.spinn = false }
    else if (sail === 'genua') { if (!prev.genua) { next.genua = true; next.fock = false; next.genakker = false; next.spinn = false } else next.genua = false }
      else if (sail === 'genakker') { if (!prev.genakker) { next.genakker = true; next.spinn = false; next.genua = false } else next.genakker = false }
      else if (sail === 'gross') next.gross = !prev.gross
      return next
    })
  }

  const activeSails = Object.entries(sails).filter(([, v]) => v).map(([k]) => k.toUpperCase())
  const isStalled = activeSails.length === 0

  async function buyOptimalTrim() {
    if (credits < 10) { alert('Nincs elég kredit. Optimális trim: 10 kr'); return }
    const optimal = calcOptimalTrim(windDir, windSpeedKn)
    setTrim(optimal)
    const rec = recommendSails(windDir, windSpeedKn)
    setSails(rec)
    setCredits(c => c - 10)
    setTrimEfficiency(100)
    try {
      const pb = getPocketBase()
      if (pb.authStore.isValid) {
        const pr = await pb.collection('player_races').getList(1, 1, {
          filter: `race_id="${raceId}" && player_id="${pb.authStore.record?.id}"`,
        })
        if (pr.items.length) {
          await pb.collection('player_races').update(pr.items[0].id, { credits: credits - 10 })
        }
      }
    } catch (e) {}
  }

  async function confirmSailChange() {
    if (!confirm('Vitorlacsere menet közben: 60 perc penalty. Folytatod?')) return
    try {
      const pb = getPocketBase()
      if (pb.authStore.isValid) {
        const pr = await pb.collection('player_races').getList(1, 1, {
          filter: `race_id="${raceId}" && player_id="${pb.authStore.record?.id}"`,
        })
        if (pr.items.length) {
          await pb.collection('player_races').update(pr.items[0].id, {
            total_time_penalty: (pr.items[0].total_time_penalty || 0) + 60
          })
        }
      }
    } catch (e) {}
  }

  if (!mounted) return null

  return (
    <Panel
      title="Vitorlaválasztó & Trim"
      code="RIG"
      action={
        <span className={cn('label-caps text-[9px]', isStalled ? 'text-destructive' : 'text-secondary')}>
          {isStalled ? '⚠ HAJÓ ÁLL' : activeSails.join(' · ')}
        </span>
      }
      bodyClassName="p-0 overflow-hidden"
      style={{ height: '100%' }}
    >
      <div style={{ display: 'flex', height: '100%' }}>

        {/* BAL: Hajó SVG + csere gombok */}
        <div style={{
          width: '150px', flexShrink: 0,
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          padding: '10px 8px', gap: '8px',
        }}>
          {/* Hajó SVG */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 1200 1000 1201" xmlns="http://www.w3.org/2000/svg" style={{ height: '100%', maxHeight: '320px', width: 'auto' }}>
              <g id="layer-fock" opacity={sails.fock && !sails.genua ? 1 : 0}>
                <path fill="#d8d4c0" d="M 256.765625 2247.796875 C 290.398438 2242.6875 467.84375 2215.492188 468.113281 2210.660156 C 468.410156 2205.320312 459.214844 2204.136719 439.046875 2049.3125 C 404.359375 1783.0625 433.90625 1582.378906 459.515625 1316.71875 C 375.632812 1628.0625 302.378906 1923.378906 252.34375 2241.996094 C 251.039062 2250.308594 249.503906 2248.898438 256.765625 2247.796875"/>
              </g>
              <g id="layer-genua" opacity={sails.genua ? 1 : 0} transform="matrix(1.0180583,0,0,1,-4.6665952,0)">
                <path fill="#b7c8be" transform="matrix(1.14,0,0,1.1,-28,-80)" d="m 337.55096,2127.3857 c 36.19743,3.0082 113.6228,-2.5401 113.89233,-7.3721 0.29688,-5.3399 46.24076,17.8293 27.35509,-50.4071 -29.55827,-252.7206 -78.23211,-546.7567 -52.62274,-812.4168 -83.88281,311.3437 -152.00748,549.8368 -202.04264,868.454 -1.30469,8.3125 47.17012,1.4906 86.48951,-3.6697"/>
              </g>
              <g id="layer-spinn" opacity={sails.spinn ? 1 : 0}>
                <path fill="#80e5ff" opacity={0.85} transform="matrix(-1.4,0,0,1.15,930,-207)" d="m 667.77344,2191.4297 c -56.98047,6.9141 -325.65173,-13.5714 -325.57751,-57.3605 l -11.28749,-821.1474 201.90873,213.2364 47.6091,62.1981 47.17804,121.798 24.21472,169.4153 -16.96639,255.7647 c -13.92785,43.8491 -51.34761,51.7427 -76.57026,54.8013"/>
              </g>
              <g id="layer-genakker" opacity={sails.genakker ? 1 : 0} transform="matrix(1.2479626,0,0,0.81888334,122.14941,305.14454)">
                <path fill="#d4ff2a" opacity={0.85} d="m 166.56783,2308.2364 c 50.8893,-29.7323 73.42152,-55.9344 96.2366,-75.3782 l 14.04864,-1023.4666 -179.121186,266.37 -99.595155,240.4472 c -23.895147,138.6987 23.523209,696.5357 42.023327,659.2709"/>
              </g>
              <g id="layer-genua" opacity={sails.genua ? 1 : 0}>
                <path fill="#c8d4b8" d="M 220.0 2255.0 C 260.0 2248.0 467.84375 2215.492188 468.113281 2210.660156 C 468.410156 2205.320312 459.214844 2204.136719 430.0 2020.0 C 388.0 1740.0 425.0 1530.0 459.515625 1316.71875 C 360.0 1650.0 270.0 1960.0 212.0 2248.0 C 210.0 2258.0 208.0 2256.5 220.0 2255.0"/>
              </g>
              <g id="layer-gross" opacity={sails.gross ? 1 : 0}>
                <path fill="#e8dfc0" d="M 667.773438 2191.429688 C 610.792969 2198.34375 468.621094 2232.210938 468.695312 2188.421875 L 470.164062 1343.980469 L 680.5625 2163.804688 C 686.832031 2188.242188 692.996094 2188.371094 667.773438 2191.429688"/>
              </g>
              <g id="base">
                <path fill="#111" d="M 279.445312 2331.09375 C 302.335938 2334.351562 390.03125 2346.601562 448.664062 2351.71875 C 516.585938 2357.652344 691.871094 2367.441406 739.328125 2366.847656 C 762.539062 2366.558594 864.289062 2370.84375 830.53125 2322.804688 C 825.078125 2315.050781 815.929688 2303.445312 811.027344 2297.304688 C 805.242188 2290.050781 806.8125 2294.101562 795.378906 2294.585938 C 788.132812 2294.890625 788.621094 2293.992188 788.945312 2287.234375 C 789.277344 2280.363281 791.070312 2281.769531 784.578125 2281.328125 C 765.371094 2280.023438 693.703125 2275.09375 665.902344 2272.46875 C 650.398438 2271.007812 654.851562 2271.480469 646.300781 2256.242188 C 639.882812 2244.800781 643.609375 2247.210938 630.632812 2246.414062 C 580.878906 2243.363281 510.09375 2237.421875 467.957031 2261.457031 C 455.21875 2268.722656 460.234375 2268.78125 446.882812 2268.902344 C 413.574219 2269.203125 296.296875 2270.347656 261.828125 2271.898438 C 250.726562 2272.394531 251.273438 2270.546875 254.390625 2279.128906 C 258.550781 2290.5625 267.621094 2314.199219 271.726562 2324.863281 C 274.34375 2331.648438 272.316406 2330.082031 279.445312 2331.09375"/>
                <path fill="#111" d="M 462.964844 1298.339844 L 467.496094 1298.339844 C 469.390625 1298.339844 470.945312 1299.890625 470.945312 1301.789062 L 470.945312 2314.734375 C 470.945312 2316.632812 469.390625 2318.1875 467.496094 2318.1875 L 462.964844 2318.1875 C 461.066406 2318.1875 459.515625 2316.632812 459.515625 2314.734375 L 459.515625 1301.789062 C 459.515625 1299.890625 461.066406 1298.339844 462.964844 1298.339844"/>
              </g>
            </svg>
          </div>

          {/* Vitorlacsere gombok */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '8px', letterSpacing: '2px', color: 'var(--muted-foreground)' }}>ORR VITORLA</p>
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['fock', 'genua'] as const).map(s => (
                <button key={s} onClick={() => toggle(s)}
                  className={cn('flex-1 rounded-sm border py-2 font-heading text-sm font-bold uppercase transition-colors',
                    sails[s] ? 'border-secondary bg-secondary/20 text-secondary' : 'border-border bg-background/50 text-muted-foreground')}>
                  {s}
                </button>
              ))}
            </div>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '8px', letterSpacing: '2px', color: 'var(--muted-foreground)', marginTop: '2px' }}>HÁTSZÉL</p>
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['spinn', 'genakker'] as const).map(s => (
                <button key={s} onClick={() => toggle(s)}
                  className={cn('flex-1 rounded-sm border py-2 font-heading text-sm font-bold uppercase transition-colors',
                    sails[s] ? 'border-accent bg-accent/20 text-accent' : 'border-border bg-background/50 text-muted-foreground')}>
                  {s === 'spinn' ? 'Spin' : 'Gena'}
                </button>
              ))}
            </div>
            <button onClick={confirmSailChange}
              style={{ background: 'var(--foreground)', color: 'var(--background)', border: 'none', borderRadius: '4px', padding: '10px', fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: '12px', letterSpacing: '2px', cursor: 'pointer', marginTop: '4px' }}>
              CSERE — 60p
            </button>
          </div>
        </div>

        {/* KÖZÉP: Gross + Reef */}
        <div style={{
          width: '180px', flexShrink: 0,
          borderRight: '1px solid var(--border)',
          padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto',
        }}>
          {/* Főv vitorla */}
          <div>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '8px', letterSpacing: '2px', color: 'var(--muted-foreground)', marginBottom: '4px' }}>FŐ VITORLA</p>
            <button onClick={() => toggle('gross')}
              className={cn('w-full rounded-sm border py-2 font-heading text-sm font-bold uppercase transition-colors',
                sails.gross ? 'border-secondary bg-secondary/20 text-secondary' : 'border-border bg-background/50 text-muted-foreground')}>
              GROSS
            </button>
          </div>

          {/* Reef */}
          <div>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '8px', letterSpacing: '2px', color: 'var(--muted-foreground)', marginBottom: '4px' }}>REEF</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              {([0,1,2,3] as const).map(r => {
                const isActive = trim.grossReef === r
                const labels = ['Teljes','Ref 1','Ref 2','Vihar']
                return (
                  <button key={r} onClick={() => setTrim(prev => ({ ...prev, grossReef: r }))}
                    style={{
                      padding: '6px 4px', borderRadius: '3px', cursor: 'pointer',
                      border: `1px solid ${isActive ? 'var(--secondary)' : 'var(--border)'}`,
                      background: isActive ? 'rgba(var(--secondary-rgb),0.15)' : 'var(--background)',
                      color: isActive ? 'var(--secondary)' : 'var(--muted-foreground)',
                    }}>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', fontWeight: 900 }}>R{r}</div>
                    <div style={{ fontSize: '8px' }}>{labels[r]}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Fock reef */}
          {!hasFockroller && sails.fock && (
            <div>
              <p style={{ fontFamily: 'var(--font-heading)', fontSize: '8px', letterSpacing: '2px', color: 'var(--muted-foreground)', marginBottom: '4px' }}>FOCK REEF</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {([0,1,2] as const).map(r => {
                  const isActive = trim.fockReef === r
                  const labels = ['Teljes','Kis fock','Vihar']
                  return (
                    <button key={r} onClick={() => setTrim(prev => ({ ...prev, fockReef: r }))}
                      style={{
                        padding: '5px 6px', borderRadius: '3px', cursor: 'pointer',
                        display: 'flex', justifyContent: 'space-between',
                        border: `1px solid ${isActive ? '#4a9e6a' : 'var(--border)'}`,
                        background: isActive ? 'rgba(74,158,106,0.15)' : 'var(--background)',
                        color: isActive ? '#4a9e6a' : 'var(--muted-foreground)',
                      }}>
                      <span style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', fontWeight: 900 }}>F{r}</span>
                      <span style={{ fontSize: '8px' }}>{labels[r]}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* JOBB: Trim faderek */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px 8px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '8px', letterSpacing: '2px', color: 'var(--muted-foreground)' }}>OPTIMÁLIS TRIM</span>
            <span className={cn('font-heading text-xl font-bold',
              trimEfficiency >= 90 ? 'text-secondary' : trimEfficiency >= 70 ? 'text-accent' : 'text-destructive')}>
              {trimEfficiency}%
            </span>
          </div>
          <div style={{ flex: 1, display: 'flex', gap: '6px' }}>
            {([
              ['Gross-shot',  'mainsheet',    sails.gross],
              ['Fock/Genu',   'jibtrim',      !hasFockroller && (sails.fock || sails.genua)],
              ['Alba',        'boomvang',     sails.gross],
              ['Achter',      'backstay',     sails.gross],
              ['Cunningham',  'cunningham',   sails.gross],
              ['Spin-shot',   'spinnshot',    sails.spinn],
              ['Gena-shot',   'genakkershot', sails.genakker],
            ] as const).map(([label, key, active]) => (
              <TrimFader
                key={key}
                label={label}
                value={trim[key] as number}
                disabled={!active}
                height={300}
                onChange={v => { if (active) setTrim(prev => ({ ...prev, [key]: v })) }}
              />
            ))}
          </div>
          <button onClick={buyOptimalTrim}
            className="w-full rounded-sm border border-accent/40 bg-accent/10 px-3 py-2 font-heading text-[10px] font-semibold text-accent transition-colors hover:bg-accent/20 mt-2">
            ⭐ Optimális beállítás — 10 kr ({credits} kr)
          </button>
        </div>

      </div>
    </Panel>
  )
}
