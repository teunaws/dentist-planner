import type { ComponentPropsWithoutRef, ElementType } from 'react'
import { cn } from '../../lib/utils'

type CardProps<T extends ElementType> = {
  as?: T
  className?: string
} & ComponentPropsWithoutRef<T>

export const GlassCard = <T extends ElementType = 'div'>({
  as,
  className,
  ...props
}: CardProps<T>) => {
  const Component = as ?? 'div'

  return (
    <Component
      className={cn(
        'rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm',
        'transition duration-200 hover:shadow-md',
        className,
      )}
      {...props}
    />
  )
}
