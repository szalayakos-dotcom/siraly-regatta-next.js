'use client'

import { useEffect, useState } from 'react'
import { getPocketBase } from '@/lib/pocketbase'
import { useRace } from '@/components/race-context'

// Meg kell egyeznie az engine FINISH_WINDOW_MIN-jével (alap 120 perc).
const WINDOW_MIN = 120

export function FirstFinishOverlay() {
  const { raceId } = useRace()
  const [show, setShow] = useState(false)
  const [deadline, setDeadline] = useState<number | null>(null)
  const [remaining, setRemaining] = useState('')

  // Figyeljük, mikor fut be az első hajó (race.first_finish_at)
  useEffect(() => {
    if (!raceId) return
    const pb = getPocketBase()
    let stopped = false

    async function check() {
      try {
        const race = await pb.collection('races').getOne(raceId)
        if (!race.first_finish_at) return

        // Ha én már befutottam / kiestem, ne mutassuk
        let mineDone = false
        if (pb.authStore.isValid) {
          try {
            const mine = await pb.collection('race_positions').getFirstListItem(
              `race_id="${raceId}" && player_id="${pb.authStore.record?.id}"`
            )
            mineDone = mine.status === 'finished' || mine.status === 'dnf'
          } catch {}
        }

        const seen = typeof window !== 'undefined' && window.localStorage.getItem(`siraly_ff_${raceId}`)
        if (!mineDone && !seen && !stopped) {
          setDeadline(new Date(race.first_finish_at).getTime() + WINDOW_MIN * 60000)
          setShow(true)
        }
      } catch {}
    }

    check()
    const iv = setInterval(check, 20000)
    return () => { stopped = true; clearInterval(iv) }
  }, [raceId])

  // Visszaszámláló a határidőig
  useEffect(() => {
    if (!show || !deadline) return
    function tick() {
      const ms = deadline! - Date.now()
      if (ms <= 0) { setRemaining('00:00:00'); return }
      const h = Math.floor(ms / 3600000)
      const m = Math.floor((ms % 3600000) / 60000)
      const s = Math.floor((ms % 60000) / 1000)
      setRemaining(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [show, deadline])

  function dismiss() {
    if (raceId && typeof window !== 'undefined') window.localStorage.setItem(`siraly_ff_${raceId}`, '1')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-background/90 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-lg border border-border bg-card text-center shadow-2xl">
        <div className="bg-accent px-6 py-3">
          <p className="font-heading text-sm font-black uppercase tracking-[0.3em] text-accent-foreground">Első befutó!</p>
        </div>
        <div className="px-7 py-6">
          <p className="font-heading text-xl font-bold text-foreground text-balance">
            Az élen haladó hajó beért a célba.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">
            Innentől <span className="font-bold text-foreground">2 órátok</span> maradt befutni, különben a verseny lezárul.
          </p>
          <div className="mx-auto mt-5 rounded-md border border-border bg-secondary/40 px-4 py-3">
            <p className="label-caps text-[9px] text-muted-foreground">Hátralévő idő</p>
            <p className="mt-1 font-heading text-2xl font-black tabular-nums text-foreground">{remaining || '02:00:00'}</p>
          </div>
          <button
            onClick={dismiss}
            className="mt-5 w-full rounded-md bg-foreground px-8 py-3 font-heading text-[12px] font-bold uppercase tracking-[0.25em] text-background transition-opacity hover:opacity-90"
          >
            Hajrá!
          </button>
        </div>
      </div>
    </div>
  )
}
