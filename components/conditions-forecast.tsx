'use client'

import { useEffect, useState } from 'react'
import { Panel } from './panel'
import { getPocketBase } from '@/lib/pocketbase'
import { useRace } from '@/components/race-context'
import { Wind, Waves, CloudLightning } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Segment {
  from_cp_index: number
  wind_dir: number
  wind_speed: number
  storm_level: number
  name?: string
}

const dirLabel = (deg: number) => {
  const dirs = ['É','ÉK','K','DK','D','DNy','Ny','ÉNy']
  return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8]
}

const stormLabel = ['OK', '1. fokú vihar', '2. fokú vihar']
const stormColor = ['text-secondary', 'text-accent', 'text-destructive']

export function ConditionsForecast() {
  const { raceId } = useRace()
  const [segments, setSegments] = useState<Segment[]>([])
  const [checkpoints, setCheckpoints] = useState<Record<number, string>>({})
  const [currentCpIndex, setCurrentCpIndex] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    const pb = getPocketBase()

    async function load() {
      try {
        const [segs, cps] = await Promise.all([
          pb.collection('weather_segments').getFullList({
            filter: `race_id="${raceId}"`, sort: 'from_cp_index',
          }),
          pb.collection('checkpoints').getFullList({
            filter: `race_id="${raceId}"`, sort: 'order_index',
          }),
        ])

        const cpMap: Record<number, string> = {}
        cps.forEach(cp => { cpMap[cp.order_index] = cp.name })
        setCheckpoints(cpMap)
        setSegments(segs.map(s => ({ ...s, name: cpMap[s.from_cp_index] })))

        // Aktuális CP index lekérése
        if (pb.authStore.isValid) {
          try {
            const pos = await pb.collection('race_positions').getFirstListItem(
              `race_id="${raceId}" && player_id="${pb.authStore.record?.id}"`
            )
            setCurrentCpIndex(pos.cp_index || 0)
          } catch {}
        }
      } catch (e) {}
    }

    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [mounted])

  if (!mounted) return null

  return (
    <Panel title="Időjárás előrejelzés" code="WX" bodyClassName="flex flex-col gap-2">
      {segments.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-4">Betöltés...</p>
      ) : (
        segments.map((seg, i) => (
          <div key={seg.from_cp_index}
            className={cn(
              'flex items-center gap-3 rounded-sm border border-border bg-background/60 px-3 py-2',
              seg.from_cp_index <= currentCpIndex && (i === segments.length - 1 || segments[i+1]?.from_cp_index > currentCpIndex) && 'border-secondary/50 bg-secondary/5'
            )}>
            <div className="min-w-0 flex-1">
              <p className="font-heading text-xs font-semibold text-foreground">
                {seg.name || `${seg.from_cp_index}. szakasz`}
                {seg.from_cp_index <= currentCpIndex && (i === segments.length - 1 || segments[i+1]?.from_cp_index > currentCpIndex) && (
                  <span className="ml-2 text-[9px] text-secondary">● AKTUÁLIS</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1">
                <Wind className="size-3 text-muted-foreground" strokeWidth={1.5}/>
                <span className="font-heading text-xs font-semibold text-foreground">
                  {dirLabel(seg.wind_dir)} {seg.wind_speed}
                </span>
                <span className="text-[9px] text-muted-foreground">kn</span>
              </div>
              {seg.storm_level > 0 && (
                <div className="flex items-center gap-1">
                  <CloudLightning className={cn('size-3', stormColor[seg.storm_level])} strokeWidth={1.5}/>
                  <span className={cn('text-[9px] font-semibold', stormColor[seg.storm_level])}>
                    {stormLabel[seg.storm_level]}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </Panel>
  )
}
