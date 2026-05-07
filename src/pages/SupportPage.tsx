import { AlertTriangle, Bug, Gamepad2, Lightbulb, Mail, MessageSquareText, ShieldAlert, UserRound } from 'lucide-react'
import { SUPPORT_EMAIL } from '../config/site'
import { useI18n } from '../i18n/I18nContext'
import './SupportPage.css'

const REQUEST_TYPES = [
  { key: 'bug', icon: <Bug /> },
  { key: 'account', icon: <UserRound /> },
  { key: 'community', icon: <Gamepad2 /> },
  { key: 'content', icon: <MessageSquareText /> },
  { key: 'suggestion', icon: <Lightbulb /> },
  { key: 'safety', icon: <ShieldAlert /> },
]

const EMAIL_CHECKLIST_KEYS = [
  'username',
  'accountEmail',
  'description',
  'steps',
  'media',
  'device',
  'pageLink',
]

function SupportPage() {
  const { t } = useI18n()

  return (
    <main className="page-container">
      <div className="page-content support-page">
        <section className="support-hero">
          <div className="support-hero-copy">
            <span className="support-kicker">{t('support.kicker')}</span>
            <h1>{t('support.title')}</h1>
            <p>{t('support.description')}</p>
          </div>

          <aside className="support-contact-card" aria-label={t('support.contact.title')}>
            <div className="support-contact-icon" aria-hidden="true">
              <Mail />
            </div>
            <span>{t('support.contact.eyebrow')}</span>
            <strong>{SUPPORT_EMAIL}</strong>
            <p>{t('support.contact.note')}</p>
          </aside>
        </section>

        <section className="support-section">
          <div className="support-section-head">
            <span className="support-kicker">{t('support.help.kicker')}</span>
            <h2>{t('support.help.title')}</h2>
            <p>{t('support.help.text')}</p>
          </div>

          <div className="support-request-grid">
            {REQUEST_TYPES.map(item => (
              <article key={item.key} className="support-request-card">
                <div className="support-request-icon" aria-hidden="true">
                  {item.icon}
                </div>
                <h3>{t(`support.request.${item.key}.title`)}</h3>
                <p>{t(`support.request.${item.key}.text`)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="support-layout">
          <article className="support-panel">
            <div className="support-section-head">
              <span className="support-kicker">{t('support.before.kicker')}</span>
              <h2>{t('support.before.title')}</h2>
              <p>{t('support.before.text')}</p>
            </div>

            <div className="support-warning">
              <AlertTriangle aria-hidden="true" />
              <p>{t('support.before.notice')}</p>
            </div>
          </article>

          <article className="support-panel">
            <div className="support-section-head">
              <span className="support-kicker">{t('support.include.kicker')}</span>
              <h2>{t('support.include.title')}</h2>
              <p>{t('support.include.text')}</p>
            </div>

            <ul className="support-checklist">
              {EMAIL_CHECKLIST_KEYS.map(key => (
                <li key={key}>{t(`support.include.${key}`)}</li>
              ))}
            </ul>
          </article>
        </section>

        <section className="support-email-section">
          <div>
            <span className="support-kicker">{t('support.email.kicker')}</span>
            <h2>{t('support.email.title')}</h2>
            <p>{t('support.email.text')}</p>
          </div>
          <div className="support-email-box">
            <Mail aria-hidden="true" />
            <strong>{SUPPORT_EMAIL}</strong>
            <span>{t('support.email.future')}</span>
          </div>
        </section>
      </div>
    </main>
  )
}

export default SupportPage
