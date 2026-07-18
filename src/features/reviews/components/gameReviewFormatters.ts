import { formatLocalizedDate, formatLocalizedNumber } from '../../../i18n'

export function formatReviewDate(value: string | null | undefined, fallback?: string) {
  return formatLocalizedDate(value, { fallback })
}

export function formatReviewScore(score: number) {
  return formatLocalizedNumber(score, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })
}

export function getReviewUserName(
  usuario: { username?: string | null } | null | undefined,
  fallback: string
) {
  return usuario?.username?.trim() || fallback
}
