import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Navbar from './components/navbar/Navbar'
import { useI18n } from './i18n/I18nContext'
import './App.css'

const HomePage = lazy(() => import('./pages/HomePage'))
const GamesPage = lazy(() => import('./pages/GamesPage'))
const GameDetailsPage = lazy(() => import('./pages/GameDetailsPage'))
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage').then(module => ({ default: module.ProfilePage }))
)
const AccountSettingsPage = lazy(() => import('./pages/AccountSettingsPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))

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

function App() {
  return (
    <Router>
      <Navbar />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/games" element={<GamesPage />} />
          <Route path="/games/:id" element={<GameDetailsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/u/:username" element={<ProfilePage />} />
          <Route path="/configuracoes/conta" element={<AccountSettingsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/esqueci-a-senha" element={<ForgotPasswordPage />} />
          <Route path="/resetar-senha" element={<ResetPasswordPage />} />
        </Routes>
      </Suspense>
    </Router>
  )
}

export default App
