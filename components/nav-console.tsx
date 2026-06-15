'use client'

import { useEffect, useState } from 'react'
import { getPocketBase } from '@/lib/pocketbase'
import { useRace } from '@/components/race-context'
import { kmhToKnots } from '@/lib/units'
import type { WarningState } from './warning-panel'

type LampVisual = { state: 'off' | 'green' | 'amber' | 'red'; blink: boolean; label: string }

function lampOf(w: WarningState, id: string): LampVisual {
  switch (id) {
    case 'vihar':
      return { state: w.vihar >= 1 ? 'amber' : 'off', blink: w.vihar === 2, label: 'Vihar' }
    case 'leszuras':
      return { state: w.leszuras ? 'red' : 'off', blink: !!w.leszuras, label: 'Leszúrás' }
    case 'drift':
      return {
        state: w.drift > 6 ? 'red' : 'off', blink: w.drift > 12,
        label: w.drift > 0 ? `Drift ${w.drift.toFixed(0)}°` : 'Drift',
      }
    case 'vitorla':
      return { state: w.vitorla ? 'green' : 'red', blink: !w.vitorla, label: 'Vitorla' }
    case 'tuldoles':
      return { state: w.tuldoles ? 'red' : 'off', blink: !!w.tuldoles, label: 'Túldőlés' }
    case 'trim':
      return {
        state: w.trimEfficiency === 0 ? 'red' : w.trimEfficiency >= 75 ? 'green' : w.trimEfficiency >= 40 ? 'amber' : 'red',
        blink: w.trimEfficiency === 0,
        label: 'Trim',
      }
    case 'rajt':
      return { state: w.raceAlert ? 'red' : 'off', blink: !!w.raceAlert, label: w.raceAlert ? `Rajt ${w.raceAlert}` : 'Rajt' }
    default:
      return { state: 'off', blink: false, label: id }
  }
}

const LAMP_IDS = ['vihar', 'leszuras', 'drift', 'vitorla', 'tuldoles', 'trim', 'rajt']

const COLORS: Record<string, { dot: string; glow: string; txt: string }> = {
  off:   { dot: 'oklch(0.45 0.08 168 / 0.6)', glow: 'none', txt: 'oklch(0.6 0.09 168 / 0.85)' },
  green: { dot: 'oklch(0.82 0.2 162)', glow: '0 0 8px oklch(0.7 0.18 162 / 0.6)', txt: 'oklch(0.85 0.18 162)' },
  amber: { dot: 'oklch(0.85 0.16 70)', glow: '0 0 8px oklch(0.78 0.15 70 / 0.6)', txt: 'oklch(0.86 0.15 70)' },
  red:   { dot: 'oklch(0.72 0.22 28)', glow: '0 0 9px oklch(0.66 0.22 28 / 0.7)', txt: 'oklch(0.78 0.2 28)' },
}

