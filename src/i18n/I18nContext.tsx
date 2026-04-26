/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  formatLocalizedDate,
  formatLocalizedNumber,
  getInitialLocale,
  getLocaleFromPrivacySettings,
  getStoredLocale,
  mergeLocaleIntoPrivacySettings,
  persistStoredLocale,
  setRuntimeLocale,
  translate,
  type FormatDateOptions,
  type FormatNumberOptions,
  type SupportedLocale,
  type TranslationParams,
} from './index'

interface I18nContextValue {
  locale: SupportedLocale
  setLocale: (locale: SupportedLocale) => Promise<void>
  t: (key: string, params?: TranslationParams) => string
  formatDate: (value: string | number | Date | null | undefined, options?: FormatDateOptions) => string
  formatNumber: (value: number, options?: FormatNumberOptions) => string
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined)

export function I18nProvider({ children }: { children: ReactNode }) {
  const { user, profile, updateOwnProfile } = useAuth()
  const [locale, setLocaleState] = useState<SupportedLocale>(() => getInitialLocale())
  const profileSyncInFlightRef = useRef(false)

  useEffect(() => {
    setRuntimeLocale(locale)
  }, [locale])

  useEffect(() => {
    if (!user || !profile || profileSyncInFlightRef.current) return

    const profileLocale = getLocaleFromPrivacySettings(profile.configuracoes_privacidade)

    if (profileLocale) {
      setLocaleState(profileLocale)
      persistStoredLocale(profileLocale)
      return
    }

    const storedLocale = getStoredLocale()
    if (!storedLocale) return

    profileSyncInFlightRef.current = true
    setLocaleState(storedLocale)

    void updateOwnProfile({
      configuracoes_privacidade: mergeLocaleIntoPrivacySettings(
        profile.configuracoes_privacidade,
        storedLocale
      ),
    }).finally(() => {
      profileSyncInFlightRef.current = false
    })
  }, [profile, updateOwnProfile, user])

  const setLocale = useCallback(
    async (nextLocale: SupportedLocale) => {
      setLocaleState(nextLocale)
      persistStoredLocale(nextLocale)

      if (!user || !profile) return

      const currentProfileLocale = getLocaleFromPrivacySettings(profile.configuracoes_privacidade)
      if (currentProfileLocale === nextLocale) return

      profileSyncInFlightRef.current = true

      try {
        const { error } = await updateOwnProfile({
          configuracoes_privacidade: mergeLocaleIntoPrivacySettings(
            profile.configuracoes_privacidade,
            nextLocale
          ),
        })

        if (error) throw error
      } finally {
        profileSyncInFlightRef.current = false
      }
    },
    [profile, updateOwnProfile, user]
  )

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, params) => translate(key, params, locale),
      formatDate: (valueToFormat, options) => formatLocalizedDate(valueToFormat, options, locale),
      formatNumber: (valueToFormat, options) => formatLocalizedNumber(valueToFormat, options, locale),
    }),
    [locale, setLocale]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)

  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }

  return context
}
