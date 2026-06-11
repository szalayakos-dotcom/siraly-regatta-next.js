'use client'

import { useEffect, useState } from 'react'
import { getPocketBase, RACE_ID } from '@/lib/pocketbase'
import { kmhToKnots } from '@/lib/units'
import { cn } from '@/lib/utils'

const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090'

interface SailState {
  gross: boolean; fock: boolean; genua: boolean; spinn: boolean; genakker: boolean
}

interface CheckpointOverlayProps {
  cpIndex: number
  cpName: string
  onClose: () => void
  sails: SailState
  onSailChange: (sails: SailState) => void
}

const WIND_DIRS = ['É','ÉK','K','DK','D','DNy','Ny','ÉNy']
const dirLabel = (deg: number) => WIND_DIRS[Math.round(((deg%360)+360)%360/45)%8]

function SailBtn({ label, active, onClick, color = 'secondary' }: { label: string; active: boolean; onClick: () => void; color?: 'secondary' | 'accent' }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '8px 4px', borderRadius: '4px', cursor: 'pointer',
      border: `1px solid ${active ? '#4a9e6a' : 'var(--border)'}`,
      background: active ? 'rgba(74, 158, 106, 0.18)' : 'var(--background)',
      color: active ? '#4a9e6a' : 'var(--muted-foreground)',
      fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '11px',
      letterSpacing: '1px', textTransform: 'uppercase' as const,
      transition: 'all 0.15s',
    }}>
      {label}
    </button>
  )
}

