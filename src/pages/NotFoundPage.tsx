import { Gamepad2, Home, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/I18nContext'
import '../components/system/SystemPages.css'

export default function NotFoundPage() {
  const { t } = useI18n()

  return (
    <div className="page-container system-page">
      <section className="system-state-card">
        <span className="system-state-icon" aria-hidden="true">
          <Gamepad2 />
        </span>
        <p className="system-state-eyebrow">{t('app.notFoundEyebrow')}</p>
        <h1>{t('app.notFoundTitle')}</h1>
        <p className="system-state-copy">{t('app.notFoundText')}</p>
        <div className="system-state-actions">
          <Link to="/games" className="system-state-primary">
            <Search aria-hidden="true" />
            {t('common.openCatalog')}
          </Link>
          <Link to="/" className="system-state-secondary">
            <Home aria-hidden="true" />
            {t('app.backHome')}
          </Link>
        </div>
      </section>
    </div>
  )
}
