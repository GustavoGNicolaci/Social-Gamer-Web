import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n/I18nContext'
import './SystemPages.css'

interface BoundaryProps {
  children: ReactNode
  resetKey: string
  eyebrow: string
  title: string
  message: string
  reloadLabel: string
  homeLabel: string
}

interface BoundaryState {
  hasError: boolean
}

class AppErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false }

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Route rendering failed', error, errorInfo)
  }

  componentDidUpdate(previousProps: BoundaryProps) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="page-container system-page">
        <section className="system-state-card" role="alert">
          <span className="system-state-icon is-error" aria-hidden="true">
            <AlertTriangle />
          </span>
          <p className="system-state-eyebrow">{this.props.eyebrow}</p>
          <h1>{this.props.title}</h1>
          <p className="system-state-copy">{this.props.message}</p>
          <div className="system-state-actions">
            <button type="button" className="system-state-primary" onClick={() => window.location.reload()}>
              <RefreshCw aria-hidden="true" />
              {this.props.reloadLabel}
            </button>
            <Link to="/" className="system-state-secondary">
              <Home aria-hidden="true" />
              {this.props.homeLabel}
            </Link>
          </div>
        </section>
      </div>
    )
  }
}

interface RouteErrorBoundaryProps {
  children: ReactNode
  resetKey: string
}

export default function RouteErrorBoundary({ children, resetKey }: RouteErrorBoundaryProps) {
  const { t } = useI18n()

  return (
    <AppErrorBoundary
      resetKey={resetKey}
      eyebrow={t('app.errorEyebrow')}
      title={t('app.errorTitle')}
      message={t('app.errorText')}
      reloadLabel={t('app.reload')}
      homeLabel={t('app.backHome')}
    >
      {children}
    </AppErrorBoundary>
  )
}
