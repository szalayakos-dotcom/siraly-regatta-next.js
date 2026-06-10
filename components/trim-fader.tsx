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

  const W = 54
  const cx = W / 2
  const trackTop = 10
  const trackBot = height - 38
  const trackH = trackBot - trackTop
  const rawKnobY = trackTop + trackH * (1 - value / 100)
  const knobR = 15
  const knobY = Math.max(trackTop + knobR, Math.min(trackBot - knobR, rawKnobY))

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      opacity: disabled ? 0.3 : 1,
      cursor: disabled ? 'not-allowed' : 'ns-resize',
      userSelect: 'none', flexShrink: 0,
    }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      <svg width={W} height={height}>
        <defs>
          <linearGradient id={`fg-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.5 0.09 222)" />
            <stop offset="100%" stopColor="oklch(0.4 0.07 222 / 0.4)" />
          </linearGradient>
          <radialGradient id={`ball-${label}`} cx="38%" cy="30%" r="68%">
            <stop offset="0%" stopColor="oklch(0.78 0.18 30)" />
            <stop offset="55%" stopColor="oklch(0.58 0.22 28)" />
            <stop offset="100%" stopColor="oklch(0.4 0.18 28)" />
          </radialGradient>
        </defs>

        {/* Süllyesztett sín — vastag mélyedés */}
        <rect x={cx - 6} y={trackTop - 4} width={12} height={trackH + 8} rx="6"
          fill="oklch(0.16 0.03 250)" stroke="oklch(0.4 0.04 248)" strokeWidth="0.75" />
        {/* belső árnyék-sáv */}
        <rect ref={trackRef} x={cx - 3} y={trackTop} width={6} height={trackH}
          rx="3" fill="oklch(0.1 0.02 250)" />

        {/* Aktív fill — kar alatt (teal) */}
        <rect x={cx - 3} y={knobY} width={6} height={Math.max(0, trackBot - knobY)}
          rx="3" fill={`url(#fg-${label})`} />

        {/* 25/50/75 jelölők */}
        {[25, 50, 75].map(v => {
          const y = trackTop + trackH * (1 - v / 100)
          return <line key={v} x1={cx - 11} y1={y} x2={cx - 7} y2={y}
            stroke={v === 50 ? 'oklch(0.7 0.04 90 / 0.55)' : 'oklch(0.7 0.04 90 / 0.3)'}
            strokeWidth={v === 50 ? 1.2 : 0.6} />
        })}
        {[25, 50, 75].map(v => {
          const y = trackTop + trackH * (1 - v / 100)
          return <line key={`r${v}`} x1={cx + 7} y1={y} x2={cx + 11} y2={y}
            stroke={v === 50 ? 'oklch(0.7 0.04 90 / 0.55)' : 'oklch(0.7 0.04 90 / 0.3)'}
            strokeWidth={v === 50 ? 1.2 : 0.6} />
        })}

        {/* Nagy piros markolatgömb */}
        <g style={{ filter: 'drop-shadow(0 3px 5px oklch(0.12 0.02 250 / 0.6))' }}>
          {/* nyak a sínbe */}
          <rect x={cx - 2.5} y={knobY - 2} width={5} height={6} fill="oklch(0.35 0.03 250)" />
          <circle cx={cx} cy={knobY} r={knobR} fill={`url(#ball-${label})`}
            stroke="oklch(0.32 0.14 28)" strokeWidth="1" />
          {/* fény-csillanás */}
          <ellipse cx={cx - 4} cy={knobY - 5} rx={4} ry={2.8} fill="oklch(1 0 0 / 0.4)" />
          {/* markolat-barázdák */}
          <line x1={cx - 7} y1={knobY + 4} x2={cx + 7} y2={knobY + 4} stroke="oklch(0.35 0.16 28 / 0.5)" strokeWidth="0.75" />
          <line x1={cx - 7} y1={knobY + 7} x2={cx + 7} y2={knobY + 7} stroke="oklch(0.35 0.16 28 / 0.5)" strokeWidth="0.75" />
        </g>

        {/* Érték LCD-szerű */}
        <text x={cx} y={height - 20} textAnchor="middle"
          fill="oklch(0.82 0.14 162)" fontSize="11" fontFamily="var(--font-mono)" fontWeight="700"
          style={{ filter: 'drop-shadow(0 0 3px oklch(0.7 0.14 162 / 0.6))' }}>
          {value}
        </text>

        {/* Label */}
        <text x={cx} y={height - 6} textAnchor="middle"
          fill="oklch(0.7 0.04 90 / 0.65)" fontSize="6.5" fontFamily="var(--font-sans)"
          style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>
          {label.slice(0, 7)}
        </text>
      </svg>
    </div>
  )
}
