import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PanelProps {
  title?: string
  code?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  style?: React.CSSProperties
}

export function Panel({
  title,
  code,
  action,
  children,
  className,
  bodyClassName,
  style,
}: PanelProps) {
  return (
    <section
      style={style}
      className={cn(
        'instrument-bezel paper-grain group/panel relative flex h-full flex-col p-[3px]',
        className,
      )}
    >
      {/* Sarokszegecsek — műszerfal csavarok */}
      <span className="rivet left-1.5 top-1.5" aria-hidden />
      <span className="rivet right-1.5 top-1.5" aria-hidden />
      <span className="rivet bottom-1.5 left-1.5" aria-hidden />
      <span className="rivet bottom-1.5 right-1.5" aria-hidden />

      {/* Belső lemez */}
      <div className="flex h-full flex-col overflow-hidden rounded-[calc(var(--radius)-3px)] border border-[oklch(0.42_0.04_248)] bg-card text-card-foreground">
        {(title || action) && (
          <header className="flex items-center justify-between gap-2 border-b border-border bg-[oklch(0.965_0.014_92)] px-3 py-2">
            <div className="flex items-center gap-2">
              {code && (
                <span className="brass-plate label-caps rounded-[3px] px-1.5 py-0.5 text-[9px] leading-none">
                  {code}
                </span>
              )}
              {title && (
                <h2 className="label-caps text-xs text-foreground">{title}</h2>
              )}
            </div>
            {action}
          </header>
        )}
        <div className={cn('flex-1 p-4', bodyClassName)}>{children}</div>
      </div>
    </section>
  )
}