export function CheckpointOverlay({ cpIndex, cpName, onClose, sails, onSailChange }: CheckpointOverlayProps) {
  const [elapsedSec, setElapsedSec] = useState(0)
  const [totalSec, setTotalSec] = useState(0)
  const [position, setPosition] = useState<number | null>(null)
  const [nextWind, setNextWind] = useState<{ dir: number; speed: number; storm: number } | null>(null)
  const [earnedCredits, setEarnedCredits] = useState(0)
  const [earnedXp, setEarnedXp] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    const pb = getPocketBase()

    async function load() {
      try {
        // Verseny kezdete
        const race = await pb.collection('races').getOne(RACE_ID)
        const raceStart = race.actual_start ? new Date(race.actual_start).getTime() : Date.now()
        const now = Date.now()
        setTotalSec(Math.floor((now - raceStart) / 1000))

        // Következő szakasz időjárása
        const segs = await pb.collection('weather_segments').getFullList({
          filter: `race_id="${RACE_ID}"`, sort: 'from_cp_index',
        })
        const nextSeg = segs.find((s: any) => s.from_cp_index === cpIndex)
        if (nextSeg) {
          setNextWind({
            dir: nextSeg.wind_dir,
            speed: Math.round(kmhToKnots(nextSeg.wind_speed) * 10) / 10,
            storm: nextSeg.storm_level || 0,
          })
        }

        // Helyezés
        const positions = await pb.collection('race_positions').getFullList({
          filter: `race_id="${RACE_ID}"`, sort: '-cp_index',
        })
        const myId = pb.authStore.record?.id
        const myIdx = positions.findIndex((p: any) => p.player_id === myId)
        if (myIdx >= 0) setPosition(myIdx + 1)

        // CP kredit/XP — csak checkpoint elérésekor, nem a rajtnál
        if (cpIndex > 0) {
          setEarnedCredits(10)
          setEarnedXp(25)
        }
      } catch {}
    }

    load()
  }, [mounted, cpIndex])

  // Idő formázás
  const fmtTime = (sec: number) => {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return h > 0
      ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  }

  function toggleSail(sail: keyof SailState) {
    const next = { ...sails }
    if (sail === 'fock') { if (!sails.fock) { next.fock = true; next.genua = false } else next.fock = false }
    else if (sail === 'genua') { if (!sails.genua) { next.genua = true; next.fock = false; next.genakker = false } else next.genua = false }
    else if (sail === 'spinn') { if (!sails.spinn) { next.spinn = true; next.genakker = false; next.fock = false; next.genua = false } else next.spinn = false }
    else if (sail === 'genakker') { if (!sails.genakker) { next.genakker = true; next.spinn = false; next.genua = false } else next.genakker = false }
    else if (sail === 'gross') next.gross = !sails.gross
    onSailChange(next)
  }

  if (!mounted) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(15, 25, 35, 0.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: '6px', width: '480px', maxWidth: '95vw',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        {/* Fejléc */}
        <div style={{
          background: 'var(--foreground)', padding: '16px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', letterSpacing: '3px', color: 'var(--background)', opacity: 0.6 }}>
              ⚓ BÓLYA
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 900, color: 'var(--background)', letterSpacing: '1px' }}>
              {cpName || `CP ${cpIndex}`}
            </div>
          </div>
          {position && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', letterSpacing: '2px', color: 'var(--background)', opacity: 0.6 }}>HELYEZÉS</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 900, color: 'var(--background)', lineHeight: 1 }}>
                {position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `#${position}`}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Idő sor */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ padding: '12px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--background)' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', letterSpacing: '2px', color: 'var(--muted-foreground)', marginBottom: '4px' }}>ÖSSZESÍTETT IDŐ</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 900, color: 'var(--foreground)' }}>{fmtTime(totalSec)}</div>
            </div>
            {(earnedCredits > 0 || earnedXp > 0) && (
              <div style={{ padding: '12px', borderRadius: '4px', border: '1px solid var(--secondary)', background: 'var(--secondary)/0.08' }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', letterSpacing: '2px', color: 'var(--muted-foreground)', marginBottom: '4px' }}>KAPOTT</div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'baseline' }}>
                  {earnedCredits > 0 && <span style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 900, color: 'var(--secondary)' }}>+{earnedCredits} kr</span>}
                  {earnedXp > 0 && <span style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', color: 'var(--muted-foreground)' }}>+{earnedXp} XP</span>}
                </div>
              </div>
            )}
          </div>

          {/* Következő szakasz időjárás */}
          {nextWind && (
            <div style={{ padding: '14px', borderRadius: '4px', border: `1px solid ${nextWind.storm > 0 ? 'var(--destructive)' : 'var(--border)'}`, background: nextWind.storm > 0 ? 'rgba(var(--destructive-rgb),0.08)' : 'var(--background)' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', letterSpacing: '2px', color: 'var(--muted-foreground)', marginBottom: '8px' }}>
                KÖVETKEZŐ SZAKASZ
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* Mini iránytű */}
                <svg width="64" height="64" viewBox="0 0 64 64" style={{ flexShrink: 0 }}>
                  <circle cx="32" cy="32" r="30" fill="none" stroke="var(--border)" strokeWidth="1.5"/>
                  <circle cx="32" cy="32" r="2" fill="var(--muted-foreground)"/>
                  {['É','K','D','Ny'].map((d, i) => (
                    <text key={d} x={32 + 22 * Math.sin(i * Math.PI/2)} y={32 - 22 * Math.cos(i * Math.PI/2) + 4}
                      textAnchor="middle" fill="var(--muted-foreground)" fontSize="8" fontFamily="var(--font-heading)" fontWeight="700">{d}</text>
                  ))}
                  <line
                    x1="32" y1="32"
                    x2={32 + 22 * Math.sin((nextWind.dir * Math.PI) / 180)}
                    y2={32 - 22 * Math.cos((nextWind.dir * Math.PI) / 180)}
                    stroke="#c42b1c" strokeWidth="2.5" strokeLinecap="round"
                  />
                  <line
                    x1="32" y1="32"
                    x2={32 - 10 * Math.sin((nextWind.dir * Math.PI) / 180)}
                    y2={32 + 10 * Math.cos((nextWind.dir * Math.PI) / 180)}
                    stroke="var(--muted-foreground)" strokeWidth="1.5" strokeLinecap="round"
                  />
                </svg>
                <div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 900, color: 'var(--foreground)' }}>
                    {nextWind.speed} kn
                  </div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: '12px', color: 'var(--muted-foreground)' }}>
                    {nextWind.dir}° {dirLabel(nextWind.dir)}
                  </div>
                </div>
                {nextWind.storm > 0 && (
                  <div style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: '4px', background: 'var(--destructive)', color: '#fff', fontFamily: 'var(--font-heading)', fontSize: '11px', fontWeight: 700, letterSpacing: '2px' }}>
                    ⚡ VIHAR {nextWind.storm}. FOK
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Vitorlaválasztó */}
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', letterSpacing: '2px', color: 'var(--muted-foreground)', marginBottom: '8px' }}>
              VITORLACSERE — KÖVETKEZŐ SZAKASZRA
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <SailBtn label="Fock" active={sails.fock} onClick={() => toggleSail('fock')}/>
                <SailBtn label="Genua" active={sails.genua} onClick={() => toggleSail('genua')}/>
                <SailBtn label="Gross" active={sails.gross} onClick={() => toggleSail('gross')}/>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <SailBtn label="Spinnaker" active={sails.spinn} onClick={() => toggleSail('spinn')} color="accent"/>
                <SailBtn label="Genakker" active={sails.genakker} onClick={() => toggleSail('genakker')} color="accent"/>
              </div>
            </div>
          </div>

          {/* Tovább gomb */}
          <button onClick={onClose} style={{
            width: '100%', padding: '12px', borderRadius: '4px',
            background: 'var(--foreground)', color: 'var(--background)',
            border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-heading)', fontWeight: 700,
            fontSize: '13px', letterSpacing: '2px',
            transition: 'all 0.15s',
          }}>
            TOVÁBB ⛵
          </button>
        </div>
      </div>
    </div>
  )
}
