'use client'

import { useRef, useCallback } from 'react'

interface TrimFaderProps {
  label: string
  value: number        // 0-100
  onChange: (v: number) => void
  disabled?: boolean
  height?: number
}

export function TrimFader({ label, value, onChange, disabled = false, height = 360 }: TrimFaderProps) {
  const trackRef = useRef<SVGRectElement>(null)
  const dragging = useRef(false)

  const getVal = useCallback((clientY: number) => {
    if (!trackRef.current) return value
    const rect = trackRef.current.getBoundingClientRect()
    return Math.round(Math.max(0, Math.min(100, (1 - (clientY - rect.top) / rect.height) * 100)))
  }, [value])

  const onMouseDown = (e: React.MouseEvent) => {
    if (disabled) return
    dragging.current = true
    onChange(getVal(e.clientY))
    const move = (e: MouseEvent) => { if (dragging.current) onChange(getVal(e.clientY)) }
    const up = () => { dragging.current = false; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const onTouchStart = (e: React.TouchEvent) => {
    if (disabled) return
    onChange(getVal(e.touches[0].clientY))
    const move = (e: TouchEvent) => onChange(getVal(e.touches[0].clientY))
    const end = () => { window.removeEventListener('touchmove', move); window.removeEventListener('touchend', end) }
    window.addEventListener('touchmove', move)
    window.addEventListener('touchend', end)
  }

  const W = 40
  const cx = W / 2
  const trackTop = 8
  const trackBot = height - 32
  const trackH = trackBot - trackTop
  const rawKnobY = trackTop + trackH * (1 - value / 100)
  const knobY = Math.max(trackTop + 9, Math.min(trackBot - 9, rawKnobY))
  const color = disabled ? 'rgba(232,223,192,0.2)' : 'rgba(42,106,122,0.9)'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      opacity: disabled ? 0.25 : 1,
      cursor: disabled ? 'not-allowed' : 'ns-resize',
      userSelect: 'none', flexShrink: 0,
    }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      <svg width={W} height={height}>
        <defs>
          <linearGradient id={`fg-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity="0.4" />
          </linearGradient>
          <radialGradient id={`ball-${label}`} cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#e8f0f4" />
            <stop offset="50%" stopColor="#a8b8c8" />
            <stop offset="100%" stopColor="#4a5a6a" />
          </radialGradient>
          <linearGradient id={`rod-${label}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6a7a8a" />
            <stop offset="40%" stopColor="#c8d4dc" />
            <stop offset="100%" stopColor="#6a7a8a" />
          </linearGradient>
        </defs>

        {/* Sín teljes hosszban */}
        <rect ref={trackRef} x={cx - 3} y={trackTop} width={6} height={trackH}
          rx="3" fill="rgba(232,223,192,0.07)" stroke="rgba(232,223,192,0.3)" strokeWidth="0.75" />

        {/* Aktív fill — kar alatt */}
        <rect x={cx - 2} y={knobY + 10} width={4} height={Math.max(0, trackBot - knobY - 10)}
          rx="2" fill={`url(#fg-${label})`} />

        {/* 25/50/75 jelölők */}
        {[25, 50, 75].map(v => {
          const y = trackTop + trackH * (1 - v / 100)
          return <line key={v} x1={cx - 7} y1={y} x2={cx + 7} y2={y}
            stroke={v === 50 ? 'rgba(232,223,192,0.4)' : 'rgba(232,223,192,0.2)'}
            strokeWidth={v === 50 ? 1 : 0.5} />
        })}

        {/* Chrome rúd */}
        <rect x={cx - 1.5} y={knobY + 10} width={3} height={Math.max(0, trackBot - knobY - 10)}
          rx="1.5" fill={`url(#rod-${label})`} />

        {/* Gömb */}
        <circle cx={cx} cy={knobY} r={9}
          fill={`url(#ball-${label})`}
          stroke="rgba(232,223,192,0.35)" strokeWidth="0.75"
          style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
        <circle cx={cx - 3} cy={knobY - 3} r={2.5} fill="rgba(255,255,255,0.35)" />

        {/* Érték */}
        <text x={cx} y={height - 16} textAnchor="middle"
          fill="rgba(232,223,192,0.7)" fontSize="9" fontFamily="monospace" fontWeight="600">
          {value}
        </text>

        {/* Label forgatva */}
        <text
          x={cx} y={height - 4} textAnchor="middle"
          fill="rgba(232,223,192,0.4)" fontSize="6" fontFamily="sans-serif"
          style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>
          {label.slice(0, 6)}
        </text>
      </svg>
    </div>
  )
}
