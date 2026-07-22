import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom'
import SiteFooter from '../components/footer/SiteFooter'
import Navbar from '../components/navbar/Navbar'
import RouteErrorBoundary from '../components/system/AppErrorBoundary'
import { useI18n } from '../i18n/I18nContext'

const HomePage = lazy(() => import('../pages/HomePage'))
const GamesPage = lazy(() => import('../pages/GamesPage'))
const GameDetailsPage = lazy(() => import('../pages/GameDetailsPage'))
const CommunitiesPage = lazy(() => import('../pages/CommunitiesPage'))
const CommunityDetailsPage = lazy(() => import('../pages/CommunityDetailsPage'))
const ProfilePage = lazy(() =>
  import('../pages/ProfilePage').then(module => ({ default: module.ProfilePage })),
)
const AccountSettingsPage = lazy(() => import('../pages/AccountSettingsPage'))
const LoginPage = lazy(() => import('../pages/LoginPage'))
const RegisterPage = lazy(() => import('../pages/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('../pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('../pages/ResetPasswordPage'))
const SupportPage = lazy(() => import('../pages/SupportPage'))
const InstitutionalPage = lazy(() => import('../pages/InstitutionalPage'))
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'))

function RouteFallback() {
  const { t } = useI18n()

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="route-loading-card" role="status" aria-live="polite">
          <span>{t('app.loadingPage')}</span>
        </div>
      </div>
    </div>
  )
}

function AppShell() {
  const location = useLocation()
  const { t } = useI18n()

  return (
    <>
      <a href="#main-content" className="skip-link">{t('app.skipToContent')}</a>
      <Navbar />
      <main id="main-content" className="app-main" tabIndex={-1}>
        <RouteErrorBoundary resetKey={`${location.pathname}${location.search}${location.hash}`}>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/games" element={<GamesPage />} />
              <Route path="/games/:id" element={<GameDetailsPage />} />
              <Route path="/comunidades" element={<CommunitiesPage />} />
              <Route path="/comunidades/:id" element={<CommunityDetailsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/u/:username" element={<ProfilePage />} />
              <Route path="/configuracoes/conta" element={<AccountSettingsPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/esqueci-a-senha" element={<ForgotPasswordPage />} />
              <Route path="/resetar-senha" element={<ResetPasswordPage />} />
              <Route path="/suporte" element={<SupportPage />} />
              <Route path="/sobre" element={<InstitutionalPage page="about" />} />
              <Route path="/termos" element={<InstitutionalPage page="terms" />} />
              <Route path="/privacidade" element={<InstitutionalPage page="privacy" />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </RouteErrorBoundary>
      </main>
      <SiteFooter />
    </>
  )
}

export function AppRouter() {
  return (
    <Router>
      <AppShell />
    </Router>
  )
}
