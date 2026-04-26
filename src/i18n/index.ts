import { enUS } from './locales/en-US'
import { ptBR } from './locales/pt-BR'
import type {
  FormatDateOptions,
  FormatNumberOptions,
  SupportedLocale,
  TranslationDictionary,
  TranslationParams,
} from './types'

export type { FormatDateOptions, FormatNumberOptions, SupportedLocale, TranslationParams }

export const DEFAULT_LOCALE: SupportedLocale = 'pt-BR'
export const LANGUAGE_SETTINGS_KEY = 'idioma_interface'
export const LOCALE_STORAGE_KEY = 'social-gamer-locale'

const dictionaries: Record<SupportedLocale, TranslationDictionary> = {
  'pt-BR': ptBR,
  'en-US': enUS,
}

let runtimeLocale: SupportedLocale = DEFAULT_LOCALE

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return value === 'pt-BR' || value === 'en-US'
}

function canUseBrowserStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function getStoredLocale() {
  if (!canUseBrowserStorage()) return null

  try {
    const storedValue = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    return isSupportedLocale(storedValue) ? storedValue : null
  } catch {
    return null
  }
}

export function persistStoredLocale(locale: SupportedLocale) {
  if (!canUseBrowserStorage()) return

  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // Ignore storage failures so language switching never blocks the UI.
  }
}

export function detectBrowserLocale(): SupportedLocale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE

  const preferredLanguages = [
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language,
  ].filter(Boolean)

  return preferredLanguages.some(language => language.toLowerCase().startsWith('en'))
    ? 'en-US'
    : DEFAULT_LOCALE
}

export function getInitialLocale(): SupportedLocale {
  return getStoredLocale() || detectBrowserLocale()
}

export function setRuntimeLocale(locale: SupportedLocale) {
  runtimeLocale = locale

  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale
  }
}

export function getRuntimeLocale() {
  return runtimeLocale
}

export function getLocaleFromPrivacySettings(
  settings: Record<string, unknown> | null | undefined
) {
  const value = settings?.[LANGUAGE_SETTINGS_KEY]
  return isSupportedLocale(value) ? value : null
}

export function mergeLocaleIntoPrivacySettings(
  settings: Record<string, unknown> | null | undefined,
  locale: SupportedLocale
) {
  return {
    ...(settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {}),
    [LANGUAGE_SETTINGS_KEY]: locale,
  }
}

export function translate(
  key: string,
  params?: TranslationParams,
  locale: SupportedLocale = runtimeLocale
) {
  const template = dictionaries[locale][key] ?? dictionaries[DEFAULT_LOCALE][key] ?? key

  if (!params) return template

  return Object.entries(params).reduce(
    (message, [paramKey, value]) => message.replaceAll(`{${paramKey}}`, String(value)),
    template
  )
}

export function formatLocalizedNumber(
  value: number,
  options?: FormatNumberOptions,
  locale: SupportedLocale = runtimeLocale
) {
  return value.toLocaleString(locale, options)
}

export function formatLocalizedDate(
  value: string | number | Date | null | undefined,
  options: FormatDateOptions = {},
  locale: SupportedLocale = runtimeLocale
) {
  const { fallback = translate('common.noDate', undefined, locale), ...dateOptions } = options

  if (!value) return fallback

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return fallback

  return date.toLocaleDateString(locale, dateOptions)
}

setRuntimeLocale(getInitialLocale())

