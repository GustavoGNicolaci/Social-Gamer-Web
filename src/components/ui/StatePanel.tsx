import type { ReactNode } from 'react'

interface StatePanelProps {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  tone?: 'neutral' | 'loading' | 'error' | 'success' | 'not-found'
  compact?: boolean
  className?: string
}

export function StatePanel({
  eyebrow,
  title,
  description,
  icon,
  action,
  tone = 'neutral',
  compact = false,
  className = '',
}: StatePanelProps) {
  const liveRole = tone === 'error' ? 'alert' : tone === 'loading' ? 'status' : undefined

  return (
    <section
      className={`ui-state-panel ui-state-panel--${tone}${compact ? ' is-compact' : ''}${className ? ` ${className}` : ''}`}
      role={liveRole}
      aria-live={tone === 'loading' ? 'polite' : undefined}
    >
      {icon ? <span className="ui-state-panel-icon" aria-hidden="true">{icon}</span> : null}
      <div className="ui-state-panel-copy">
        {eyebrow ? <span className="ui-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="ui-state-panel-action">{action}</div> : null}
    </section>
  )
}

interface SkeletonProps {
  width?: string
  height?: string
  radius?: string
  className?: string
}

export function Skeleton({ width = '100%', height = '1rem', radius = 'var(--radius-md)', className = '' }: SkeletonProps) {
  return (
    <span
      className={`ui-skeleton${className ? ` ${className}` : ''}`}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  )
}
