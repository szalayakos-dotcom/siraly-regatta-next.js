'use client'

import { useEffect, useState } from 'react'
import { getPocketBase } from '@/lib/pocketbase'
import { useRace } from '@/components/race-context'
import {
  Zap, CloudLightning, Users, RotateCcw,
  Megaphone, Pause, Play, Square, Undo2, Check, TriangleAlert,
} from 'lucide-react'
import { Panel } from '@/components/panel'

export default function GodModePage() {
  const { raceId } = useRace()
  const [windDir, setWindDir] = useState(215)
  const [windSpeed, setWindSpeed] = useState(18)
  const [stormLevel, setStormLevel] = useState(0)
  const [raceStatus, setRaceStatus] = useState('idle')
  const [playerCount, setPlayerCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgError, setMsgError] = useState(false)

  function flash(text: string, isError = false) {
    setMsg(text)
    setMsgError(isError)
    setTimeout(() => setMsg(''), 2200)
  }

  useEffect(() => {
    const pb = getPocketBase()
    async function load() {
      try {
        const race = await pb.collection('races').getOne(raceId)
        setRaceStatus(race.status || 'idle')
        const segs = await pb.collection('weather_segments').getFullList({
          filter: `race_id="${raceId}"`, sort: 'from_cp_index',
        })
        if (segs.length) {
          setWindDir(segs[0].wind_dir)
          setWindSpeed(segs[0].wind_speed)
          setStormLevel(segs[0].storm_level || 0)
        }
        const positions = await pb.collection('race_positions').getFullList({
          filter: `race_id="${raceId}"`,
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
        filter: `race_id="${raceId}"`, sort: 'from_cp_index',
      })
      for (const seg of segs) {
        await pb.collection('weather_segments').update(seg.id, {
          wind_dir: windDir, wind_speed: windSpeed, storm_level: stormLevel,
        })
      }
      flash('Időjárás mentve')
    } catch (e) { flash('Hiba a mentésnél', true) }
    setSaving(false)
  }

  async function setRaceState(status: string) {
    try {
      const pb = getPocketBase()
      const updates: any = { status }
      if (status === 'active') updates.actual_start = new Date().toISOString()
      await pb.collection('races').update(raceId, updates)
      setRaceStatus(status)
      flash(`Verseny: ${status}`)
    } catch (e) { flash('Hiba', true) }
  }

  async function resetPositions() {
    if (!confirm('Biztosan törlöd az összes pozíciót?')) return
    try {
      const pb = getPocketBase()
      const positions = await pb.collection('race_positions').getFullList({
        filter: `race_id="${raceId}"`,
      })
      for (const p of positions) {
        await pb.collection('race_positions').delete(p.id)
      }
      setPlayerCount(0)
      flash('Pozíciók törölve')
    } catch (e) { flash('Hiba', true) }
  }

  const dirs = ['É', 'ÉK', 'K', 'DK', 'D', 'DNy', 'Ny', 'ÉNy']
  const dirLabel = dirs[Math.round((((windDir % 360) + 360) % 360) / 45) % 8]

  const stateButtons = [
    { label: 'Versenykiírás', status: 'published', Icon: Megaphone, tone: 'secondary' },
    { label: 'Felfüggesztés', status: 'paused', Icon: Pause, tone: 'accent' },
    { label: 'Folytatás', status: 'active', Icon: Play, tone: 'go' },
    { label: 'Befejezés', status: 'finished', Icon: Square, tone: 'stop' },
    { label: 'Vázlat', status: 'draft', Icon: Undo2, tone: 'muted' },
  ] as const

  const toneClass: Record<string, string> = {
    secondary: 'border-secondary/50 bg-secondary/15 text-secondary hover:bg-secondary/25',
    accent: 'border-primary/50 bg-primary/15 text-primary hover:bg-primary/25',
    go: 'border-secondary/50 bg-secondary text-secondary-foreground hover:opacity-90',
    stop: 'border-destructive/50 bg-destructive/15 text-destructive hover:bg-destructive/25',
    muted: 'border-border bg-muted text-muted-foreground hover:bg-muted/70',
  }

  return (
    <div className="min-h-screen bg-background p-4 lg:p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        {/* Fejléc */}
        <div className="flex items-center gap-3">
          <div className="instrument-bezel flex size-10 items-center justify-center">
            <Zap className="size-5 text-[var(--gold)]" strokeWidth={2} />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold leading-none text-foreground">
              Versenyirányító
            </h1>
            <p className="label-caps mt-1 text-[10px] text-muted-foreground">
              God mód · teljes vezérlés
            </p>
          </div>
          {msg && (
            <span
              className={`ml-auto flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-semibold ${
                msgError
                  ? 'bg-destructive/15 text-destructive'
                  : 'bg-secondary/15 text-secondary'
              }`}
            >
              {msgError ? <TriangleAlert className="size-3.5" /> : <Check className="size-3.5" />}
              {msg}
            </span>
          )}
        </div>

        {/* Verseny vezérlés */}
        <Panel title="Verseny vezérlés" code="CTRL-01">
          <div className="mb-4 flex items-center gap-2">
            <span className="label-caps text-[9px] text-muted-foreground">Aktuális állapot</span>
            <span className="brass-plate label-caps rounded-sm px-2.5 py-1 text-[10px]">
              {raceStatus.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {stateButtons.map(({ label, status, Icon, tone }) => (
              <button
                key={status}
                onClick={() => setRaceState(status)}
                className={`flex items-center justify-center gap-2 rounded-sm border px-3 py-2.5 font-heading text-sm font-semibold transition-colors ${toneClass[tone]}`}
              >
                <Icon className="size-4" strokeWidth={2} />
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="size-4" strokeWidth={1.75} />
              <strong className="font-heading text-foreground">{playerCount}</strong> aktív versenyző
            </span>
            <button
              onClick={resetPositions}
              className="flex items-center gap-1.5 rounded-sm border border-destructive/40 px-2.5 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
            >
              <RotateCcw className="size-3.5" strokeWidth={2} /> Pozíciók törlése
            </button>
          </div>
        </Panel>

        {/* Időjárás vezérlés */}
        <Panel title="Időjárás — élő vezérlés" code="METEO-02">
          <div className="space-y-5">
            {/* Szélirány */}
            <div>
              <div className="mb-2 flex items-end justify-between">
                <label className="label-caps text-[9px] text-muted-foreground">Szélirány</label>
                <span className="font-heading text-lg font-bold tabular-nums text-foreground">
                  {windDir}° <span className="text-secondary">{dirLabel}</span>
                </span>
              </div>
              <input
                type="range" min={0} max={359} value={windDir}
                onChange={(e) => setWindDir(Number(e.target.value))}
                className="h-2 w-full cursor-pointer accent-[var(--color-secondary)]"
              />
            </div>

            {/* Szélsebesség */}
            <div>
              <div className="mb-2 flex items-end justify-between">
                <label className="label-caps text-[9px] text-muted-foreground">Szélsebesség</label>
                <span className="font-heading text-lg font-bold tabular-nums text-foreground">
                  {windSpeed} <span className="text-sm text-muted-foreground">km/h</span>
                </span>
              </div>
              <input
                type="range" min={0} max={80} value={windSpeed}
                onChange={(e) => setWindSpeed(Number(e.target.value))}
                className="h-2 w-full cursor-pointer accent-[var(--color-secondary)]"
              />
            </div>

            {/* Viharszint */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <CloudLightning className="size-4 text-muted-foreground" strokeWidth={1.75} />
                <label className="label-caps text-[9px] text-muted-foreground">Viharszint</label>
              </div>
              <div className="flex gap-2">
                {[
                  { level: 0, label: 'Nincs', cls: 'border-border text-muted-foreground' },
                  { level: 1, label: '1. fokú', cls: 'border-primary text-primary' },
                  { level: 2, label: '2. fokú', cls: 'border-destructive text-destructive' },
                ].map(({ level, label, cls }) => (
                  <button
                    key={level}
                    onClick={() => setStormLevel(level)}
                    className={`flex-1 rounded-sm border-2 py-2.5 font-heading text-xs font-semibold transition-all ${cls} ${
                      stormLevel === level ? 'bg-current/10' : 'opacity-45 hover:opacity-80'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={saveWeather}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-sm bg-primary py-3 font-heading text-sm font-bold uppercase tracking-wide text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Zap className="size-4" strokeWidth={2.25} />
              {saving ? 'Mentés...' : 'Alkalmazás — minden szegmensre'}
            </button>
          </div>
        </Panel>
      </div>
    </div>
  )
}
