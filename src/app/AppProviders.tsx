import type { PropsWithChildren } from 'react'
import { AuthProvider } from '../contexts/AuthContext'
import { I18nProvider } from '../i18n/I18nContext'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AuthProvider>
      <I18nProvider>{children}</I18nProvider>
    </AuthProvider>
  )
}
