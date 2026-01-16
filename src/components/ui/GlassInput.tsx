import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helperText?: ReactNode
  error?: string
}

export const GlassInput = ({
  label,
  helperText,
  error,
  className,
  id,
  ...props
}: GlassInputProps) => (
  <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
    {label && <span>{label}</span>}
    <input
      id={id}
      className={cn(
        'rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400',
        'focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200',
        error && 'border-rose-300 focus:border-rose-500 focus:ring-rose-200',
        className,
      )}
      {...props}
    />
    {helperText && !error && (
      <span className="text-xs font-normal text-slate-500">{helperText}</span>
    )}
    {error && <span className="text-xs font-medium text-rose-600">{error}</span>}
  </label>
)
