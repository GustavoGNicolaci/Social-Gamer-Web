import type { ReactNode } from 'react'
import './AuthShell.css'

interface AuthShellProps {
  title: string
  subtitle: string
  heroEyebrow: string
  heroTitle: string
  heroDescription: string
  heroHighlights?: string[]
  footer?: ReactNode
  children: ReactNode
  layout?: 'default' | 'auth' | 'wide'
}

function AuthShell({
  title,
  subtitle,
  heroEyebrow,
  heroTitle,
  heroDescription,
  heroHighlights = [],
  footer,
  children,
  layout = 'default',
}: AuthShellProps) {
  return (
    <div className="page-container auth-page">
      <div className={`auth-shell auth-shell--${layout}`}>
        <section className="auth-hero" aria-hidden="true">
          <span className="auth-hero__eyebrow">{heroEyebrow}</span>
          <h2 className="auth-hero__title">{heroTitle}</h2>
          <p className="auth-hero__description">{heroDescription}</p>
          {heroHighlights.length > 0 ? (
            <ul className="auth-hero__list">
              {heroHighlights.map((highlight) => (
                <li key={highlight} className="auth-hero__item">
                  {highlight}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="auth-card">
          <header className="auth-card__header">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </header>

          <div className="auth-card__body">{children}</div>

          {footer ? <footer className="auth-card__footer">{footer}</footer> : null}
        </section>
      </div>
    </div>
  )
}

export default AuthShell
