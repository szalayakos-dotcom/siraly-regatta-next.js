'use client'

import { useEffect, useState } from 'react'
import { getPocketBase, RACE_ID } from '@/lib/pocketbase'
import { Zap, Wind, CloudLightning, Clock, Users, RotateCcw } from 'lucide-react'

export default function GodModePage() {
  const [windDir, setWindDir] = useState(215)
  const [windSpeed, setWindSpeed] = useState(18)
  const [stormLevel, setStormLevel] = useState(0)
  const [raceStatus, setRaceStatus] = useState('idle')
  const [playerCount, setPlayerCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const pb = getPocketBase()
    async function load() {
      try {
        const race = await pb.collection('races').getOne(RACE_ID)
        setRaceStatus(race.status || 'idle')
        const segs = await pb.collection('weather_segments').getFullList({
          filter: `race_id="${RACE_ID}"`, sort: 'from_cp_index',
        })
        if (segs.length) {
          setWindDir(segs[0].wind_dir)
          setWindSpeed(segs[0].wind_speed)
          setStormLevel(segs[0].storm_level || 0)
        }
        const positions = await pb.collection('race_positions').getFullList({
          filter: `race_id="${RACE_ID}"`,
        })
        setPlayerCount(positions.length)
      } catch (e) {}
    }
    load()
  }, [])

  async function saveWeather() {
    setSaving(true)
    try {
      const pb = getPocketBase()
      const segs = await pb.collection('weather_segments').getFullList({
        filter: `race_id="${RACE_ID}"`, sort: 'from_cp_index',
      })
      for (const seg of segs) {
        await pb.collection('weather_segments').update(seg.id, {
          wind_dir: windDir, wind_speed: windSpeed, storm_level: stormLevel,
        })
      }
      setMsg('✓ Időjárás mentve')
    } catch (e) { setMsg('⚠ Hiba') }
    setSaving(false)
    setTimeout(() => setMsg(''), 2000)
  }

  async function setRaceState(status: string) {
    try {
      const pb = getPocketBase()
      const updates: any = { status }
      if (status === 'active') updates.actual_start = new Date().toISOString()
      await pb.collection('races').update(RACE_ID, updates)
      setRaceStatus(status)
      setMsg(`✓ Verseny: ${status}`)
      setTimeout(() => setMsg(''), 2000)
    } catch (e) { setMsg('⚠ Hiba') }
  }

  async function resetPositions() {
    if (!confirm('Biztosan törlöd az összes pozíciót?')) return
    try {
      const pb = getPocketBase()
      const positions = await pb.collection('race_positions').getFullList({
        filter: `race_id="${RACE_ID}"`,
      })
      for (const p of positions) {
        await pb.collection('race_positions').delete(p.id)
      }
      setPlayerCount(0)
      setMsg('✓ Pozíciók törölve')
      setTimeout(() => setMsg(''), 2000)
    } catch (e) { setMsg('⚠ Hiba') }
  }

  const dirs = ['É','ÉK','K','DK','D','DNy','Ny','ÉNy']
  const dirLabel = dirs[Math.round(((windDir % 360) + 360) % 360 / 45) % 8]

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Zap className="size-5 text-accent" strokeWidth={2}/>
        <h1 className="font-heading text-xl font-bold text-foreground">God mód</h1>
        {msg && <span className="label-caps text-[10px] text-secondary bg-secondary/10 px-2 py-1 rounded-sm">{msg}</span>}
      </div>

      {/* Verseny állapot */}
      <div className="rounded-sm border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="size-4 text-muted-foreground" strokeWidth={1.75}/>
          <p className="font-heading text-sm font-semibold">Verseny vezérlés</p>
          <span className="ml-auto label-caps text-[9px] px-2 py-0.5 rounded-sm bg-secondary/15 text-secondary">
            {raceStatus.toUpperCase()}
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { label: '📢 Versenykiírás', status: 'published', color: 'bg-secondary text-secondary-foreground' },
            { label: '⏸ Felfüggesztés', status: 'paused',    color: 'bg-accent text-accent-foreground' },
            { label: '▶ Folytatás',      status: 'active',    color: 'bg-green-600 text-white' },
            { label: '⏹ Befejezés',      status: 'finished',  color: 'bg-destructive text-destructive-foreground' },
            { label: '↩ Vázlat',         status: 'draft',     color: 'bg-muted text-muted-foreground' },
          ].map(({ label, status, color }) => (
            <button key={status} onClick={() => setRaceState(status)}
              className={`${color} px-4 py-2 rounded-sm font-heading text-sm font-semibold transition-opacity hover:opacity-90`}>
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><Users className="size-3.5"/>{playerCount} aktív versenyző</span>
          <button onClick={resetPositions} className="flex items-center gap-1.5 text-destructive hover:underline text-xs">
            <RotateCcw className="size-3"/> Pozíciók törlése
          </button>
        </div>
      </div>

      {/* Időjárás god mód */}
      <div className="rounded-sm border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Wind className="size-4 text-muted-foreground" strokeWidth={1.75}/>
          <p className="font-heading text-sm font-semibold">Időjárás — élő vezérlés</p>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-1">
              <label className="label-caps text-[9px] text-muted-foreground">Szélirány</label>
              <span className="font-heading text-sm font-bold">{windDir}° {dirLabel}</span>
            </div>
            <input type="range" min={0} max={359} value={windDir}
              onChange={e => setWindDir(Number(e.target.value))}
              className="w-full h-3 rounded-sm cursor-pointer"
              style={{ accentColor: 'var(--color-secondary)' }}/>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="label-caps text-[9px] text-muted-foreground">Szélsebesség</label>
              <span className="font-heading text-sm font-bold">{windSpeed} km/h</span>
            </div>
            <input type="range" min={0} max={80} value={windSpeed}
              onChange={e => setWindSpeed(Number(e.target.value))}
              className="w-full h-3 rounded-sm cursor-pointer"
              style={{ accentColor: 'var(--color-secondary)' }}/>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <CloudLightning className="size-4 text-muted-foreground" strokeWidth={1.75}/>
              <label className="label-caps text-[9px] text-muted-foreground">Viharszint</label>
            </div>
            <div className="flex gap-2">
              {[
                { level: 0, label: 'Nincs',   color: 'border-border text-muted-foreground' },
                { level: 1, label: '1. fokú', color: 'border-accent text-accent' },
                { level: 2, label: '2. fokú', color: 'border-destructive text-destructive' },
              ].map(({ level, label, color }) => (
                <button key={level} onClick={() => setStormLevel(level)}
                  className={`flex-1 rounded-sm border-2 py-2 font-heading text-xs font-semibold transition-all ${color} ${stormLevel === level ? 'bg-current/10' : 'opacity-50'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={saveWeather} disabled={saving}
            className="w-full rounded-sm bg-foreground py-2.5 font-heading text-sm font-semibold text-background hover:bg-secondary transition-colors disabled:opacity-50">
            {saving ? 'Mentés...' : '⚡ Alkalmazás — minden szegmensre'}
          </button>
        </div>
      </div>
    </div>
  )
}
