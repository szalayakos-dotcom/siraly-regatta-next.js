'use client'

import { useEffect, useState } from 'react'
import { Navigation, Wind, Clock, Flag, Coins } from 'lucide-react'
import { getPocketBase } from '@/lib/pocketbase'
import { useRace } from '@/components/race-context'
import { kmhToKnots } from '@/lib/units'

export function StatusBar() {
  const { raceId } = useRace()
  const [raceName, setRaceName] = useState('')
  const [raceStage, setRaceStage] = useState('')
  const [raceTime, setRaceTime] = useState('00:00:00')
  const [raceStart, setRaceStart] = useState<number | null>(null)
  const [windSpeed, setWindSpeed] = useState(0)
  const [heading, setHeading] = useState(247)
  const [credits, setCredits] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [speed, setSpeed] = useState(0)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    const interval = setInterval(() => {
      if (raceStart) {
        const elapsed = Math.floor((Date.now() - raceStart) / 1000)
        const h = Math.floor(elapsed / 3600)
        const m = Math.floor((elapsed % 3600) / 60)
        const s = elapsed % 60
        setRaceTime(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [raceStart, mounted])

  useEffect(() => {
    if (!mounted) return
    const pb = getPocketBase()

    async function load() {
      try {
        if (!raceId) return
        const race = await pb.collection('races').getOne(raceId)
        setRaceName(race.name)
        if (race.actual_start) {
          setRaceStart(new Date(race.actual_start).getTime())
        } else if (race.scheduled_start) {
          setRaceStart(new Date(race.scheduled_start).getTime())
        }
        if (race.course_id) {
          try {
            const course = await pb.collection('courses').getOne(race.course_id)
            const pts = typeof course.points === 'string' ? JSON.parse(course.points) : (course.points || [])
            const main = pts.filter((p: any) => p.type === 'start' || p.type === 'finish').sort((a: any, b: any) => a.order - b.order)
            if (main.length >= 2) setRaceStage(`${main[0].name} → ${main[main.length-1].name}`)
            else if (course.name) setRaceStage(course.name)
          } catch {}
        }

        if (pb.authStore.isValid) {
          const pr = await pb.collection('player_races').getList(1, 1, {
            filter: `race_id="${raceId}" && player_id="${pb.authStore.record?.id}"`,
          })
          // Kredit a player_profiles-ból
          try {
            const profile = await pb.collection('player_profiles').getFirstListItem(
              `player_id="${pb.authStore.record?.id}"`
            )
            setCredits(profile.credits || 0)
          } catch {}
        }

        const segs = await pb.collection('weather_segments').getFullList({
          filter: `race_id="${raceId}"`, sort: 'from_cp_index',
        })

        // Saját pozíció sebessége és CP index
        if (pb.authStore.isValid) {
          try {
            const pos = await pb.collection('race_positions').getFirstListItem(
              `race_id="${raceId}" && player_id="${pb.authStore.record?.id}"`
            )
            setSpeed(Math.round(kmhToKnots(pos.speed_kmh || 0) * 10) / 10)
            setHeading(pos.heading_deg || 247)
            // Aktuális szegmens a CP index alapján
            if (segs.length) {
              const cpIdx = pos.cp_index || 0
              const seg = [...segs].reverse().find((s: any) => s.from_cp_index <= cpIdx) || segs[0]
              setWindSpeed(Math.round(kmhToKnots(seg.wind_speed) * 10) / 10)
            }
          } catch {
            if (segs.length) setWindSpeed(Math.round(kmhToKnots(segs[0].wind_speed) * 10) / 10)
          }
        } else {
          if (segs.length) setWindSpeed(Math.round(kmhToKnots(segs[0].wind_speed) * 10) / 10)
        }
      } catch (e) {}
    }

    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [mounted])

  const dirs = ['É','ÉK','K','DK','D','DNy','Ny','ÉNy']
  const headingLabel = dirs[Math.round(((heading % 360) + 360) % 360 / 45) % 8]

  if (!mounted) return <header className="paper-grain flex items-center justify-between gap-4 border-b border-border px-6 py-3 h-[56px]" style={{ background: '#d25c1c' }}/>

  return (
    <header className="paper-grain flex items-center justify-between gap-4 border-b border-border px-6 py-3" style={{ position: 'relative', background: '#d25c1c' }}>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-sm px-2.5 py-1" style={{ background: 'rgba(0,0,0,0.25)', color: '#fdf9e0', border: '1px solid rgba(253,249,224,0.4)' }}>
          <Flag className="size-3.5" strokeWidth={2}/>
          <span className="label-caps text-[10px]">Verseny Élő</span>
        </div>
        <div>
          <h1 className="font-heading text-lg font-semibold uppercase tracking-wide" style={{ color: '#fdf9e0' }}>{raceName}</h1>
          <p className="label-caps text-[9px]" style={{ color: 'rgba(253,249,224,0.7)' }}>{raceStage}</p>
        </div>
      </div>

      <div className="flex items-stretch gap-1">
        {[
          { icon: Clock,      label: 'Versenyidő', value: raceTime,           sub: 'eltelt' },
          { icon: Navigation, label: 'Hajó iránya', value: `${heading}°`,     sub: headingLabel },
          { icon: Navigation, label: 'SOG',          value: `${speed} kn`,     sub: 'sebesség' },
          { icon: Wind,       label: 'Szél',        value: `${windSpeed} kn`, sub: '' },
          { icon: Coins,      label: 'Kredit',      value: `${credits} kr`,   sub: '' },
        ].map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className="flex items-center gap-2.5 rounded-sm px-3 py-1.5" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(253,249,224,0.2)' }}>
              <Icon className="size-4" style={{ color: 'rgba(253,249,224,0.8)' }} strokeWidth={1.75} aria-hidden/>
              <div className="leading-tight">
                <p className="label-caps text-[8px]" style={{ color: 'rgba(253,249,224,0.6)' }}>{s.label}</p>
                <p className="font-heading text-sm font-semibold" style={{ color: '#fdf9e0' }}>
                  {s.value}
                  {s.sub && <span className="ml-1 text-[10px] font-normal" style={{ color: 'rgba(253,249,224,0.6)' }}>{s.sub}</span>}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </header>
  )
}
