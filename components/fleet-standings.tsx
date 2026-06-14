'use client'

import { useEffect, useState } from 'react'
import { Panel } from './panel'
import { cn } from '@/lib/utils'
import { getPocketBase } from '@/lib/pocketbase'
import { useRace } from '@/components/race-context'
import { kmhToKnots } from '@/lib/units'

// class_id → megjelenítendő osztálynév (ld. kikoto/entry oldalak)
const CLASS_LABELS: Record<string, string> = {
  '9g4us1y1ye7afym': 'Ys.I',
  '40t0bopld7pwwo4': 'Ys.II',
  'lgtakoks0p1jnvd': 'Ys.III',
}

interface Standing {
  pos: number
  name: string
  boatName: string
  gap: string
  speed: number
  you: boolean
}

interface ClassGroup {
  classId: string
  label: string
  rows: Standing[]
}

export function FleetStandings() {
  const { raceId } = useRace()
  const [groups, setGroups] = useState<ClassGroup[]>([])

  useEffect(() => {
    if (!raceId) return
    const pb = getPocketBase()

    async function load() {
      try {
        const positions = await pb.collection('race_positions').getFullList({
          filter: `race_id="${raceId}"`,
        })
        const myId = pb.authStore.record?.id

        // Felhasználónevek betöltése
        const playerIds = [...new Set(positions.map((p: any) => p.player_id).filter(Boolean))]
        const nameMap: Record<string, string> = {}
        await Promise.all(playerIds.map(async (pid: any) => {
          try {
            const user = await pb.collection('users').getOne(pid)
            nameMap[pid] = user.name || user.email || 'Versenyző'
          } catch {
            try {
              const profile = await pb.collection('player_profiles').getFirstListItem(`player_id="${pid}"`)
              nameMap[pid] = profile.name || profile.username || 'Versenyző'
            } catch { nameMap[pid] = 'Versenyző' }
          }
        }))

        // Csoportosítás hajóosztály szerint
        const byClass: Record<string, any[]> = {}
        for (const p of positions) {
          const cls = p.boat_class || '—'
          ;(byClass[cls] ||= []).push(p)
        }

        // Rendezés OSZTÁLYON BELÜL: célba értek a célidő sorrendjében, utánuk a futók haladás szerint
        const sortFn = (a: any, b: any) => {
          const af = a.status === 'finished', bf = b.status === 'finished'
          if (af && bf) return new Date(a.finished_at || 0).getTime() - new Date(b.finished_at || 0).getTime()
          if (af) return -1
          if (bf) return 1
          return (b.cp_index || 0) - (a.cp_index || 0) || (b.speed_kmh || 0) - (a.speed_kmh || 0)
        }

        const classIds = Object.keys(byClass).sort((a, b) =>
          (CLASS_LABELS[a] || a).localeCompare(CLASS_LABELS[b] || b)
        )

        const result: ClassGroup[] = classIds.map(cls => {
          const sorted = byClass[cls].sort(sortFn)
          const leader = sorted[0]?.speed_kmh || 0
          return {
            classId: cls,
            label: CLASS_LABELS[cls] || 'Osztály',
            rows: sorted.map((p: any, i: number) => ({
              pos: i + 1,
              name: p.player_id === myId ? 'Te' : (nameMap[p.player_id] || 'Versenyző'),
              boatName: `CP ${p.cp_index || 0}`,
              gap: i === 0 ? '—' : `+${(kmhToKnots(leader - (p.speed_kmh || 0)) * 0.1).toFixed(1)}p`,
              speed: Math.round(kmhToKnots(p.speed_kmh || 0) * 10) / 10,
              you: p.player_id === myId,
            })),
          }
        })

        setGroups(result)
      } catch (e) {}
    }

    load()
    const interval = setInterval(load, 10000)
    const unsub = pb.collection('race_positions').subscribe('*', () => load())
    return () => { clearInterval(interval); unsub.then(fn => fn()) }
  }, [raceId])

  const total = groups.reduce((n, g) => n + g.rows.length, 0)
  const showClassHeaders = groups.length > 1   // egyosztályos versenynél nincs fejléc

  return (
    <Panel title="Versenyállás" code="FLT" bodyClassName="p-0">
      {total === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">Nincs aktív versenyző</div>
      ) : (
        <div className="divide-y divide-border">
          {groups.map((g) => (
            <div key={g.classId}>
              {showClassHeaders && (
                <div className="bg-secondary/10 px-4 py-1.5 label-caps text-[9px] font-bold tracking-wider text-secondary-foreground">
                  {g.label}
                </div>
              )}
              <ul className="divide-y divide-border">
                {g.rows.map((b) => (
                  <li key={`${g.classId}-${b.pos}`} className={cn('flex items-center gap-3 px-4 py-2.5', b.you && 'bg-accent/10')}>
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
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
