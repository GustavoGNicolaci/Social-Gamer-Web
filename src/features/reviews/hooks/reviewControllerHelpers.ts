import type { ReviewError } from '../domain/reviewError'
import {
  isSupabaseDuplicateError,
  isSupabasePermissionError,
  isSupabaseStructureError,
} from '../../../utils/supabaseErrors'
import type { UseGameReviewsControllerOptions } from './gameReviewControllerContracts'

type Translate = UseGameReviewsControllerOptions['t']

export type ReviewAction =
  | 'load'
  | 'save'
  | 'comment'
  | 'comment_delete'
  | 'review_like'
  | 'review_dislike'
  | 'comment_like'
  | 'comment_dislike'
  | 'report'
  | 'report_delete'
  | 'delete'

export function getReviewErrorMessage(
  t: Translate,
  error: ReviewError | null,
  action: ReviewAction
) {
  if (!error) {
    return t(`game.details.reviewError.${action}.default`)
  }

  if (isSupabasePermissionError(error)) {
    return t(`game.details.reviewError.${action}.permission`)
  }

  if (isSupabaseDuplicateError(error)) {
    if (action === 'review_like' || action === 'comment_like' || action === 'report') {
      return t(`game.details.reviewError.${action}.duplicate`)
    }
    if (action === 'review_dislike' || action === 'comment_dislike') {
      return t('game.details.reviewError.dislike.duplicate')
    }
    return t('game.details.reviewError.save.duplicate')
  }

  if (isSupabaseStructureError(error)) {
    return t('game.details.reviewError.structure')
  }

  return t(`game.details.reviewError.${action}.default`)
}

export function removeRecordKey<T>(map: Record<string, T>, key: string) {
  const nextMap = { ...map }
  delete nextMap[key]
  return nextMap
}

export function getReviewHashTargetId(locationHash: string) {
  if (!locationHash) return ''

  try {
    return decodeURIComponent(locationHash.startsWith('#') ? locationHash.slice(1) : locationHash)
  } catch {
    return locationHash.startsWith('#') ? locationHash.slice(1) : locationHash
  }
}
