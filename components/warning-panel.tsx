'use client'

import { useEffect, useState } from 'react'
import { getPocketBase, RACE_ID } from '@/lib/pocketbase'

export interface WarningState {
  vihar: 0 | 1 | 2        // 0=off, 1=1.fokú, 2=2.fokú
  leszuras: boolean        // kínai halzolás veszély
  drift: number            // drift szög fokokban
  vitorla: boolean         // van-e vitorla fent
  tuldoles: boolean        // heel > 25°
  trimEfficiency: number   // 0-100
  raceAlert?: 'T10' | 'T5' | 'T4' | 'T1' | null  // rajt figyelmeztetés
}

interface LampProps {
  id: string
  icon: string
  label: string
  state: 'off' | 'green' | 'active-red' | 'blink-red' | 'active-amber' | 'blink-amber'
}

function Lamp({ icon, label, state }: LampProps) {
  const isRed = state === 'active-red' || state === 'blink-red'
  const isAmber = state === 'active-amber' || state === 'blink-amber'
  const isGreen = state === 'green'
  const isOn = isRed || isAmber || isGreen
  const blinks = state === 'blink-red' || state === 'blink-amber'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      {/* Statikus fémes keret */}
      <div style={{
        width: '48px', height: '48px',
        borderRadius: '8px',
        background: 'linear-gradient(145deg, #5a5e6a 0%, #3a3d48 25%, #2a2d38 50%, #3e4050 75%, #4a4d5c 100%)',
        padding: '3px',
        boxShadow: `
          inset 0 1.5px 0 rgba(255,255,255,0.35),
          inset 1.5px 0 0 rgba(255,255,255,0.2),
          inset 0 -1.5px 0 rgba(0,0,0,0.6),
          inset -1.5px 0 0 rgba(0,0,0,0.4),
          0 4px 12px rgba(0,0,0,0.6),
          0 0 0 1px rgba(255,255,255,0.08)
        `,
      }}>
        {/* Belső lámpa — ez villog */}
        <div style={{
          width: '100%', height: '100%',
          borderRadius: '5px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', overflow: 'hidden',
          background: isRed
            ? 'linear-gradient(160deg, rgba(255,60,60,0.12) 0%, rgba(160,15,15,0.85) 100%)'
            : isAmber
            ? 'linear-gradient(160deg, rgba(255,170,20,0.12) 0%, rgba(150,80,0,0.85) 100%)'
            : isGreen
            ? 'linear-gradient(160deg, rgba(40,190,70,0.1) 0%, rgba(12,90,28,0.85) 100%)'
            : 'rgba(0,0,0,0.75)',
          boxShadow: isRed
            ? 'inset 0 0 22px rgba(255,30,30,0.65), inset 0 0 8px rgba(255,80,80,0.3)'
            : isAmber
            ? 'inset 0 0 22px rgba(255,140,0,0.65), inset 0 0 8px rgba(255,180,30,0.3)'
            : isGreen
            ? 'inset 0 0 20px rgba(30,200,70,0.55), inset 0 0 7px rgba(60,220,100,0.3)'
            : 'none',
          animation: blinks
            ? `${isRed ? 'blink-red' : 'blink-amber'} ${isRed ? '0.75s' : '1.1s'} infinite`
            : 'none',
        }}>
          <span style={{
            fontSize: '16px',
            filter: isOn
              ? isGreen
                ? 'brightness(1) hue-rotate(100deg) saturate(2.5)'
                : isAmber
                ? 'brightness(1.1) sepia(1) saturate(5) hue-rotate(-5deg)'
                : 'brightness(1.15) saturate(1.2)'
              : 'brightness(0.3) saturate(0)',
            animation: blinks
              ? `${isRed ? 'blink-red' : 'blink-amber'} ${isRed ? '0.75s' : '1.1s'} infinite`
              : 'none',
            position: 'relative', zIndex: 2,
          }}>
            {icon}
          </span>
        </div>
      </div>

      {/* Statikus fémes tábla */}
      <div style={{
        fontSize: '8px',
        letterSpacing: '1.5px',
        color: 'rgba(180,185,200,0.75)',
        textTransform: 'uppercase',
        textAlign: 'center',
        padding: '2px 8px 3px',
        borderRadius: '2px',
        background: 'linear-gradient(180deg, rgba(80,84,100,0.9) 0%, rgba(52,55,68,0.95) 45%, rgba(62,65,80,0.9) 100%)',
        borderTop: '1px solid rgba(255,255,255,0.22)',
        borderLeft: '1px solid rgba(255,255,255,0.14)',
        borderRight: '1px solid rgba(0,0,0,0.45)',
        borderBottom: '1px solid rgba(0,0,0,0.55)',
        boxShadow: '0 2px 5px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
        textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 -1px 0 rgba(255,255,255,0.06)',
        fontFamily: "'Barlow Condensed', sans-serif",
      }}>
        {label}
      </div>
    </div>
  )
}

