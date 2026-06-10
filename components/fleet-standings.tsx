'use client'

import { useEffect, useState } from 'react'
import { Panel } from './panel'
import { cn } from '@/lib/utils'
import { getPocketBase, RACE_ID } from '@/lib/pocketbase'
import { kmhToKnots } from '@/lib/units'

interface Standing {
  pos: number
  name: string
  boatName: string
  gap: string
  speed: number
  you: boolean
}

export function FleetStandings() {
  const [fleet, setFleet] = useState<Standing[]>([])

  useEffect(() => {
    const pb = getPocketBase()

    async function load() {
      try {
        const positions = await pb.collection('race_positions').getFullList({
          filter: `race_id="${RACE_ID}"`,
        })
        const sorted = positions.sort((a, b) =>
          (b.cp_index || 0) - (a.cp_index || 0) || (b.speed_kmh || 0) - (a.speed_kmh || 0)
        )
        const myId = pb.authStore.record?.id

        // Felhasználónevek betöltése
        const playerIds = [...new Set(sorted.map((p: any) => p.player_id).filter(Boolean))]
        const nameMap: Record<string, string> = {}
        await Promise.all(playerIds.map(async (pid: any) => {
          try {
            const user = await pb.collection('users').getOne(pid)
            nameMap[pid] = user.name || user.email || 'Versenyző'
          } catch {
            try {
              const profile = await pb.collection('player_profiles').getFirstListItem(`user_id='${pid}'`)
              nameMap[pid] = profile.name || profile.username || 'Versenyző'
            } catch { nameMap[pid] = 'Versenyző' }
          }
        }))

        const leader = sorted[0]?.speed_kmh || 0

        setFleet(sorted.map((p: any, i: number) => ({
          pos: i + 1,
          name: p.player_id === myId ? 'Te' : (nameMap[p.player_id] || 'Versenyző'),
          boatName: `CP ${p.cp_index || 0}`,
          gap: i === 0 ? '—' : `+${(kmhToKnots(leader - (p.speed_kmh || 0)) * 0.1).toFixed(1)}p`,
          speed: Math.round(kmhToKnots(p.speed_kmh || 0) * 10) / 10,
          you: p.player_id === myId,
        })))
      } catch (e) {}
    }

    load()
    const unsub = pb.collection('race_positions').subscribe('*', () => load())
    return () => { unsub.then(fn => fn()) }
  }, [])

  return (
    <Panel title="Versenyállás" code="FLT" bodyClassName="p-0">
      {fleet.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">Nincs aktív versenyző</div>
      ) : (
        <ul className="divide-y divide-border">
          {fleet.map((b) => (
            <li key={b.pos} className={cn('flex items-center gap-3 px-4 py-2.5', b.you && 'bg-accent/10')}>
              <span className={cn(
                'flex size-6 items-center justify-center rounded-full font-heading text-xs font-bold',
                b.pos === 1 ? 'bg-accent text-accent-foreground' : 'border border-border text-foreground'
              )}>
                {b.pos}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-sm font-semibold tracking-wide text-foreground">
                  {b.name}
                  {b.you && (
                    <span className="ml-2 rounded-sm bg-secondary px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-secondary-foreground">Te</span>
                  )}
                </p>
                <p className="label-caps text-[8px] text-muted-foreground">{b.boatName} · {b.speed.toFixed(1)} kn</p>
              </div>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{b.gap}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
