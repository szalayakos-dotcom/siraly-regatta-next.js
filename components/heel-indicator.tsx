'use client'

interface HeelIndicatorProps {
  heel: number // -40..+40 fok, pozitív = jobb (SB)
}

const SEG = 21          // szegmensek száma
const CENTER = 10       // középső index = 0°
const PER = 4           // fok / szegmens

export function HeelIndicator({ heel = 0 }: HeelIndicatorProps) {
  const clamped = Math.max(-40, Math.min(40, heel))
  const danger = Math.abs(clamped) > 25
  const warn = Math.abs(clamped) > 18
  const capsize = Math.abs(clamped) > 33
  const pos = Math.round(clamped / PER) // -10..+10
  const side = clamped === 0 ? '' : clamped > 0 ? 'JOBB · SB' : 'BAL · BB'

  const valueColor = danger ? 'crt-red' : warn ? 'crt-amber' : 'crt-glow'

  return (
    <div className="crt-screen flex w-full flex-col items-center justify-center gap-3 p-4">
      {/* Nagy digitális fok */}
      <div className="flex flex-col items-center leading-none">
        <span className={`font-mono text-[46px] font-bold tabular-nums ${valueColor}`}>
          {clamped > 0 ? '+' : ''}{clamped.toFixed(1)}<span className="text-2xl">°</span>
        </span>
        <span className="crt-dim mt-1 font-heading text-sm font-bold tracking-[0.25em]">
          {side || 'VÍZSZINTES'}
        </span>
      </div>

      {/* Digitális szintjelző — szegmentált sáv, középről a dőlés felé világít */}
      <div className="flex w-full max-w-[280px] items-end justify-between gap-[2px]" aria-hidden>
        {Array.from({ length: SEG }, (_, i) => {
          const off = i - CENTER
          const isCenter = off === 0
          const lit = pos === 0 ? isCenter
            : pos > 0 ? (off > 0 && off <= pos)
            : (off < 0 && off >= pos)
          const tall = isCenter || Math.abs(off) % 5 === 0
          const litColor = danger ? 'oklch(0.66 0.22 28)' : warn ? 'oklch(0.82 0.15 70)' : 'oklch(0.86 0.2 162)'
          return (
            <span key={i}
              style={{
                flex: 1,
                height: tall ? 26 : 18,
                borderRadius: 2,
                background: lit ? litColor
                  : isCenter ? 'oklch(0.7 0.06 165 / 0.6)'
                  : 'oklch(0.45 0.08 168 / 0.3)',
                boxShadow: lit ? `0 0 6px ${litColor}` : 'none',
              }} />
          )
        })}
      </div>

      <div className="flex w-full max-w-[280px] items-center justify-between">
        <span className="crt-dim font-mono text-[10px]">BB ◄</span>
        <span className="crt-dim font-mono text-[10px]">0°</span>
        <span className="crt-dim font-mono text-[10px]">► SB</span>
      </div>

      {/* Leszúrás vészjelző lámpa */}
      <style>{`@keyframes heelBlink{0%,49%{opacity:1}50%,100%{opacity:.15}}`}</style>
      <div className="mt-1 flex items-center gap-2.5 rounded-md border px-3 py-1.5"
        style={{
          borderColor: capsize ? 'oklch(0.6 0.2 28 / 0.6)' : warn ? 'oklch(0.7 0.13 70 / 0.5)' : 'oklch(0.4 0.08 168 / 0.4)',
          background: capsize ? 'oklch(0.4 0.14 28 / 0.18)' : 'oklch(0.16 0.04 172 / 0.6)',
        }}>
        <span style={{
          width: 13, height: 13, borderRadius: '50%', flexShrink: 0,
          background: capsize ? 'oklch(0.66 0.24 28)' : warn ? 'oklch(0.82 0.16 70)' : 'oklch(0.5 0.14 162)',
          boxShadow: capsize ? '0 0 12px oklch(0.66 0.24 28)' : warn ? '0 0 9px oklch(0.82 0.16 70)' : '0 0 5px oklch(0.5 0.14 162 / 0.7)',
          animation: capsize ? 'heelBlink 0.55s steps(1) infinite' : 'none',
        }} />
        <span className={`label-caps text-[10px] tracking-[0.18em] ${capsize ? 'crt-red' : warn ? 'crt-amber' : 'crt-dim'}`}
          style={capsize ? { animation: 'heelBlink 0.55s steps(1) infinite' } : undefined}>
          {capsize ? '⚠ LESZÚRÁSVESZÉLY' : warn ? 'FOKOZOTT DŐLÉS' : 'LESZÚRÁS ŐR · OK'}
        </span>
      </div>
    </div>
  )
}
