'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { StatusBar } from '@/components/status-bar'
import { WindDial } from '@/components/wind-dial'
import { RaceChart } from '@/components/race-chart'
import { FleetStandings } from '@/components/fleet-standings'
import { SailTrim, TrimSnapshot } from '@/components/sail-trim'
import { ConditionsForecast } from '@/components/conditions-forecast'
import { TacticalBrief } from '@/components/tactical-brief'
import { WarningPanel, WarningState } from '@/components/warning-panel'
import { getPocketBase, RACE_ID } from '@/lib/pocketbase'
import { HeelIndicator } from '@/components/heel-indicator'
import { CheckpointOverlay } from '@/components/checkpoint-overlay'
import { FinishOverlay } from '@/components/finish-overlay'
import type { SailState } from '@/components/sail-trim'

const TICK_INTERVAL = 10000 // 10 másodperc

export default function Page() {
  const [raceStatus, setRaceStatus] = useState('active')
  const [warnings, setWarnings] = useState<WarningState>({
    vihar: 0, leszuras: false, drift: 0,
    vitorla: true, tuldoles: false, trimEfficiency: 0,
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

  const [heel, setHeel] = useState(0)

  const handleTrimChange = useCallback((snapshot: TrimSnapshot) => {
    trimSnapshotRef.current = snapshot
  }, [])

  // Race status ellenőrzés
  useEffect(() => {
    const pb = getPocketBase()
    async function checkStatus() {
      try {
        const race = await pb.collection('races').getOne(RACE_ID)
        setRaceStatus(race.status || 'active')
        if (race.scheduled_start) {
          setScheduledStart(new Date(race.scheduled_start).getTime())
        }
        // Már elindult-e?
        if (pb.authStore.isValid) {
          try {
            const pr = await pb.collection('player_races').getFirstListItem(
              `race_id="${RACE_ID}" && player_id="${pb.authStore.record?.id}"`
            )
            if (pr.started_at) { setHasStarted(true); return }
          } catch {}
          // Ha van race_positions rekord → már elindult
          try {
            await pb.collection('race_positions').getFirstListItem(
              `race_id="${RACE_ID}" && player_id="${pb.authStore.record?.id}"`
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

  // Start countdown
  useEffect(() => {
    if (!scheduledStart || hasStarted) return
    const interval = setInterval(() => {
      const now = Date.now()
      const diff = scheduledStart - now
      const fifteenMin = 15 * 60 * 1000
      const fiveMin = 5 * 60 * 1000

      if (diff < -fifteenMin) {
        // 15 perccel a rajt után még nem indult → kilép
        setStartState('expired')
        clearInterval(interval)
        const pb = getPocketBase()
        if (pb.authStore.isValid) {
          pb.collection('player_races').getFirstListItem(
            `race_id="${RACE_ID}" && player_id="${pb.authStore.record?.id}"`
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
        `race_id="${RACE_ID}" && player_id="${pb.authStore.record?.id}"`
      )
      await pb.collection('player_races').update(pr.id, { started_at: new Date().toISOString() })
      setHasStarted(true)
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
          `race_id="${RACE_ID}" && player_id="${pb.authStore.record?.id}"`
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
            const race = await pb.collection('races').getOne(RACE_ID)
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
            `race_id="${RACE_ID}" && player_id="${userId}"`
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

  return (
    <div className="flex min-h-screen bg-background flex-col">
      <div className="flex min-w-0 flex-1 flex-col w-full" style={{ position: 'relative' }}>
        {raceStatus === 'paused' && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(26,42,58,0.92)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: '16px',
          }}>
            <div style={{ textAlign: 'center', maxWidth: '480px', padding: '40px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏸</div>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '36px', fontWeight: 900, color: '#f2e8c9', letterSpacing: '2px', marginBottom: '8px' }}>
                FUTAM IDEIGLENESEN<br/>FELFÜGGESZTVE
              </h2>
              <p style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', letterSpacing: '3px', color: 'rgba(242,232,201,0.5)', marginTop: '12px' }}>
                HAMAROSAN FOLYTATJUK — LEHET TECHNIKAI HIBA VAN, VAGY CSAK SZÉLCSEND
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
        {/* Navigációs sáv */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 16px', background: 'var(--muted)',
          borderBottom: '1px solid var(--border)',
        }}>
          <a href="/kikoto" style={{
            fontFamily: 'var(--font-heading)', fontSize: '11px', fontWeight: 700,
            letterSpacing: '2px', color: 'var(--muted-foreground)',
            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            ← KIKÖTŐ
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {countdown && !hasStarted && (
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: startState === 'ready' ? '#4a9e6a' : 'var(--muted-foreground)', letterSpacing: '2px' }}>
                {countdown}
              </span>
            )}
            <button
              onClick={startState === 'ready' && !hasStarted ? handleStart : undefined}
              disabled={startState !== 'ready' || hasStarted}
              style={{
                background: hasStarted ? 'var(--muted)' : startState === 'ready' ? '#4a9e6a' : 'rgba(74,158,106,0.15)',
                color: hasStarted ? 'var(--muted-foreground)' : startState === 'ready' ? '#fff' : '#4a9e6a',
                border: `2px solid ${hasStarted ? 'var(--border)' : '#4a9e6a'}`,
                borderRadius: '4px', padding: '8px 32px',
                fontFamily: 'var(--font-heading)', fontWeight: 900,
                fontSize: '16px', letterSpacing: '3px',
                cursor: startState === 'ready' && !hasStarted ? 'pointer' : 'default',
                transition: 'all 0.2s',
                boxShadow: startState === 'ready' && !hasStarted ? '0 0 16px rgba(74,158,106,0.4)' : 'none',
              }}
            >
              {hasStarted ? '⛵ ELINDULTÁL' : '⛵ RAJT'}
            </button>
          </div>
        </div>
        <StatusBar />
        <WarningPanel warnings={warnings} />
        <main style={{
          flex: 1, overflow: 'auto', padding: '8px',
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>

          {/* SOR 1: Térkép + Videó (4:3) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', height: '380px', flexShrink: 0 }}>
            <div style={{ height: '380px', overflow: 'hidden' }}>
              <RaceChart />
            </div>
            {/* Videó: 4:3 arány → 280px magas → 373px széles */}
            <div style={{
              width: '507px', height: '380px', flexShrink: 0,
              background: '#1a1a1a', border: '6px solid #333',
              borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8), 0 4px 16px rgba(0,0,0,0.4)',
              position: 'relative', overflow: 'hidden',
            }}>
              {/* Retro TV CRT hatás */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.05) 2px, rgba(0,0,0,0.05) 4px)',
                pointerEvents: 'none', zIndex: 1,
              }}/>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', letterSpacing: '3px', color: 'rgba(255,255,255,0.3)', zIndex: 2 }}>VIDEO</span>
            </div>
          </div>

          {/* SOR 2: WindDial + Heel + SailTrim */}
          <div style={{ display: 'grid', gridTemplateColumns: '200px 200px 1fr', gap: '8px', height: '320px', flexShrink: 0 }}>

            {/* WindDial */}
            <div style={{ height: '320px', overflow: 'hidden' }}>
              <WindDial />
            </div>

            {/* Heel műszer — azonos magasság */}
            <div style={{
              height: '320px', background: 'var(--card)',
              border: '1px solid var(--border)', borderRadius: '4px',
              padding: '6px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              <HeelIndicator heel={heel} />
            </div>

            {/* SailTrim */}
            <div style={{ height: '320px', overflow: 'hidden' }}>
              <SailTrim onWarningsChange={setWarnings} onTrimChange={handleTrimChange} />
            </div>
          </div>

          {/* SOR 3: Versenyállás + Időjárás + Taktika */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', flex: 1, minHeight: '160px' }}>
            <div style={{ overflow: 'hidden' }}>
              <FleetStandings />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <ConditionsForecast />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <TacticalBrief />
            </div>
          </div>

        </main>
      </div>
    </div>
  )
}
