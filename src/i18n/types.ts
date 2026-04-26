export type SupportedLocale = 'pt-BR' | 'en-US'

export type TranslationParam = string | number

export type TranslationParams = Record<string, TranslationParam>

export type TranslationDictionary = Record<string, string>

export interface FormatDateOptions extends Intl.DateTimeFormatOptions {
  fallback?: string
}

export type FormatNumberOptions = Intl.NumberFormatOptions
