'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getPocketBase } from '@/lib/pocketbase'
import { useRace } from '@/components/race-context'

interface FinishOverlayProps {
  finishedAt: string
  onClose: () => void
}

export function FinishOverlay({ finishedAt, onClose }: FinishOverlayProps) {
  const { raceId } = useRace()
  const router = useRouter()
  const [position, setPosition] = useState<number | null>(null)
  const [totalTime, setTotalTime] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [mounted, setMounted] = useState(false)
  const [showContent, setShowContent] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    const pb = getPocketBase()

    async function load() {
      try {
        const race = await pb.collection('races').getOne(raceId)
        let raceStart = race.actual_start ? new Date(race.actual_start).getTime() : 0
        // Fallback: player_races joined_at
        if (!raceStart && pb.authStore.isValid) {
          try {
            const pr = await pb.collection('player_races').getFirstListItem(
              `race_id="${raceId}" && player_id="${pb.authStore.record?.id}"`
            )
            if (pr.joined_at) raceStart = new Date(pr.joined_at).getTime()
          } catch {}
        }
        const finishTime = new Date(finishedAt).getTime()
        const elapsed = raceStart > 0 ? Math.floor((finishTime - raceStart) / 1000) : 0
        const h = Math.floor(elapsed / 3600)
        const m = Math.floor((elapsed % 3600) / 60)
        const s = elapsed % 60
        setTotalTime(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)

        // Helyezés
        const positions = await pb.collection('race_positions').getFullList({
          filter: `race_id="${raceId}" && status="finished"`,
          sort: 'finished_at',
        })
        const myId = pb.authStore.record?.id
        const myIdx = positions.findIndex((p: any) => p.player_id === myId)
        setPosition(myIdx + 1)

        // Név
        if (pb.authStore.isValid) {
          setPlayerName(pb.authStore.record?.name || '')
        }
      } catch {}
    }

    load()
    // Animáció késleltetése
    const t = setTimeout(() => setShowContent(true), 300)
    return () => clearTimeout(t)
  }, [mounted, finishedAt])

  if (!mounted) return null

  const posLabel =
    position === 1 ? 'GYŐZTES'
    : position === 2 ? '2. HELY'
    : position === 3 ? '3. HELY'
    : position ? `${position}. HELY`
    : null

  function goToHarbor() {
    onClose()
    router.push('/kikoto')
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-card shadow-2xl transition-all duration-700"
        style={{
          opacity: showContent ? 1 : 0,
          transform: showContent ? 'translateY(0)' : 'translateY(20px)',
        }}
      >
        {/* Hangulatkép */}
        <div className="relative">
          <img
            src="/finish-befuto.jpg"
            alt="Vitorlás befut a célba a sárga FINISH bója mellett, a kikötő ünneplő tömegével, festett retró plakát stílusban"
            className="h-44 w-full object-cover sm:h-52"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
        </div>

        <div className="px-8 pb-8 pt-2 text-center">
          {/* Regatta felirat */}
          <p className="font-heading text-[11px] uppercase tracking-[0.4em] text-muted-foreground">
            Sirály Regatta
          </p>

          {/* Nagy CÉL */}
          <h2 className="mt-2 font-heading text-6xl font-black tracking-wider text-foreground">
            BEFUTÓ
          </h2>

          <div className="mx-auto my-5 h-0.5 w-20 bg-accent" />

          {/* Gratuláció */}
          <p className="font-heading text-2xl font-bold tracking-wide text-foreground text-balance">
            Gratulálunk{playerName ? `, ${playerName}` : ''}!
          </p>
          <p className="mt-3 leading-relaxed text-muted-foreground text-pretty">
            Köszönjük, hogy részt vettél a versenyen. Büszkék lehetsz a teljesítményedre,
            és reméljük, élvezted a Balaton szelét.
          </p>

          {/* Helyezés + idő adatok */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-md border border-border bg-secondary/40 px-4 py-4">
              <p className="font-heading text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Helyezés
              </p>
              <p
                className="mt-1 font-heading text-2xl font-black tracking-wide"
                style={{ color: position === 1 ? 'var(--accent)' : 'var(--foreground)' }}
              >
                {posLabel ?? '—'}
              </p>
            </div>
            <div className="rounded-md border border-border bg-secondary/40 px-4 py-4">
              <p className="font-heading text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Versenyidő
              </p>
              <p className="mt-1 font-heading text-2xl font-black tracking-wide text-foreground">
                {totalTime || '--:--:--'}
              </p>
            </div>
          </div>

          {/* Találkozunk a kikötőben */}
          <p className="mt-6 font-heading text-sm uppercase tracking-[0.3em] text-accent">
            Találkozunk a kikötőben
          </p>

          {/* Gomb */}
          <button
            onClick={goToHarbor}
            className="mt-5 w-full rounded-md bg-foreground px-12 py-3.5 font-heading text-[13px] font-bold uppercase tracking-[0.25em] text-background transition-opacity hover:opacity-90"
          >
            Vissza a kikötőbe
          </button>
        </div>
      </div>
    </div>
  )
}
