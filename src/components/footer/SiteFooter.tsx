import { Gamepad2, HeartHandshake, Mail, MessageSquareText, ShieldCheck, Star, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import BrandLogo from '../brand/BrandLogo'
import { SUPPORT_EMAIL } from '../../config/site'
import { useAuth } from '../../contexts/AuthContext'
import { useI18n } from '../../i18n/I18nContext'
import { getPublicProfilePath } from '../../utils/profileRoutes'
import './SiteFooter.css'

function SiteFooter() {
  const { user, profile } = useAuth()
  const { t } = useI18n()
  const currentYear = new Date().getFullYear()
  const profilePath = profile?.username ? getPublicProfilePath(profile.username) : '/profile'

  const quickLinks = [
    { to: '/', label: t('common.home') },
    { to: '/games', label: t('common.games') },
    { to: '/comunidades', label: t('communities.nav') },
    ...(user ? [{ to: profilePath, label: t('common.profile') }] : []),
    { to: '/suporte', label: t('common.support') },
  ]

  const institutionalLinks = [
    { to: '/sobre', label: t('institutional.about.title') },
    { to: '/termos', label: t('institutional.terms.title') },
    { to: '/privacidade', label: t('institutional.privacy.title') },
  ]

  const highlights = [
    { icon: <Star />, label: t('footer.highlight.reviews') },
    { icon: <Users />, label: t('footer.highlight.communities') },
    { icon: <Gamepad2 />, label: t('footer.highlight.catalog') },
  ]

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <section className="site-footer-brand" aria-label={t('footer.brandLabel')}>
          <Link to="/" className="site-footer-logo">
            <BrandLogo showWordmark title={t('common.appName')} subtitle={t('navbar.subtitle')} />
          </Link>
          <p>{t('footer.description')}</p>

          <div className="site-footer-highlights" aria-label={t('footer.highlightsLabel')}>
            {highlights.map(item => (
              <span key={item.label} className="site-footer-highlight">
                {item.icon}
                <span>{item.label}</span>
              </span>
            ))}
          </div>
        </section>

        <nav className="site-footer-section" aria-label={t('footer.quickLinks')}>
          <h2>{t('footer.quickLinks')}</h2>
          <ul>
            {quickLinks.map(link => (
              <li key={link.to}>
                <Link to={link.to}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav className="site-footer-section" aria-label={t('footer.institutional')}>
          <h2>{t('footer.institutional')}</h2>
          <ul>
            {institutionalLinks.map(link => (
              <li key={link.to}>
                <Link to={link.to}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <section className="site-footer-support" aria-label={t('footer.supportTitle')}>
          <div className="site-footer-support-icon" aria-hidden="true">
            <HeartHandshake />
          </div>
          <div>
            <h2>{t('footer.supportTitle')}</h2>
            <p>{t('footer.supportText')}</p>
            <Link to="/suporte" className="site-footer-support-link">
              <MessageSquareText />
              <span>{t('footer.supportCta')}</span>
            </Link>
          </div>
        </section>
      </div>

      <div className="site-footer-bottom">
        <span>{t('footer.copyright', { year: currentYear })}</span>
        <span className="site-footer-contact">
          <Mail />
          <span>{SUPPORT_EMAIL}</span>
        </span>
        <span className="site-footer-note">
          <ShieldCheck />
          <span>{t('footer.safetyNote')}</span>
        </span>
      </div>
    </footer>
  )
}

export default SiteFooter
