import type { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({ eyebrow, title, description, actions, className = '' }: PageHeaderProps) {
  return (
    <header className={`ui-page-header${className ? ` ${className}` : ''}`}>
      <div className="ui-page-header-copy">
        {eyebrow ? <span className="ui-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="ui-page-header-actions">{actions}</div> : null}
    </header>
  )
}

interface SectionHeaderProps {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function SectionHeader({ eyebrow, title, description, action, className = '' }: SectionHeaderProps) {
  return (
    <header className={`ui-section-header${className ? ` ${className}` : ''}`}>
      <div>
        {eyebrow ? <span className="ui-eyebrow">{eyebrow}</span> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="ui-section-header-action">{action}</div> : null}
    </header>
  )
}
