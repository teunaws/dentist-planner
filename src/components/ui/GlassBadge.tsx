import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

type Tone = 'success' | 'warning' | 'info'

const toneStyles: Record<Tone, string> = {
  success: 'bg-emerald-50 text-emerald-500 border-emerald-200',
  warning: 'bg-rose-50 text-rose-500 border-rose-200',
  info: 'bg-slate-100 text-slate-600 border-slate-200',
}

interface GlassBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
}

export const GlassBadge = ({ tone = 'info', className, ...props }: GlassBadgeProps) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide',
      toneStyles[tone],
      className,
    )}
    {...props}
  />
)
