import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PanelProps {
  title?: string
  code?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}

export function Panel({
  title,
  code,
  action,
  children,
  className,
  bodyClassName,
}: PanelProps) {
  return (
    <section
      className={cn(
        'paper-grain flex flex-col rounded-sm border border-border bg-card text-card-foreground shadow-[0_1px_0_oklch(0.74_0.03_75)] h-full',
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <div className="flex items-baseline gap-2">
            {code && (
              <span className="label-caps text-[10px] text-accent">
                {code}
              </span>
            )}
            <h2 className="label-caps text-xs text-foreground">{title}</h2>
          </div>
          {action}
        </header>
      )}
      <div className={cn('flex-1 p-4', bodyClassName)}>{children}</div>
    </section>
  )
}
