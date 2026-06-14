'use client'

interface HeelIndicatorProps {
  heel: number // -40 to +40 fok, pozitív = jobb
}

const D2R = Math.PI / 180

export function HeelIndicator({ heel = 0 }: HeelIndicatorProps) {
  const clamped = Math.max(-40, Math.min(40, heel))
  const cx = 100, cy = 110, r = 78
  const danger = Math.abs(clamped) > 25

  // Tű szöge: 0° = függőlegesen fel, ± = oldalra
  const needleRad = (clamped - 90) * D2R
  const needleLen = 62
  const tipX = cx + Math.cos(needleRad) * needleLen
  const tipY = cy + Math.sin(needleRad) * needleLen

  // Skála ticks (-40..40, 10-esével)
  const ticks = [-40, -30, -20, -10, 0, 10, 20, 30, 40]

  return (
    <div className="gauge-housing aspect-square w-full shrink-0" style={{ maxWidth: 'min(100%, 320px)' }}>
      <div className="gauge-face">
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full">
          {/* Biztonságos zóna ív (zöld) */}
          <path
            d={describeArc(cx, cy, r - 6, -25, 25)}
            fill="none" stroke="oklch(0.6 0.13 165 / 0.5)" strokeWidth="5" strokeLinecap="round"
          />
          {/* Veszélyzónák (piros) */}
          <path d={describeArc(cx, cy, r - 6, -40, -25)} fill="none" stroke="oklch(0.58 0.2 28 / 0.6)" strokeWidth="5" strokeLinecap="round" />
          <path d={describeArc(cx, cy, r - 6, 25, 40)} fill="none" stroke="oklch(0.58 0.2 28 / 0.6)" strokeWidth="5" strokeLinecap="round" />

          {/* Skála ticks */}
          {ticks.map((deg) => {
            const major = deg % 20 === 0
            const a = (deg - 90) * D2R
            const rOut = r - 1
            const rIn = major ? r - 14 : r - 9
            const x1 = cx + Math.cos(a) * rIn
            const y1 = cy + Math.sin(a) * rIn
            const x2 = cx + Math.cos(a) * rOut
            const y2 = cy + Math.sin(a) * rOut
            const lx = cx + Math.cos(a) * (r - 22)
            const ly = cy + Math.sin(a) * (r - 22)
            return (
              <g key={deg}>
                <line x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={Math.abs(deg) >= 30 ? 'oklch(0.62 0.2 28)' : major ? 'oklch(0.86 0.04 88)' : 'oklch(0.6 0.04 230)'}
                  strokeWidth={major ? 1.4 : 0.7} />
                {major && (
                  <text x={lx} y={ly + 2.5} textAnchor="middle"
                    fill="oklch(0.7 0.04 90)" className="font-mono" fontSize="7">
                    {Math.abs(deg)}
                  </text>
                )}
              </g>
            )
          })}

          {/* Oldal feliratok */}
          <text x={cx - r + 6} y={cy + 6} textAnchor="middle" fill="oklch(0.6 0.04 230)" className="font-mono" fontSize="8">BB</text>
          <text x={cx + r - 6} y={cy + 6} textAnchor="middle" fill="oklch(0.6 0.04 230)" className="font-mono" fontSize="8">SB</text>

          {/* Tű */}
          <line x1={cx} y1={cy} x2={tipX} y2={tipY}
            stroke={danger ? 'oklch(0.62 0.22 28)' : 'oklch(0.92 0.03 88)'} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx={tipX} cy={tipY} r="3" fill={danger ? 'oklch(0.62 0.22 28)' : 'oklch(0.92 0.03 88)'} />

          {/* Tengely-csavar */}
          <circle cx={cx} cy={cy} r="7" fill="oklch(0.7 0.1 78)" stroke="oklch(0.4 0.06 70)" strokeWidth="1" />
          <circle cx={cx} cy={cy} r="2.5" fill="oklch(0.3 0.04 250)" />

          {/* LCD fok-kijelző */}
          <foreignObject x="62" y="138" width="76" height="34">
            <div className={`lcd-screen ${danger ? '' : ''} flex h-full w-full flex-col items-center justify-center leading-none`}>
              <span className="text-[16px] font-bold tracking-tight" style={danger ? { color: 'oklch(0.78 0.18 30)', textShadow: '0 0 6px oklch(0.7 0.2 30 / 0.8)' } : undefined}>
                {clamped > 0 ? '+' : ''}{clamped.toFixed(1)}°
              </span>
              <span className="text-[7px] opacity-75">DŐLÉS</span>
            </div>
          </foreignObject>

          <div className="glass-dome" />
        </svg>
        <div className="glass-dome" />
      </div>
    </div>
  )
}

function polarToXY(cx: number, cy: number, r: number, deg: number) {
  const a = (deg - 90) * D2R
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polarToXY(cx, cy, r, endDeg)
  const end = polarToXY(cx, cy, r, startDeg)
  const large = endDeg - startDeg <= 180 ? 0 : 1
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${large} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}
