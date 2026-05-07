import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/I18nContext'
import './SupportPage.css'

type InstitutionalPageKind = 'about' | 'terms' | 'privacy'

interface InstitutionalPageProps {
  page: InstitutionalPageKind
}

const CONTENT_KEYS: Record<InstitutionalPageKind, string[]> = {
  about: ['mission', 'community', 'catalog'],
  terms: ['placeholder', 'conduct', 'responsibility'],
  privacy: ['placeholder', 'account', 'future'],
}

function InstitutionalPage({ page }: InstitutionalPageProps) {
  const { t } = useI18n()

  return (
    <main className="page-container">
      <div className="page-content institutional-page">
        <section className="institutional-hero">
          <span className="institutional-kicker">{t('institutional.kicker')}</span>
          <h1>{t(`institutional.${page}.title`)}</h1>
          <p>{t(`institutional.${page}.description`)}</p>
        </section>

        <section className="institutional-panel">
          <h2>{t(`institutional.${page}.sectionTitle`)}</h2>
          <ul className="institutional-list">
            {CONTENT_KEYS[page].map(key => (
              <li key={key}>{t(`institutional.${page}.${key}`)}</li>
            ))}
          </ul>
          <Link to="/suporte" className="institutional-link">
            {t('institutional.supportLink')}
          </Link>
        </section>
      </div>
    </main>
  )
}

export default InstitutionalPage
