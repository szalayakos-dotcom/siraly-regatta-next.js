'use client'

import { useEffect, useState } from 'react'
import { Panel } from './panel'
import { getPocketBase, RACE_ID } from '@/lib/pocketbase'
import { kmhToKnots } from '@/lib/units'

const D2R = Math.PI / 180
const polar = (deg: number, r: number, cx = 100, cy = 100) => {
  const a = (deg - 90) * D2R
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const
}
const arcSeg = (startDeg: number, endDeg: number, r: number) => {
  const [x2, y2] = polar(endDeg, r)
  const large = ((endDeg - startDeg + 360) % 360) > 180 ? 1 : 0
  return `A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

const ticks = Array.from({ length: 72 }, (_, i) => i * 5)
const cardinals: [string, number][] = [['N',0],['E',90],['S',180],['W',270]]
const noGoHalfAngle = 40

export function WindDial() {
  const [mounted, setMounted] = useState(false)
  const [trueWindDir, setTrueWindDir] = useState(215)
  const [trueWindSpd, setTrueWindSpd] = useState(14)
  const [gusts, setGusts] = useState(19)
  const [hdg, setHdg] = useState(247)
  const [cog, setCog] = useState(247)
  const [driftAngle, setDriftAngle] = useState(0)
  const [sog, setSog] = useState(0)

  // Apparent wind számítás (közelítés)
  const appWindDir = Math.round((trueWindDir + hdg * 0.05) % 360)
  const appWindSpd = Math.round(trueWindSpd * 0.92 * 10) / 10

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    const pb = getPocketBase()

    async function load() {
      try {
        const segs = await pb.collection('weather_segments').getFullList({
          filter: `race_id="${RACE_ID}"`, sort: 'from_cp_index',
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
          filter: `race_id="${RACE_ID}"`,
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
  }, [mounted])

  if (!mounted) return null

  return (
    <Panel title="Wind & Heading" code="WX-1" bodyClassName="flex flex-col items-center gap-3">
      <div className="relative aspect-square w-full" style={{ maxWidth: "min(100%, 340px)" }}>
        <svg viewBox="0 0 200 200" className="h-full w-full">
          <defs>
            <radialGradient id="dialFace" cx="50%" cy="42%" r="65%">
              <stop offset="0%" stopColor="var(--card)" />
              <stop offset="100%" stopColor="var(--muted)" />
            </radialGradient>
          </defs>

          <circle cx="100" cy="100" r="96" className="fill-none stroke-border" strokeWidth="1.5"/>
          <circle cx="100" cy="100" r="90" fill="url(#dialFace)" className="stroke-border" strokeWidth="0.75"/>

          {/* No-go zone */}
          <path
            d={`M 100 100 L ${polar(trueWindDir - noGoHalfAngle, 78).join(' ')} ${arcSeg(trueWindDir - noGoHalfAngle, trueWindDir + noGoHalfAngle, 78)} Z`}
            className="fill-accent/10 stroke-accent/30"
            strokeWidth="0.5" strokeDasharray="2 2"
          />

          {/* Ticks */}
          {ticks.map((deg) => {
            const major = deg % 30 === 0
            const mid = deg % 10 === 0
            const [x1, y1] = polar(deg, major ? 78 : mid ? 82 : 85)
            const [x2, y2] = polar(deg, 89)
            return (
              <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2}
                className={major ? 'stroke-foreground' : 'stroke-muted-foreground'}
                strokeWidth={major ? 1.25 : mid ? 0.6 : 0.35}
              />
            )
          })}

          {/* Degree labels */}
          {Array.from({ length: 12 }, (_, i) => i * 30).map((deg) => {
            if (deg % 90 === 0) return null
            const [x, y] = polar(deg, 70)
            return (
              <text key={deg} x={x} y={y + 2.5} textAnchor="middle"
                className="fill-muted-foreground font-mono text-[6px]">
                {deg}
              </text>
            )
          })}

          {/* Cardinals */}
          {cardinals.map(([label, deg]) => {
            const [x, y] = polar(deg, 70)
            return (
              <text key={label} x={x} y={y + 4} textAnchor="middle"
                className={label === 'N'
                  ? 'fill-accent font-heading text-[12px] font-bold'
                  : 'fill-foreground font-heading text-[11px] font-semibold'
                }>
                {label}
              </text>
            )
          })}

          {/* COG — szaggatott */}
          <g transform={`rotate(${cog} 100 100)`}>
            <line x1="100" y1="100" x2="100" y2="20"
              className="stroke-secondary" strokeWidth="1.25" strokeDasharray="4 3"/>
            <circle cx="100" cy="20" r="3" className="fill-secondary"/>
          </g>

          {/* HDG — fő mutató */}
          <g transform={`rotate(${hdg} 100 100)`}>
            <polygon points="100,16 92,108 108,108" className="fill-foreground"/>
            <polygon points="100,184 95,100 105,100" className="fill-muted-foreground/60"/>
            <circle cx="100" cy="16" r="2.5" className="fill-background stroke-foreground" strokeWidth="1"/>
          </g>

          {/* True wind */}
          <g transform={`rotate(${trueWindDir} 100 100)`}>
            <line x1="100" y1="100" x2="100" y2="30" className="stroke-accent" strokeWidth="2.75"/>
            <polygon points="100,24 92,40 108,40" className="fill-accent"/>
          </g>

          {/* Apparent wind */}
          <g transform={`rotate(${appWindDir} 100 100)`}>
            <line x1="100" y1="100" x2="100" y2="40"
              className="stroke-accent/55" strokeWidth="1.5" strokeDasharray="3 2"/>
            <polygon points="100,34 94,46 106,46" className="fill-none stroke-accent/70" strokeWidth="1"/>
          </g>

          {/* Hub */}
          <circle cx="100" cy="100" r="6" className="fill-card stroke-foreground" strokeWidth="1.25"/>
          <circle cx="100" cy="100" r="2" className="fill-foreground"/>

          {/* Lubber line */}
          <polygon points="100,4 96,12 104,12" className="fill-accent"/>
        </svg>
      </div>

      {/* Jelmagyarázat */}
      <div className="flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-1">
        {[
          ['HDG', `${hdg}°`, 'bg-foreground'],
          ['COG', `${Math.round(cog)}°`, 'bg-secondary'],
          ['TWD', `${trueWindDir}°`, 'bg-accent'],
          ['AWD', `${appWindDir}°`, 'bg-accent/55'],
        ].map(([label, value, dot]) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${dot}`} aria-hidden/>
            <span className="label-caps text-[8px] text-muted-foreground">{label}</span>
            <span className="font-mono text-[10px] font-semibold text-foreground">{value}</span>
          </div>
        ))}
      </div>

      {/* Digitális kijelzők */}
      <div className="grid w-full grid-cols-4 gap-px overflow-hidden rounded-sm border border-border bg-border">
        {[
          ['TWS', `${trueWindSpd}`, 'kn'],
          ['AWS', `${appWindSpd}`, 'kn'],
          ['Gust', `${gusts}`, 'kn'],
          ['SOG', `${sog}`, 'kn'],
        ].map(([label, value, unit]) => (
          <div key={label} className="bg-card px-1.5 py-2 text-center">
            <p className="label-caps text-[8px] text-muted-foreground">{label}</p>
            <p className="font-heading text-base font-semibold leading-none text-foreground">{value}</p>
            <p className="font-mono text-[7px] text-muted-foreground">{unit}</p>
          </div>
        ))}
      </div>
    </Panel>
  )
}
