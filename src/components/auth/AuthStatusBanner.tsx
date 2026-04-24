import type { ReactNode } from 'react'

interface AuthStatusBannerProps {
  tone: 'error' | 'success' | 'info'
  children: ReactNode
}

function AuthStatusBanner({ tone, children }: AuthStatusBannerProps) {
  const role = tone === 'error' ? 'alert' : 'status'
  const live = tone === 'error' ? 'assertive' : 'polite'

  return (
    <div className={`auth-status-banner is-${tone}`} role={role} aria-live={live}>
      <span className="auth-status-banner__indicator" aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}

export default AuthStatusBanner
