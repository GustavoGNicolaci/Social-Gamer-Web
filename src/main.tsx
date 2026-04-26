import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// auth provider
import { AuthProvider } from './contexts/AuthContext.tsx'
import { I18nProvider } from './i18n/I18nContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </AuthProvider>
  </StrictMode>,
)
