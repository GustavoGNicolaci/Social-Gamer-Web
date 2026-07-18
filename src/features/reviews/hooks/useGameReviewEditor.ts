import {
  useCallback,
  useEffect,
  useMemo,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react'
import { saveReview } from '../../../services/reviewService'
import type { ReviewError } from '../domain/reviewError'
import type { ReviewItem } from '../domain/reviewModels'
import type {
  ReviewFeedbackState,
  UseGameReviewsControllerOptions,
} from './gameReviewControllerContracts'
import { getReviewErrorMessage } from './reviewControllerHelpers'

interface UseGameReviewEditorOptions {
  currentUserId: string | null
  gameId: number | null
  scopeKey: string
  isScopeActive: (expectedScopeKey: string) => boolean
  reviews: ReviewItem[]
  ownReview: ReviewItem | null
  score: number
  setScore: Dispatch<SetStateAction<number>>
  text: string
  setText: Dispatch<SetStateAction<string>>
  setSubmitting: Dispatch<SetStateAction<boolean>>
  setFeedback: Dispatch<SetStateAction<ReviewFeedbackState | null>>
  refreshReviews: (requestedGameId?: number | null) => Promise<{
    data: ReviewItem[]
    error: ReviewError | null
  }>
  refreshOverview: (requestedGameId?: number | null) => Promise<unknown>
  t: UseGameReviewsControllerOptions['t']
}

export function useGameReviewEditor({
  currentUserId,
  gameId,
  scopeKey,
  isScopeActive,
  reviews,
  ownReview,
  score,
  setScore,
  text,
  setText,
  setSubmitting,
  setFeedback,
  refreshReviews,
  refreshOverview,
  t,
}: UseGameReviewEditorOptions) {
  const currentUserReview = useMemo(() => {
    if (!currentUserId) return null
    return reviews.find(review => review.usuario_id === currentUserId) || ownReview
  }, [currentUserId, ownReview, reviews])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setFeedback(null)

      if (!currentUserId || !gameId) {
        setScore(5)
        setText('')
        return
      }

      if (currentUserReview) {
        setScore(currentUserReview.nota)
        setText(currentUserReview.texto_review || '')
        return
      }

      setScore(5)
      setText('')
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [
    currentUserId,
    currentUserReview,
    gameId,
    setFeedback,
    setScore,
    setText,
  ])

  const submit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!currentUserId || !gameId) return

    const expectedScopeKey = scopeKey
    setSubmitting(true)
    setFeedback(null)

    const saveResult = await saveReview({
      userId: currentUserId,
      gameId,
      nota: score,
      textoReview: text,
    })

    if (!isScopeActive(expectedScopeKey)) return

    if (saveResult.error) {
      setFeedback({
        tone: 'error',
        message: getReviewErrorMessage(t, saveResult.error, 'save'),
      })
      setSubmitting(false)
      return
    }

    const [refreshResult] = await Promise.all([
      refreshReviews(gameId),
      refreshOverview(gameId),
    ])

    if (!isScopeActive(expectedScopeKey)) return

    setFeedback(
      refreshResult.error && refreshResult.data.length === 0
        ? {
            tone: 'info',
            message: t('game.details.reviewFeedback.saveRefreshFailed'),
          }
        : {
            tone: 'success',
            message:
              saveResult.status === 'updated'
                ? t('game.details.reviewFeedback.updated')
                : t('game.details.reviewFeedback.created'),
          }
    )
    setSubmitting(false)
  }, [
    currentUserId,
    gameId,
    isScopeActive,
    refreshOverview,
    refreshReviews,
    scopeKey,
    score,
    setFeedback,
    setSubmitting,
    t,
    text,
  ])

  return {
    currentUserReview,
    submit,
  }
}
