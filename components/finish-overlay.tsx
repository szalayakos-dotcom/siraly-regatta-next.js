'use client'

import { useEffect, useState } from 'react'
import { getPocketBase, RACE_ID } from '@/lib/pocketbase'

interface FinishOverlayProps {
  finishedAt: string
  onClose: () => void
}

export function FinishOverlay({ finishedAt, onClose }: FinishOverlayProps) {
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
        const race = await pb.collection('races').getOne(RACE_ID)
        let raceStart = race.actual_start ? new Date(race.actual_start).getTime() : 0
        // Fallback: player_races joined_at
        if (!raceStart && pb.authStore.isValid) {
          try {
            const pr = await pb.collection('player_races').getFirstListItem(
              `race_id="${RACE_ID}" && player_id="${pb.authStore.record?.id}"`
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
          filter: `race_id="${RACE_ID}" && status="finished"`,
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
    setTimeout(() => setShowContent(true), 300)
  }, [mounted, finishedAt])

  if (!mounted) return null

  const posEmoji = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : null
  const posLabel = position === 1 ? 'GYŐZTES' : position === 2 ? '2. HELY' : position === 3 ? '3. HELY' : `${position}. HELY`

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(8, 15, 22, 0.96)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        textAlign: 'center', maxWidth: '520px', padding: '48px 40px',
        opacity: showContent ? 1 : 0,
        transform: showContent ? 'translateY(0)' : 'translateY(20px)',
        transition: 'all 0.6s ease',
      }}>
        {/* CÉL felirat */}
        <div style={{
          fontFamily: 'var(--font-heading)', fontSize: '11px', letterSpacing: '6px',
          color: 'rgba(253,249,224,0.6)', marginBottom: '16px', textTransform: 'uppercase',
        }}>
          ⚓ &nbsp; SIRÁLY REGATTA &nbsp; ⚓
        </div>

        {/* Nagy CÉL */}
        <div style={{
          fontFamily: 'var(--font-heading)', fontSize: '72px', fontWeight: 900,
          color: '#fdf9e0', letterSpacing: '4px', lineHeight: 1,
          marginBottom: '8px',
        }}>
          CÉL
        </div>

        {/* Vonal */}
        <div style={{ width: '80px', height: '2px', background: 'var(--accent)', margin: '20px auto' }}/>

        {/* Helyezés */}
        {position && (
          <div style={{ marginBottom: '32px' }}>
            {posEmoji && (
              <div style={{ fontSize: '64px', lineHeight: 1, marginBottom: '8px' }}>
                {posEmoji}
              </div>
            )}
            <div style={{
              fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 900,
              color: position === 1 ? '#c8a030' : position <= 3 ? '#fdf9e0' : 'rgba(253,249,224,0.6)',
              letterSpacing: '3px',
            }}>
              {posLabel}
            </div>
            {playerName && (
              <div style={{
                fontFamily: 'var(--font-heading)', fontSize: '16px',
                color: 'var(--accent)', letterSpacing: '2px', marginTop: '6px',
              }}>
                {playerName}
              </div>
            )}
          </div>
        )}

        {/* Idő */}
        <div style={{
          display: 'inline-block',
          border: '1px solid rgba(253,249,224,0.2)', borderRadius: '4px',
          padding: '16px 32px', marginBottom: '40px',
          background: 'rgba(253,249,224,0.08)',
        }}>
          <div style={{
            fontFamily: 'var(--font-heading)', fontSize: '10px', letterSpacing: '3px',
            color: 'rgba(253,249,224,0.6)', marginBottom: '6px',
          }}>
            VERSENYIDŐ
          </div>
          <div style={{
            fontFamily: 'var(--font-heading)', fontSize: '40px', fontWeight: 900,
            color: '#fdf9e0', letterSpacing: '2px', lineHeight: 1,
          }}>
            {totalTime || '--:--:--'}
          </div>
        </div>

        {/* Tovább gomb */}
        <div>
          <button onClick={onClose} style={{
            background: 'var(--foreground)', color: 'var(--background)',
            border: 'none', borderRadius: '4px', padding: '14px 48px',
            fontFamily: 'var(--font-heading)', fontWeight: 700,
            fontSize: '13px', letterSpacing: '3px', cursor: 'pointer',
            transition: 'all 0.2s',
          }}>
            FEDÉLZET →
          </button>
        </div>
      </div>
    </div>
  )
}
