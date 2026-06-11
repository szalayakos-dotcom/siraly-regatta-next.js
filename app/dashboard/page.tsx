'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Sailboat, ChevronLeft, Pause } from 'lucide-react'
import { StatusBar } from '@/components/status-bar'
import { WindDial } from '@/components/wind-dial'
import { RaceChart } from '@/components/race-chart'
import { FleetStandings } from '@/components/fleet-standings'
import { SailTrim, TrimSnapshot } from '@/components/sail-trim'
import { ConditionsForecast } from '@/components/conditions-forecast'
import { TacticalBrief } from '@/components/tactical-brief'
import { WarningPanel, WarningState } from '@/components/warning-panel'
import { getPocketBase } from '@/lib/pocketbase'
import { useRace } from '@/components/race-context'
import { HeelIndicator } from '@/components/heel-indicator'
import { CheckpointOverlay } from '@/components/checkpoint-overlay'
import { FinishOverlay } from '@/components/finish-overlay'
import { Panel } from '@/components/panel'
import { StartConsole } from '@/components/start-console'
import { cn } from '@/lib/utils'
import type { SailState } from '@/components/sail-trim'

const TICK_INTERVAL = 10000 // 10 másodperc

// 80-as évek vitorlás műszerfal — szekció felirat sárgaréz névtáblával
function SectionLabel({ code, children }: { code: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="brass-plate label-caps rounded-[3px] px-1.5 py-0.5 text-[9px] leading-none">
        {code}
      </span>
      <span className="label-caps text-[10px] text-muted-foreground">{children}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

export default function Page() {
  const [raceStatus, setRaceStatus] = useState('active')
  const [warnings, setWarnings] = useState<WarningState>({
    vihar: 0, leszuras: false, drift: 0,
    vitorla: true, tuldoles: false, trimEfficiency: 0, raceAlert: null,
  })

  // Trim snapshot ref — mindig friss értéket tárol a tick számára
  const trimSnapshotRef = useRef<TrimSnapshot | null>(null)
  const [cpOverlay, setCpOverlay] = useState<{ index: number; name: string } | null>(null)
  const [finishOverlay, setFinishOverlay] = useState<{ finishedAt: string } | null>(null)
  const [overlaySails, setOverlaySails] = useState<SailState>({ gross: true, fock: true, genua: false, spinn: false, genakker: false })
  const lastCpRef = useRef<number>(-1)
  const finishShownRef = useRef(false)
  const [startState, setStartState] = useState<'waiting' | 'ready' | 'started' | 'expired'>('waiting')
  const [scheduledStart, setScheduledStart] = useState<number | null>(null)
  const [countdown, setCountdown] = useState<string>('')
  const [hasStarted, setHasStarted] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsedStr, setElapsedStr] = useState<string>('00:00')
  const alertedRef = useRef<Set<string>>(new Set())

  function playHorn() {
    const audio = new Audio('/sounds/horn.mp3')
    audio.play().catch(() => {})
  }

  const [heel, setHeel] = useState(0)

  const trimUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTrimChange = useCallback((snapshot: TrimSnapshot) => {
    trimSnapshotRef.current = snapshot
    // Debounce: 1 másodperc után írjuk a race_positions-be
    if (trimUpdateTimerRef.current) clearTimeout(trimUpdateTimerRef.current)
    trimUpdateTimerRef.current = setTimeout(async () => {
      const pb = getPocketBase()
      if (!pb.authStore.isValid) return
      try {
        const pos = await pb.collection('race_positions').getFirstListItem(
          `race_id="${raceId}" && player_id="${pb.authStore.record?.id}"`
        )
        await pb.collection('race_positions').update(pos.id, {
          sail_gross:     snapshot.sails.gross,
          sail_fock:      snapshot.sails.fock,
          sail_genua:     snapshot.sails.genua,
          sail_spinn_bool: snapshot.sails.spinn,
          sail_genakker:  snapshot.sails.genakker,
          trim_mainsheet:    snapshot.trim.mainsheet,
          trim_jibtrim:      snapshot.trim.jibtrim,
          trim_boomvang:     snapshot.trim.boomvang,
          trim_backstay:     snapshot.trim.backstay,
          trim_cunningham:   snapshot.trim.cunningham,
          trim_spinnshot:    snapshot.trim.spinnshot,
          trim_genakkershot: snapshot.trim.genakkershot,
        })
      } catch {}
    }, 1000)
  }, [])

  // Race status ellenőrzés
  useEffect(() => {
    const pb = getPocketBase()
    async function checkStatus() {
      try {
        const race = await pb.collection('races').getOne(raceId)
        setRaceStatus(race.status || 'active')
        if (race.scheduled_start) {
          setScheduledStart(new Date(race.scheduled_start).getTime())
        }
        // Már elindult-e?
        if (pb.authStore.isValid) {
          try {
            const pr = await pb.collection('player_races').getFirstListItem(
              `race_id="${raceId}" && player_id="${pb.authStore.record?.id}"`
            )
            if (pr.started_at) { setHasStarted(true); return }
          } catch {}
          // Ha van race_positions rekord → már elindult
          try {
            await pb.collection('race_positions').getFirstListItem(
              `race_id="${raceId}" && player_id="${pb.authStore.record?.id}"`
            )
            setHasStarted(true)
          } catch {}
        }
      } catch {}
    }
    checkStatus()
    const interval = setInterval(checkStatus, 10000)
    return () => clearInterval(interval)
  }, [])

  // Elapsed timer — rajt után előre számol
  useEffect(() => {
    if (!hasStarted || !startedAt) return
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000)
      const m = Math.floor(elapsed / 60)
      const s = elapsed % 60
      setElapsedStr(`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
    }, 1000)
    return () => clearInterval(interval)
  }, [hasStarted, startedAt])

  // Start countdown
  useEffect(() => {
    if (!scheduledStart || hasStarted) return
    const interval = setInterval(() => {
      const now = Date.now()
      const diff = scheduledStart - now
      const fifteenMin = 15 * 60 * 1000
      const fiveMin = 5 * 60 * 1000

      // Rajt figyelmeztetések T-10, T-5, T-4, T-1
      const minutes = Math.ceil(diff / 60000)
      if (diff > 0) {
        if (minutes === 10 && !alertedRef.current.has('T10')) {
          alertedRef.current.add('T10')
          playHorn()
          setWarnings(w => ({ ...w, raceAlert: 'T10' }))
          setTimeout(() => setWarnings(w => ({ ...w, raceAlert: null })), 5000)
        } else if (minutes === 5 && !alertedRef.current.has('T5')) {
          alertedRef.current.add('T5')
          playHorn()
          setWarnings(w => ({ ...w, raceAlert: 'T5' }))
          setTimeout(() => setWarnings(w => ({ ...w, raceAlert: null })), 5000)
        } else if (minutes === 4 && !alertedRef.current.has('T4')) {
          alertedRef.current.add('T4')
          playHorn()
          setWarnings(w => ({ ...w, raceAlert: 'T4' }))
          setTimeout(() => setWarnings(w => ({ ...w, raceAlert: null })), 5000)
        } else if (minutes === 1 && !alertedRef.current.has('T1')) {
          alertedRef.current.add('T1')
          playHorn()
          setWarnings(w => ({ ...w, raceAlert: 'T1' }))
          setTimeout(() => setWarnings(w => ({ ...w, raceAlert: null })), 5000)
        }
      }

      if (diff < -fifteenMin) {
        // 15 perccel a rajt után még nem indult → kilép
        setStartState('expired')
        clearInterval(interval)
        const pb = getPocketBase()
        if (pb.authStore.isValid) {
          pb.collection('player_races').getFirstListItem(
            `race_id="${raceId}" && player_id="${pb.authStore.record?.id}"`
          ).then(pr => {
            pb.collection('player_races').delete(pr.id)
            // Nevezési díj visszaadása
            pb.collection('player_profiles').getFirstListItem(`user_id="${pb.authStore.record?.id}"`).then(profile => {
              pb.collection('player_profiles').update(profile.id, { credits: (profile.credits || 0) + (pr.entry_fee || 0) })
            }).catch(() => {})
          }).catch(() => {})
        }
      } else if (diff < 0) {
        // Rajt után, még nem indult
        const elapsed = Math.abs(diff)
        const m = Math.floor(elapsed / 60000)
        const s = Math.floor((elapsed % 60000) / 1000)
        setCountdown(`+${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
        setStartState('ready')
      } else if (diff <= fiveMin) {
        // -5 perc → START aktív
        const m = Math.floor(diff / 60000)
        const s = Math.floor((diff % 60000) / 1000)
        setCountdown(`-${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
        setStartState('ready')
      } else {
        // Még várunk
        const m = Math.floor(diff / 60000)
        const s = Math.floor((diff % 60000) / 1000)
        setCountdown(`-${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
        setStartState('waiting')
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [scheduledStart, hasStarted])

  async function handleStart() {
    const pb = getPocketBase()
    if (!pb.authStore.isValid) return
    try {
      const pr = await pb.collection('player_races').getFirstListItem(
        `race_id="${raceId}" && player_id="${pb.authStore.record?.id}"`
      )
      await pb.collection('player_races').update(pr.id, { started_at: new Date().toISOString() })
      setHasStarted(true)
      setStartedAt(Date.now())
      setStartState('started')
    } catch {}
  }

  // CP figyelés
  useEffect(() => {
    const pb = getPocketBase()
    async function checkCp() {
      if (!pb.authStore.isValid) return
      try {
        const pos = await pb.collection('race_positions').getFirstListItem(
          `race_id="${raceId}" && player_id="${pb.authStore.record?.id}"`
        )
        // Cél elérés detektálás — csak ha az elmúlt 5 percben ért célba
        if (pos.status === 'finished' && !finishShownRef.current && pos.finished_at) {
          const finishedMs = new Date(pos.finished_at).getTime()
          const fiveMinAgo = Date.now() - 5 * 60 * 1000
          if (finishedMs > fiveMinAgo) {
            finishShownRef.current = true
            setFinishOverlay({ finishedAt: pos.finished_at })
          }
        }

        if (typeof pos.drift_angle === 'number') setHeel(pos.drift_angle * 3)
        const cp = pos.cp_index || 0
        if (cp > lastCpRef.current && lastCpRef.current >= 0) {
          // CP elért — overlay megnyitása
          try {
            const race = await pb.collection('races').getOne(raceId)
            const course = await pb.collection('courses').getOne(race.course_id)
            const pts = typeof course.points === 'string' ? JSON.parse(course.points) : (course.points || [])
            const main = pts.filter((p: any) => p.type !== 'waypoint').sort((a: any, b: any) => a.order - b.order)
            const cpName = main[cp]?.name || `CP ${cp}`
            setCpOverlay({ index: cp, name: cpName })
            if (trimSnapshotRef.current) setOverlaySails({ ...trimSnapshotRef.current.sails })
          } catch {
            setCpOverlay({ index: cp, name: `CP ${cp}` })
          }
        }
        lastCpRef.current = cp
      } catch {}
    }
    checkCp()
    const interval = setInterval(checkCp, 5000)
    return () => clearInterval(interval)
  }, [])

  // Engine tick
  useEffect(() => {
    const pb = getPocketBase()

    async function tick() {
      if (!pb.authStore.isValid) return
      if (!hasStarted) return  // Csak indulás után
      const snapshot = trimSnapshotRef.current
      if (!snapshot) return

      const userId = pb.authStore.record?.id
      if (!userId) return

      try {
        // Jelenlegi pozíció lekérése
        let posRecord: any = null
        try {
          posRecord = await pb.collection('race_positions').getFirstListItem(
            `race_id="${raceId}" && player_id="${userId}"`
          )
        } catch {}

        const { sails, trim } = snapshot

        // Csak vitorla és trim state írása — sebességet az engine számolja
        const data = {
          sail_gross:      sails.gross,
          sail_fock:       sails.fock,
          sail_genua:      sails.genua,
          sail_spinn_bool: sails.spinn,
          sail_genakker:   sails.genakker,
          sail_main:       sails.gross ? 'gross' : '',
          sail_head:       sails.genua ? 'genua' : sails.fock ? 'fock' : '',
          trim_mainsheet:    trim.mainsheet,
          trim_jibtrim:      trim.jibtrim,
          trim_boomvang:     trim.boomvang,
          trim_backstay:     trim.backstay,
          trim_cunningham:   trim.cunningham,
          trim_spinnshot:    trim.spinnshot,
          trim_genakkershot: trim.genakkershot,
        }

        if (posRecord) {
          await pb.collection('race_positions').update(posRecord.id, data)
        } else {
          await pb.collection('race_positions').create({
            ...data,
            lat: 46.9, lng: 17.9, cp_index: 0,
          })
        }
      } catch (e) {
        console.warn('Engine tick error:', e)
      }
    }

    // Első tick azonnal, majd 10mp-enként
    tick()
    const interval = setInterval(tick, TICK_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  const startReady = startState === 'ready' && !hasStarted

  return (
    <div className="flex min-h-screen flex-col bg-[oklch(0.93_0.02_250)]">
      <div className="relative flex min-w-0 flex-1 flex-col">

        {/* Szünet overlay */}
        {raceStatus === 'paused' && (
          <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-[oklch(0.18_0.03_250/0.94)] px-6 backdrop-blur-sm">
            <div className="max-w-md rounded-sm border border-[oklch(0.93_0.02_92/0.15)] bg-[oklch(0.93_0.02_92/0.05)] px-10 py-10 text-center">
              <Pause className="mx-auto mb-4 size-12 text-[oklch(0.93_0.02_92)]" strokeWidth={1.5} />
              <h2 className="font-heading text-3xl font-black uppercase leading-tight tracking-wide text-[oklch(0.93_0.02_92)] text-balance">
                Futam ideiglenesen felfüggesztve
              </h2>
              <p className="label-caps mt-3 text-[11px] text-[oklch(0.93_0.02_92/0.5)]">
                Hamarosan folytatjuk — lehet technikai hiba van, vagy csak szélcsend
              </p>
            </div>
          </div>
        )}

        {finishOverlay && (
          <FinishOverlay
            finishedAt={finishOverlay.finishedAt}
            onClose={() => setFinishOverlay(null)}
          />
        )}
        {!finishOverlay && cpOverlay && (
          <CheckpointOverlay
            cpIndex={cpOverlay.index}
            cpName={cpOverlay.name}
            sails={overlaySails}
            onSailChange={setOverlaySails}
            onClose={() => setCpOverlay(null)}
          />
        )}

        {/* Navigációs sáv — sárgaréz műszerfal fejléc */}
        <header className="flex items-center justify-between gap-3 border-b border-[oklch(0.42_0.04_248)] bg-[linear-gradient(180deg,oklch(0.3_0.035_248),oklch(0.2_0.03_250))] px-4 py-2">
          <a href="/kikoto" className="label-caps flex items-center gap-1.5 text-[11px] text-[oklch(0.82_0.03_92)] transition-colors hover:text-[oklch(0.95_0.02_92)]">
            <ChevronLeft className="size-4" />
            Kikötő
          </a>

          <div className="flex items-center gap-2 font-heading text-sm font-bold tracking-[0.2em] text-[oklch(0.92_0.02_92)]">
            <Sailboat className="size-4 text-[var(--gold)]" />
            FEDÉLZETI MŰSZERFAL
          </div>

          <div className="flex items-center gap-2">
            <span
              className="inline-block size-2 rounded-full"
              style={{
                background: hasStarted ? 'oklch(0.7 0.18 145)' : startReady ? 'oklch(0.7 0.2 28)' : 'oklch(0.4 0.03 250)',
                boxShadow: (hasStarted || startReady) ? '0 0 8px currentColor' : 'none',
              }}
              aria-hidden
            />
            <span className="label-caps text-[10px] text-[oklch(0.82_0.03_92)]">
              {hasStarted ? 'Versenyben' : startReady ? 'Rajtra kész' : 'Készenlét'}
            </span>
          </div>
        </header>

        {/* Központi rajtvezérlő pult */}
        <div className="border-b border-[oklch(0.42_0.04_248)] bg-[linear-gradient(180deg,oklch(0.22_0.03_250),oklch(0.16_0.025_250))] px-4 py-4">
          <StartConsole
            startState={startState}
            countdown={hasStarted ? `+${elapsedStr}` : countdown}
            hasStarted={hasStarted}
            onStart={handleStart}
          />
        </div>

        <StatusBar />
        <WarningPanel warnings={warnings} />

        <main className="flex flex-1 flex-col gap-3 overflow-auto p-3">

          {/* SOR 1: Térkép + Fedélzeti kamera */}
          <div className="flex shrink-0 flex-col gap-1.5">
            <SectionLabel code="NAV">Navigáció &amp; Fedélzeti kamera</SectionLabel>
            <div className="grid h-[380px] gap-3 lg:grid-cols-[1fr_507px]">
              <div className="h-[380px] overflow-hidden">
                <RaceChart />
              </div>
              {/* Retró CRT monitor */}
              <Panel code="CAM" title="Fedélzeti kép" bodyClassName="p-0" className="hidden w-[507px] lg:flex">
                <div className="crt-scanlines relative flex h-full items-center justify-center overflow-hidden bg-[oklch(0.16_0.01_250)] shadow-[inset_0_0_30px_oklch(0_0_0/0.7)]">
                  <span className="label-caps text-[11px] text-[oklch(0.7_0.02_92/0.35)]">Élő kép — várakozás</span>
                  <span className="absolute bottom-2 right-3 font-mono text-[10px] tracking-widest text-[oklch(0.6_0.14_28/0.75)]">● REC</span>
                </div>
              </Panel>
            </div>
          </div>

          {/* SOR 2: Szélmérő + Dőlés + Vitorla-trim */}
          <div className="flex shrink-0 flex-col gap-1.5">
            <SectionLabel code="TRIM">Szélmérő · Dőlésmérő · Vitorlaállítás</SectionLabel>
            <div className="grid h-[460px] gap-3 lg:grid-cols-[210px_210px_1fr]">
              <div className="h-[460px] overflow-hidden">
                <WindDial />
              </div>
              <Panel code="HEEL" title="Dőlésmérő" bodyClassName="flex items-center justify-center p-3">
                <HeelIndicator heel={heel} />
              </Panel>
              <div className="h-[460px] overflow-hidden">
                <SailTrim onWarningsChange={setWarnings} onTrimChange={handleTrimChange} />
              </div>
            </div>
          </div>

          {/* SOR 3: Versenyállás + Időjárás + Taktika */}
          <div className="flex flex-1 flex-col gap-1.5">
            <SectionLabel code="INFO">Versenyállás · Előrejelzés · Taktika</SectionLabel>
            <div className="grid min-h-[160px] flex-1 gap-3 lg:grid-cols-3">
              <div className="overflow-hidden">
                <FleetStandings />
              </div>
              <div className="overflow-hidden">
                <ConditionsForecast />
              </div>
              <div className="overflow-hidden">
                <TacticalBrief />
              </div>
            </div>
          </div>

        </main>
      </div>
    </div>
  )
}
