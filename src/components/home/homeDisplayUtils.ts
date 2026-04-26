import { formatLocalizedDate, formatLocalizedNumber, translate } from '../../i18n'

export function formatCompactDate(
  value: string | null | undefined,
  fallback = translate('common.loadingShort')
) {
  return formatLocalizedDate(value, {
    fallback,
    day: '2-digit',
    month: 'short',
  })
}

export function formatFullDate(
  value: string | null | undefined,
  fallback = translate('common.noDate')
) {
  return formatLocalizedDate(value, { fallback })
}

export function formatCount(value: number) {
  return formatLocalizedNumber(value)
}

export function formatRating(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null

  return formatLocalizedNumber(value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })
}

export function getInitial(value: string, fallback = 'J') {
  const firstCharacter = value.trim().charAt(0)
  return firstCharacter ? firstCharacter.toUpperCase() : fallback
}

export const getDefaultRelativeDateFallback = () => translate('common.loadingShort')
export const getDefaultDateFallback = () => translate('common.noDate')