export function NavConsole({ warnings }: { warnings: WarningState }) {
  const { raceId } = useRace()
  const [mounted, setMounted] = useState(false)
  const [raceName, setRaceName] = useState('')
  const [raceStage, setRaceStage] = useState('')
  const [raceTime, setRaceTime] = useState('00:00:00')
  const [raceStart, setRaceStart] = useState<number | null>(null)
  const [windSpeed, setWindSpeed] = useState(0)
  const [heading, setHeading] = useState(247)
  const [speed, setSpeed] = useState(0)
  const [credits, setCredits] = useState(0)
  const [cpIndex, setCpIndex] = useState(0)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    const interval = setInterval(() => {
      if (raceStart) {
        const elapsed = Math.floor((Date.now() - raceStart) / 1000)
        const h = Math.floor(elapsed / 3600), m = Math.floor((elapsed % 3600) / 60), s = elapsed % 60
        setRaceTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [raceStart, mounted])

  useEffect(() => {
    if (!mounted || !raceId) return
    const pb = getPocketBase()

    async function load() {
      try {
        const race = await pb.collection('races').getOne(raceId)
        setRaceName(race.name)
        if (race.actual_start) setRaceStart(new Date(race.actual_start).getTime())
        else if (race.scheduled_start) setRaceStart(new Date(race.scheduled_start).getTime())

        if (race.course_id) {
          try {
            const course = await pb.collection('courses').getOne(race.course_id)
            const pts = typeof course.points === 'string' ? JSON.parse(course.points) : (course.points || [])
            const main = pts.filter((p: any) => p.type === 'start' || p.type === 'finish').sort((a: any, b: any) => a.order - b.order)
            if (main.length >= 2) setRaceStage(`${main[0].name} → ${main[main.length - 1].name}`)
            else if (course.name) setRaceStage(course.name)
          } catch {}
        }

        if (pb.authStore.isValid) {
          try {
            const profile = await pb.collection('player_profiles').getFirstListItem(`player_id="${pb.authStore.record?.id}"`)
            setCredits(profile.credits || 0)
          } catch {}
        }

        const segs = await pb.collection('weather_segments').getFullList({
          filter: `race_id="${raceId}"`, sort: 'from_cp_index',
        })

        if (pb.authStore.isValid) {
          try {
            const pos = await pb.collection('race_positions').getFirstListItem(
              `race_id="${raceId}" && player_id="${pb.authStore.record?.id}"`
            )
            setSpeed(Math.round(kmhToKnots(pos.speed_kmh || 0) * 10) / 10)
            setHeading(pos.heading_deg || 247)
            setCpIndex(pos.cp_index || 0)
            if (segs.length) {
              const cpIdx = pos.cp_index || 0
              const seg = [...segs].reverse().find((s: any) => s.from_cp_index <= cpIdx) || segs[0]
              setWindSpeed(Math.round(kmhToKnots(seg.wind_speed) * 10) / 10)
            }
          } catch {
            if (segs.length) setWindSpeed(Math.round(kmhToKnots(segs[0].wind_speed) * 10) / 10)
          }
        } else if (segs.length) {
          setWindSpeed(Math.round(kmhToKnots(segs[0].wind_speed) * 10) / 10)
        }
      } catch (e) {}
    }

    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [mounted, raceId])

  const dirs = ['É', 'ÉK', 'K', 'DK', 'D', 'DNy', 'Ny', 'ÉNy']
  const headingLabel = dirs[Math.round((((heading % 360) + 360) % 360) / 45) % 8]

  const cells: [string, string, string][] = [
    ['Versenyidő', raceTime, ''],
    ['Hajó irány', `${heading}°`, headingLabel],
    ['SOG', `${speed}`, 'kn'],
    ['Szél', `${windSpeed}`, 'kn'],
    ['CP', `${cpIndex}`, ''],
    ['Kredit', `${credits}`, 'kr'],
  ]

  if (!mounted) return <div className="crt-screen mx-3 mt-3 h-[150px]" />

  return (
    <div className="crt-screen mx-3 mt-3 p-3">
      <style>{`@keyframes navBlink{0%,49%{opacity:1}50%,100%{opacity:.18}}`}</style>

      {/* Fejléc */}
      <div className="mb-2.5 flex items-center justify-between gap-2 border-b border-[oklch(0.4_0.08_168/0.4)] pb-2">
        <div className="flex items-center gap-2">
          <span className="brass-plate label-caps rounded-[3px] px-1.5 py-0.5 text-[9px] leading-none">NAV-1</span>
          <div className="leading-tight">
            <p className="crt-glow font-heading text-sm font-bold uppercase tracking-wide">{raceName || 'Digitális navigáció'}</p>
            {raceStage && <p className="crt-dim font-mono text-[9px]">{raceStage}</p>}
          </div>
        </div>
        <span className="crt-glow flex items-center gap-1.5 label-caps text-[9px]">
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'oklch(0.82 0.2 162)', boxShadow: '0 0 6px oklch(0.7 0.18 162)' }} />
          Élő
        </span>
      </div>

      {/* Telemetria — reszponzív rács, nem lóg túl */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
        {cells.map(([label, value, unit]) => (
          <div key={label} className="crt-cell px-1.5 py-1.5 text-center">
            <p className="crt-dim label-caps text-[7px]">{label}</p>
            <p className="crt-glow font-mono text-[15px] font-bold leading-tight tabular-nums">
              {value}{unit && <span className="crt-dim ml-0.5 text-[8px]">{unit}</span>}
            </p>
          </div>
        ))}
      </div>

      {/* Visszajelző lámpák — reszponzív rács */}
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
        {LAMP_IDS.map((id) => {
          const l = lampOf(warnings, id)
          const c = COLORS[l.state]
          return (
            <div key={id} className="crt-cell flex items-center gap-1.5 px-2 py-1.5">
              <span style={{
                width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
                background: c.dot, boxShadow: c.glow,
                animation: l.blink ? 'navBlink 0.55s steps(1) infinite' : 'none',
              }} />
              <span className="label-caps truncate text-[8px]" style={{ color: c.txt }}>{l.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