interface WarningPanelProps {
  warnings: WarningState
}

export function WarningPanel({ warnings }: WarningPanelProps) {
  const lamps: LampProps[] = [
    {
      id: 'vihar',
      icon: '⚡',
      label: 'Vihar',
      state: warnings.vihar === 2 ? 'blink-amber' : warnings.vihar === 1 ? 'active-amber' : 'off',
    },
    {
      id: 'leszuras',
      icon: '⬇',
      label: 'Leszúrás',
      state: warnings.leszuras ? 'blink-red' : 'off',
    },
    {
      id: 'drift',
      icon: '↗',
      label: `Drift ${warnings.drift > 0 ? warnings.drift.toFixed(1) + '°' : ''}`,
      state: warnings.drift > 12 ? 'blink-red' : warnings.drift > 6 ? 'active-red' : 'off',
    },
    {
      id: 'vitorla',
      icon: '⛵',
      label: 'Vitorla',
      state: warnings.vitorla ? 'green' : 'blink-red',
    },
    {
      id: 'tuldoles',
      icon: '↙',
      label: 'Túldőlés',
      state: warnings.tuldoles ? 'blink-red' : 'off',
    },
    {
      id: 'trim',
      icon: '✓',
      label: 'Trim',
      state: warnings.trimEfficiency === 0 ? 'blink-red' : warnings.trimEfficiency >= 75 ? 'green' : warnings.trimEfficiency >= 40 ? 'active-amber' : 'active-red',
    },
    {
      id: 'rajt',
      icon: '🚨',
      label: warnings.raceAlert ? `RAJT ${warnings.raceAlert}` : 'RAJT',
      state: warnings.raceAlert ? 'blink-red' : 'off',
    },
  ]

  return (
    <>
      <style>{`
        @keyframes blink-red { 0%,48%{opacity:1} 50%,100%{opacity:0.08} }
        @keyframes blink-amber { 0%,48%{opacity:1} 52%,100%{opacity:0.1} }
      `}</style>
      <div style={{
        background: 'linear-gradient(180deg, #1c2030 0%, #141720 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '8px 20px',
      }}>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'flex-start' }}>
          {lamps.map(l => <Lamp key={l.id} {...l} />)}
        </div>
      </div>
    </>
  )
}

// Hook: warning state számítása
export function useWarnings(
  stormLevel: number,
  sails: { gross: boolean, fock: boolean, genua: boolean, spinn: boolean, genakker: boolean },
  trimEfficiency: number,
  windDir: number,
  windSpeedKn: number,
  boatHeading: number,
): WarningState {
  const twa = windDir - boatHeading
  const absTwa = Math.abs(((twa + 180) % 360) - 180)

  // Drift számítás
  const fSide = windSpeedKn * Math.sin((absTwa * Math.PI) / 180)
  const trimPenalty = 1 - trimEfficiency / 100
  const heel = fSide * (1 - 0.4) * (1 + trimPenalty * 2)
  const driftAngle = Math.max(0,
    0.3 * fSide * Math.tan((Math.min(heel, 35) * Math.PI) / 180)
  )

  // Leszúrás: hátszél + rossz trim + spinnaker
  const leszuras = absTwa > 150 && trimEfficiency < 55 && (sails.spinn || sails.gross)

  // Túldőlés
  const tuldoles = heel > 25

  // Van-e vitorla fent
  const vitorla = Object.values(sails).some(Boolean)

  return {
    vihar: stormLevel as 0 | 1 | 2,
    leszuras,
    drift: Math.round(driftAngle * 10) / 10,
    vitorla,
    tuldoles,
    trimEfficiency,
  }
}
