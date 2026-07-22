import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'

interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  tone?: 'default' | 'raised' | 'interactive'
  children: ReactNode
}

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(function Surface(
  { tone = 'default', className = '', children, ...props },
  ref,
) {
  return (
    <div ref={ref} className={`ui-surface ui-surface--${tone}${className ? ` ${className}` : ''}`} {...props}>
      {children}
    </div>
  )
})

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'brand' | 'neutral' | 'success' | 'warning' | 'danger'
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { tone = 'brand', className = '', children, ...props },
  ref,
) {
  return (
    <span ref={ref} className={`ui-badge ui-badge--${tone}${className ? ` ${className}` : ''}`} {...props}>
      {children}
    </span>
  )
})
