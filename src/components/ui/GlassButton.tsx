import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  isLoading?: boolean
}

const baseClasses =
  'inline-flex items-center justify-center rounded-full font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-60'

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-slate-900 text-white shadow-sm hover:bg-slate-800 active:bg-slate-950',
  secondary:
    'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-3 text-lg',
}

export const GlassButton = ({
  variant = 'primary',
  size = 'md',
  className,
  children,
  isLoading,
  disabled,
  ...props
}: GlassButtonProps) => (
  <button
    className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
    disabled={disabled || isLoading}
    {...props}
  >
    {isLoading ? 'Loading…' : children}
  </button>
)
