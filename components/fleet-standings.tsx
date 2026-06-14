'use client'

import { useEffect, useState } from 'react'
import { Panel } from './panel'
import { cn } from '@/lib/utils'
import { getPocketBase } from '@/lib/pocketbase'
import { useRace } from '@/components/race-context'
import { kmhToKnots } from '@/lib/units'

// class_id → megjelenítendő osztálynév
const CLASS_LABELS: Record<string, string> = {
  '9g4us1y1ye7afym': 'Ys.I',
  '40t0bopld7pwwo4': 'Ys.II',
  'lgtakoks0p1jnvd': 'Ys.III',
}

interface Row {
  pos: number
  name: string
  cp: number
  speed: number
  you: boolean
  finished: boolean
  finishedAtMs: number | null
}
interface ClassGroup { classId: string; label: string; rows: Row[] }

// Időhátrány a lista vezetőjéhez képest — csak célba ért hajóknál pontos
function fmtGap(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `+${s}mp`
  const m = Math.floor(s / 60), r = s % 60
  return `+${m}:${String(r).padStart(2, '0')}`
}
function gapLabel(row: Row, leader: Row | undefined): string {
  if (!leader || row === leader) return '—'
  if (row.finished && leader.finished && row.finishedAtMs != null && leader.finishedAtMs != null)
    return fmtGap(row.finishedAtMs - leader.finishedAtMs)
  return '—'
}

const sortFn = (a: any, b: any) => {
  const af = a.status === 'finished', bf = b.status === 'finished'
  if (af && bf) return new Date(a.finished_at || 0).getTime() - new Date(b.finished_at || 0).getTime()
  if (af) return -1
  if (bf) return 1
  return (b.cp_index || 0) - (a.cp_index || 0) || (b.speed_kmh || 0) - (a.speed_kmh || 0)
}
function toRow(p: any, i: number, myId: string | undefined, nameMap: Record<string, string>): Row {
  return {
    pos: i + 1,
    name: p.player_id === myId ? 'Te' : (nameMap[p.player_id] || 'Versenyző'),
    cp: p.cp_index || 0,
    speed: Math.round(kmhToKnots(p.speed_kmh || 0) * 10) / 10,
    you: p.player_id === myId,
    finished: p.status === 'finished',
    finishedAtMs: p.finished_at ? new Date(p.finished_at).getTime() : null,
  }
}

function StandRow({ r, leader }: { r: Row; leader: Row | undefined }) {
  return (
    <li className={cn('flex items-center gap-2 px-2.5 py-2', r.you && 'bg-accent/10')}>
      <span className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-full font-heading text-[10px] font-bold',
        r.pos === 1 ? 'bg-accent text-accent-foreground' : 'border border-border text-foreground'
      )}>{r.pos}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-heading text-xs font-semibold tracking-wide text-foreground">
          {r.name}
          {r.you && <span className="ml-1.5 rounded-sm bg-secondary px-1 py-0.5 text-[7px] uppercase tracking-wider text-secondary-foreground">Te</span>}
        </p>
        <p className="label-caps text-[7px] text-muted-foreground">CP {r.cp} · {r.speed.toFixed(1)} kn</p>
      </div>
      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{gapLabel(r, leader)}</span>
    </li>
  )
}

export function FleetStandings() {
  const { raceId } = useRace()
  const [groups, setGroups] = useState<ClassGroup[]>([])
  const [absolute, setAbsolute] = useState<Row[]>([])

  useEffect(() => {
    if (!raceId) return
    const pb = getPocketBase()

    async function load() {
      try {
        const positions = await pb.collection('race_positions').getFullList({ filter: `race_id="${raceId}"` })
        const myId = pb.authStore.record?.id
        const playerIds = [...new Set(positions.map((p: any) => p.player_id).filter(Boolean))]
        const nameMap: Record<string, string> = {}
        await Promise.all(playerIds.map(async (pid: any) => {
          try {
            const u = await pb.collection('users').getOne(pid)
            nameMap[pid] = u.name || u.email || 'Versenyző'
          } catch {
            try {
              const pr = await pb.collection('player_profiles').getFirstListItem(`player_id="${pid}"`)
              nameMap[pid] = pr.name || pr.username || 'Versenyző'
            } catch { nameMap[pid] = 'Versenyző' }
          }
        }))

        // Összesített (abszolút) befutó — osztálytól függetlenül
        const abs = [...positions].sort(sortFn).map((p, i) => toRow(p, i, myId, nameMap))
        setAbsolute(abs)

        // Osztályonként
        const byClass: Record<string, any[]> = {}
        for (const p of positions) { const c = p.boat_class || '—'; (byClass[c] ||= []).push(p) }
        const classIds = Object.keys(byClass).sort((a, b) => (CLASS_LABELS[a] || a).localeCompare(CLASS_LABELS[b] || b))
        setGroups(classIds.map(c => ({
          classId: c,
          label: CLASS_LABELS[c] || 'Osztály',
          rows: byClass[c].sort(sortFn).map((p, i) => toRow(p, i, myId, nameMap)),
        })))
      } catch (e) {}
    }

    load()
    const interval = setInterval(load, 10000)
    const unsub = pb.collection('race_positions').subscribe('*', () => load())
    return () => { clearInterval(interval); unsub.then(fn => fn()) }
  }, [raceId])

  const showClassHeaders = groups.length > 1

  return (
    <Panel title="Versenyállás" code="FLT" bodyClassName="p-0">
      {absolute.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">Nincs aktív versenyző</div>
      ) : (
        <div className="grid grid-cols-2 divide-x divide-border">
          {/* BAL — osztályonként */}
          <div>
            <div className="border-b border-border bg-muted/30 px-2.5 py-1 label-caps text-[8px] font-bold tracking-wider text-foreground">Osztályonként</div>
            {groups.map(g => (
              <div key={g.classId}>
                {showClassHeaders && (
                  <div className="bg-secondary/15 px-2.5 py-1 label-caps text-[8px] font-bold tracking-wider text-foreground">{g.label}</div>
                )}
                <ul className="divide-y divide-border">
                  {g.rows.map((r, i) => (<StandRow key={`c-${g.classId}-${i}`} r={r} leader={g.rows[0]} />))}
                </ul>
              </div>
            ))}
          </div>
          {/* JOBB — összesített befutó */}
          <div>
            <div className="border-b border-border bg-muted/30 px-2.5 py-1 label-caps text-[8px] font-bold tracking-wider text-foreground">Összesített</div>
            <ul className="divide-y divide-border">
              {absolute.map((r, i) => (<StandRow key={`a-${i}`} r={r} leader={absolute[0]} />))}
            </ul>
          </div>
        </div>
      )}
    </Panel>
  )
}
