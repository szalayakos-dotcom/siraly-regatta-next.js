'use client'

interface HeelIndicatorProps {
  heel: number // -40 to +40 fok, pozitív = jobb
}

export function HeelIndicator({ heel = 0 }: HeelIndicatorProps) {
  const clamped = Math.max(-40, Math.min(40, heel))
  const cx = 100, cy = 100, r = 80
  const heelRad = (clamped * Math.PI) / 180

  // Vízfelszín y koordináta
  const waterY = 118

  // Hajó keresztmetszet dőlve (hátulnézet)
  // Hajótest: lapos ellipszis aljával a vízben
  // Árbóc: felfelé nyúlik, a dőlés irányában hajlik
  const hullW = 38
  const hullH = 14
  const mastH = 72

  // Dőlés szög alapján offset
  const mastTipX = cx + Math.sin(heelRad) * mastH
  const mastTipY = waterY - Math.cos(heelRad) * mastH
  const mastBaseX = cx + Math.sin(heelRad) * 2
  const mastBaseY = waterY - hullH / 2

  // Hajótest sarokpontok dőlve
  const hullLeft  = { x: cx - hullW * Math.cos(heelRad), y: waterY - hullH * Math.sin(heelRad) * 0.5 + hullW * Math.sin(heelRad) * 0.3 }
  const hullRight = { x: cx + hullW * Math.cos(heelRad), y: waterY + hullH * Math.sin(heelRad) * 0.5 - hullW * Math.sin(heelRad) * 0.3 }
  const hullBottom = { x: cx + Math.sin(heelRad) * hullH * 0.7, y: waterY + hullH * 0.6 }

  // Skála ticks
  const ticks = [-40, -30, -20, -10, 0, 10, 20, 30, 40]

  return (
    <div style={{ width: '100%', aspectRatio: '1', position: 'relative' }}>
      <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%' }}>
        <defs>
          <radialGradient id="heelBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2a3d52" />
            <stop offset="100%" stopColor="#1a2535" />
          </radialGradient>
          <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a6a7a" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#1a3a4a" stopOpacity="0.3" />
          </linearGradient>
          <clipPath id="dialClip">
            <circle cx={cx} cy={cy} r={r} />
          </clipPath>
        </defs>

        {/* Háttér kör */}
        <circle cx={cx} cy={cy} r={r + 2} fill="url(#heelBg)" stroke="rgba(232,223,192,0.2)" strokeWidth="1.5" />

        {/* Veszélyzóna ívek */}
        {/* Bal -40..-25 */}
        <path d={`M ${cx - r * 0.5} ${cy} A ${r * 0.5} ${r * 0.5} 0 0 0 ${cx - r * 0.85} ${cy + r * 0.1}`}
          fill="rgba(196,43,28,0.08)" />

        {/* Skála körív */}
        <path d={`M ${cx - r + 8} ${waterY} A ${r - 8} ${r - 8} 0 0 1 ${cx + r - 8} ${waterY}`}
          fill="none" stroke="rgba(232,223,192,0.15)" strokeWidth="1" />

        {/* Skála ticks */}
        {ticks.map(deg => {
          const major = deg % 20 === 0 || deg === 0
          const rad = ((deg / 40) * Math.PI / 2) // -90° to +90° félkör
          const tickR = r - 8
          const inner = major ? tickR - 10 : tickR - 5
          // Félkör alján: 0° = alul közép, ±40° = bal/jobb
          const angle = Math.PI / 2 + rad  // 90° = bottom, ±= sides
          const x1 = cx + inner * Math.cos(Math.PI - angle)
          const y1 = waterY - inner * Math.sin(Math.PI - angle) * 0.3 + (tickR - inner) * 0.5
          const x2 = cx + tickR * Math.cos(Math.PI - angle)
          const y2 = waterY - tickR * Math.sin(Math.PI - angle) * 0.3 + 5
          // Egyszerűbb: vízszintes skála a vízfelszín alján
          const px = cx + (deg / 40) * (r - 15)
          const py1 = waterY + 5
          const py2 = major ? waterY + 14 : waterY + 9
          return (
            <g key={deg}>
              <line x1={px} y1={py1} x2={px} y2={py2}
                stroke={Math.abs(deg) >= 30 ? 'rgba(196,43,28,0.6)' : major ? 'rgba(232,223,192,0.7)' : 'rgba(232,223,192,0.3)'}
                strokeWidth={major ? 1.2 : 0.6} />
              {major && (
                <text x={px} y={py2 + 8} textAnchor="middle"
                  fill="rgba(232,223,192,0.5)" fontSize="6.5" fontFamily="monospace">
                  {Math.abs(deg)}
                </text>
              )}
            </g>
          )
        })}

        {/* SB / BB felirat */}
        <text x={cx - r + 8} y={waterY + 4} fill="rgba(232,223,192,0.4)" fontSize="7" fontFamily="monospace">SB</text>
        <text x={cx + r - 18} y={waterY + 4} fill="rgba(232,223,192,0.4)" fontSize="7" fontFamily="monospace">BB</text>

        {/* Vízfelszín */}
        <rect x={cx - r + 5} y={waterY} width={(r - 5) * 2} height={r - waterY + cx + 5}
          fill="url(#waterGrad)" clipPath="url(#dialClip)" />
        <line x1={cx - r + 5} y1={waterY} x2={cx + r - 5} y2={waterY}
          stroke="#2a6a7a" strokeWidth="1.5" opacity="0.8" />

        {/* Hajótest keresztmetszet (hátulnézet, dőlve) */}
        <g transform={`rotate(${clamped} ${cx} ${waterY})`}>
          {/* Hull */}
          <path d={`M ${cx - hullW} ${waterY - 4} 
                    Q ${cx} ${waterY + hullH} ${cx + hullW} ${waterY - 4}
                    L ${cx + hullW * 0.6} ${waterY - hullH}
                    L ${cx - hullW * 0.6} ${waterY - hullH} Z`}
            fill="#1a2535" stroke="rgba(232,223,192,0.7)" strokeWidth="1.2" />
          {/* Keel */}
          <line x1={cx} y1={waterY + 4} x2={cx} y2={waterY + hullH + 8}
            stroke="rgba(232,223,192,0.5)" strokeWidth="2" strokeLinecap="round" />
          {/* Árbóc */}
          <line x1={cx} y1={waterY - hullH} x2={cx} y2={waterY - hullH - mastH}
            stroke="rgba(232,223,192,0.9)" strokeWidth="1.8" strokeLinecap="round" />
          {/* Árbocrúd vég */}
          <circle cx={cx} cy={waterY - hullH - mastH} r="2.5" fill="rgba(232,223,192,0.8)" />
          {/* Vanta (stay) */}
          <line x1={cx} y1={waterY - hullH - mastH * 0.7}
                x2={cx + hullW * 0.7} y2={waterY - hullH + 2}
            stroke="rgba(232,223,192,0.25)" strokeWidth="0.75" />
          <line x1={cx} y1={waterY - hullH - mastH * 0.7}
                x2={cx - hullW * 0.7} y2={waterY - hullH + 2}
            stroke="rgba(232,223,192,0.25)" strokeWidth="0.75" />
        </g>

        {/* Dőlés érték */}
        <text x={cx} y={cy - 45} textAnchor="middle"
          fill={Math.abs(clamped) > 25 ? '#c42b1c' : 'rgba(232,223,192,0.9)'}
          fontSize="13" fontFamily="monospace" fontWeight="bold">
          {clamped > 0 ? '+' : ''}{clamped.toFixed(1)}°
        </text>

        {/* Label */}
        <text x={cx} y={cy - 30} textAnchor="middle"
          fill="rgba(232,223,192,0.4)" fontSize="7" fontFamily="var(--font-heading)" letterSpacing="2">
          DŐLÉS
        </text>

        {/* Középvonal referencia */}
        <line x1={cx} y1={waterY - r + 15} x2={cx} y2={waterY - 5}
          stroke="rgba(232,223,192,0.1)" strokeWidth="0.75" strokeDasharray="3 3" />
      </svg>
    </div>
  )
}
