import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info } from 'lucide-react'

interface AuthStatusBannerProps {
  tone: 'error' | 'success' | 'info'
  children: ReactNode
}

function AuthStatusBanner({ tone, children }: AuthStatusBannerProps) {
  const role = tone === 'error' ? 'alert' : 'status'
  const live = tone === 'error' ? 'assertive' : 'polite'
  const StatusIcon = tone === 'error' ? CircleAlert : tone === 'success' ? CircleCheck : Info

  return (
    <div className={`auth-status-banner is-${tone}`} role={role} aria-live={live}>
      <span className="auth-status-banner__indicator" aria-hidden="true">
        <StatusIcon />
      </span>
      <span>{children}</span>
    </div>
  )
}

export default AuthStatusBanner
