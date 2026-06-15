'use client'

import { useEffect, useState } from 'react'
import { Panel } from './panel'
import { getPocketBase } from '@/lib/pocketbase'
import { useRace } from '@/components/race-context'
import { kmhToKnots } from '@/lib/units'

const D2R = Math.PI / 180
const polar = (deg: number, r: number, cx = 100, cy = 100) => {
  const a = (deg - 90) * D2R
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const
}

const ringTicks = Array.from({ length: 36 }, (_, i) => i * 10)
const cardinals: [string, number][] = [['É', 0], ['K', 90], ['D', 180], ['NY', 270]]

export function WindDial() {
  const { raceId } = useRace()
  const [mounted, setMounted] = useState(false)
  const [trueWindDir, setTrueWindDir] = useState(215)
  const [trueWindSpd, setTrueWindSpd] = useState(14)
  const [gusts, setGusts] = useState(19)
  const [hdg, setHdg] = useState(247)
  const [cog, setCog] = useState(247)
  const [driftAngle, setDriftAngle] = useState(0)
  const [sog, setSog] = useState(0)

  const appWindSpd = Math.round(trueWindSpd * 0.92 * 10) / 10
  const twaRaw = ((trueWindDir - hdg + 540) % 360) - 180
  const twaAbs = Math.abs(Math.round(twaRaw))
  const twaSide = twaRaw === 0 ? '' : twaRaw < 0 ? 'P' : 'S'

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted || !raceId) return
    const pb = getPocketBase()

    async function load() {
      try {
        const segs = await pb.collection('weather_segments').getFullList({
          filter: `race_id="${raceId}"`, sort: 'from_cp_index',
        })
        if (segs.length) {
          const s = segs[0]
          setTrueWindDir(s.wind_dir)
          setTrueWindSpd(Math.round(kmhToKnots(s.wind_speed) * 10) / 10)
          setGusts(Math.round(kmhToKnots(s.wind_speed) * 1.3 * 10) / 10)
        }
      } catch (e) {}

      try {
        const positions = await pb.collection('race_positions').getFullList({
          filter: `race_id="${raceId}"`,
        })
        const mine = positions.find(p => p.player_id === pb.authStore.record?.id)
        if (mine) {
          const h = mine.heading_deg || 247
          setHdg(h)
          const drift = mine.drift_angle || 0
          setDriftAngle(drift)
          setCog(mine.cog || (h + drift + 360) % 360)
          setSog(Math.round(kmhToKnots(mine.speed_kmh || 0) * 10) / 10)
        }
      } catch (e) {}
    }

    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [mounted, raceId])

  if (!mounted) return null

  const windIdx = Math.round(trueWindDir / 10) % 36
  const hdgIdx = Math.round(hdg / 10) % 36

  return (
    <Panel title="Szél & Irány" code="WX-1" bodyClassName="p-2.5">
      <div className="crt-screen flex flex-col gap-2.5 p-3">
        {/* Digitális iránytű — mutató nélkül, világító szegmensekkel */}
        <div className="relative mx-auto aspect-square w-full" style={{ maxWidth: 'min(100%, 280px)' }}>
          <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full">
            <defs>
              <filter id="crtGlow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="2.2" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <circle cx="100" cy="100" r="92" fill="none" stroke="oklch(0.42 0.09 168 / 0.35)" strokeWidth="1" />
            <circle cx="100" cy="100" r="62" fill="none" stroke="oklch(0.42 0.09 168 / 0.2)" strokeWidth="0.75" />

            {ringTicks.map((deg, i) => {
              const [x1, y1] = polar(deg, 80)
              const [x2, y2] = polar(deg, deg % 30 === 0 ? 70 : 76)
              const isWind = i === windIdx || (i + 1) % 36 === windIdx || (i - 1 + 36) % 36 === windIdx
              const isHdg = i === hdgIdx
              return (
                <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={isWind ? 'oklch(0.88 0.2 162)' : isHdg ? 'oklch(0.82 0.14 70)' : 'oklch(0.5 0.09 168 / 0.55)'}
                  strokeWidth={isWind ? 2.4 : deg % 30 === 0 ? 1.3 : 0.7}
                  strokeLinecap="round" />
              )
            })}

            {cardinals.map(([label, deg]) => {
              const [x, y] = polar(deg, 90)
              return (
                <text key={label} x={x} y={y + 3} textAnchor="middle" fontSize="8"
                  className="font-heading" fontWeight="bold"
                  fill={deg === 0 ? 'oklch(0.85 0.18 30)' : 'oklch(0.7 0.13 162)'}>
                  {label}
                </text>
              )
            })}

            {/* SZÉL iránymutató — nagy zöld nyíl, befelé mutat (innen fúj) */}
            <g transform={`rotate(${trueWindDir} 100 100)`} filter="url(#crtGlow)">
              <rect x="97.5" y="22" width="5" height="22" rx="2" fill="oklch(0.85 0.2 162)" />
              <polygon points="100,10 89,30 100,24 111,30" fill="oklch(0.9 0.22 162)" />
            </g>
            {/* HAJÓORR iránymutató — borostyán nyíl, kifelé mutat (merre néz a hajó) */}
            <g transform={`rotate(${hdg} 100 100)`} filter="url(#crtGlow)">
              <rect x="98.5" y="18" width="3" height="16" rx="1.5" fill="oklch(0.82 0.15 70)" />
              <polygon points="100,6 93,20 107,20" fill="oklch(0.86 0.16 70)" />
            </g>
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
            <span className="crt-glow font-mono text-[40px] font-bold tabular-nums">{trueWindDir}<span className="text-xl">°</span></span>
            <span className="crt-glow font-heading text-lg font-bold tracking-[0.25em]">{dirLabel(trueWindDir)}</span>
            <span className="crt-dim mt-1 font-mono text-[11px] tracking-wide">SZÉL {trueWindSpd} kn</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4">
          <span className="crt-dim flex items-center gap-1.5 text-[8px] tracking-wide">
            <span style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '7px solid oklch(0.88 0.2 162)' }} />SZÉL
          </span>
          <span className="crt-dim flex items-center gap-1.5 text-[8px] tracking-wide">
            <span style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '7px solid oklch(0.85 0.15 70)' }} />HAJÓORR
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {([
            ['TWS', `${trueWindSpd}`, 'kn', false],
            ['TWA', `${twaAbs}${twaSide}`, '°', false],
            ['SOG', `${sog}`, 'kn', false],
            ['LÖKÉS', `${gusts}`, 'kn', true],
          ] as [string, string, string, boolean][]).map(([label, value, unit, amber]) => (
            <div key={label} className="crt-cell px-1 py-1.5 text-center">
              <p className="crt-dim label-caps text-[7px]">{label}</p>
              <p className={`font-mono text-[17px] font-bold leading-none tabular-nums ${amber ? 'crt-amber' : 'crt-glow'}`}>{value}</p>
              <p className="crt-dim text-[7px]">{unit}</p>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  )
}

function dirLabel(deg: number) {
  const dirs = ['É', 'ÉK', 'K', 'DK', 'D', 'DNy', 'Ny', 'ÉNy']
  return dirs[Math.round(deg / 45) % 8]
}
