'use client'

import { Sailboat } from 'lucide-react'

interface StartConsoleProps {
  startState: 'waiting' | 'ready' | 'started' | 'expired'
  countdown: string
  hasStarted: boolean
  onStart: () => void
}

// Visszaszámláló-fázis a hátralevő másodpercekből (countdown formátum: "-MM:SS" vagy "+MM:SS")
function phaseFromCountdown(countdown: string, startState: string): { label: string; armed: boolean } {
  if (startState === 'expired') return { label: 'LEJÁRT', armed: false }
  if (!countdown) return { label: 'KÉSZENLÉT', armed: false }
  const sign = countdown[0]
  const [mm, ss] = countdown.slice(1).split(':').map(Number)
  const totalSec = (mm || 0) * 60 + (ss || 0)
  if (sign === '+') return { label: 'RAJT NYITVA', armed: true }
  if (totalSec <= 60) return { label: 'T-1 PERC', armed: true }
  if (totalSec <= 4 * 60) return { label: 'T-4 PERC', armed: true }
  if (totalSec <= 5 * 60) return { label: 'T-5 PERC', armed: true }
  if (totalSec <= 10 * 60) return { label: 'T-10 PERC', armed: false }
  return { label: 'ELŐKÉSZÜLET', armed: false }
}

export function StartConsole({ startState, countdown, hasStarted, onStart }: StartConsoleProps) {
  const armed = startState === 'ready' && !hasStarted
  const phase = hasStarted
    ? { label: 'VERSENYBEN', armed: false }
    : phaseFromCountdown(countdown, startState)

  return (
    <div className="instrument-bezel relative mx-auto flex w-full max-w-2xl items-center justify-between gap-5 px-5 py-4">
      {/* sarokszegecsek */}
      <span className="rivet left-2 top-2" />
      <span className="rivet right-2 top-2" />
      <span className="rivet bottom-2 left-2" />
      <span className="rivet bottom-2 right-2" />

      {/* Bal: fázis + visszaszámláló LCD */}
      <div className="flex flex-1 flex-col gap-1.5">
        <span className="brass-plate label-caps w-fit rounded-[3px] px-2 py-0.5 text-[9px] leading-none">
          Rajtvezérlő · RC-00
        </span>
        <div className="lcd-screen lcd-amber flex items-center justify-between px-3 py-2">
          <span className="label-caps text-[10px] opacity-80">{phase.label}</span>
          <span className="text-2xl font-bold tabular-nums tracking-wider">
            {countdown || '--:--'}
          </span>
        </div>
        {/* Fázis-lámpák */}
        <div className="flex items-center gap-3 pl-0.5">
          {['T-10', 'T-5', 'T-1', 'GO'].map((t) => {
            const active =
              (t === 'T-10' && phase.label === 'T-10 PERC') ||
              (t === 'T-5' && phase.label === 'T-5 PERC') ||
              (t === 'T-1' && phase.label === 'T-1 PERC') ||
              (t === 'GO' && (phase.label === 'RAJT NYITVA' || hasStarted))
            return (
              <div key={t} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full transition-all"
                  style={{
                    background: active ? 'oklch(0.7 0.2 28)' : 'oklch(0.3 0.03 250)',
                    boxShadow: active ? '0 0 8px oklch(0.7 0.2 28 / 0.9)' : 'inset 0 1px 2px oklch(0 0 0 / 0.6)',
                  }}
                  aria-hidden
                />
                <span className="label-caps text-[8px] text-[oklch(0.7_0.04_90/0.7)]">{t}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Jobb: világító piros punch button */}
      <div className="flex flex-col items-center gap-1.5">
        <button
          onClick={armed ? onStart : undefined}
          disabled={!armed}
          aria-label="Rajt"
          className={`punch-button ${armed ? 'punch-armed' : ''} flex size-24 flex-col items-center justify-center`}
          style={{
            cursor: armed ? 'pointer' : 'default',
            filter: hasStarted || !armed ? 'saturate(0.55) brightness(0.8)' : 'none',
          }}
        >
          <Sailboat className="size-7 text-[oklch(0.97_0.02_30)]" strokeWidth={2} />
          <span className="mt-0.5 font-heading text-base font-black uppercase tracking-wider text-[oklch(0.98_0.02_30)]">
            {hasStarted ? 'RAJT' : 'RAJT'}
          </span>
        </button>
        <span className="label-caps text-[8px] text-[oklch(0.45_0.03_250)]">
          {hasStarted ? 'Elindultál' : armed ? 'Nyomd meg!' : 'Zárolva'}
        </span>
      </div>
    </div>
  )
}
