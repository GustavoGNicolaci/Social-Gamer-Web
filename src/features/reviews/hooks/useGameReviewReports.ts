import {
  useCallback,
  useMemo,
  type Dispatch,
  type SetStateAction,
} from 'react'
import {
  deleteContentReport,
  submitContentReport,
  type ReportReason,
  type ReportTargetType,
} from '../../../services/reviewInteractionsService'
import { applyContentReportState } from '../domain/gameReviewState'
import type { ReviewItem } from '../domain/reviewModels'
import type {
  ReportModalTargetState,
  ReviewFeedbackState,
  UseGameReviewsControllerOptions,
} from './gameReviewControllerContracts'
import { getReviewErrorMessage } from './reviewControllerHelpers'

interface UseGameReviewReportsOptions {
  currentUserId: string | null
  scopeKey: string
  isScopeActive: (expectedScopeKey: string) => boolean
  reviews: ReviewItem[]
  setReviews: Dispatch<SetStateAction<ReviewItem[]>>
  target: ReportModalTargetState | null
  setTarget: Dispatch<SetStateAction<ReportModalTargetState | null>>
  feedback: ReviewFeedbackState | null
  setFeedback: Dispatch<SetStateAction<ReviewFeedbackState | null>>
  submitting: boolean
  setSubmitting: Dispatch<SetStateAction<boolean>>
  removing: boolean
  setRemoving: Dispatch<SetStateAction<boolean>>
  t: UseGameReviewsControllerOptions['t']
}

export function useGameReviewReports({
  currentUserId,
  scopeKey,
  isScopeActive,
  reviews,
  setReviews,
  target,
  setTarget,
  feedback,
  setFeedback,
  submitting,
  setSubmitting,
  removing,
  setRemoving,
  t,
}: UseGameReviewReportsOptions) {
  const activeTarget = useMemo(() => {
    if (!target) return null

    if (target.targetType === 'review') {
      const review = reviews.find(item => item.id === target.targetId)
      if (!review) return null

      return {
        targetType: 'review' as const,
        targetId: review.id,
        reviewId: review.id,
        authorId: review.usuario_id,
        authorName: review.usuario?.username?.trim() || t('common.username'),
        currentReport: review.currentUserReport,
      }
    }

    const parentReview = reviews.find(item => item.id === target.reviewId)
    const comment = parentReview?.comentarios.find(item => item.id === target.targetId)
    if (!parentReview || !comment) return null

    return {
      targetType: 'comment' as const,
      targetId: comment.id,
      reviewId: parentReview.id,
      authorId: comment.usuario_id,
      authorName: comment.usuario?.username?.trim() || t('common.username'),
      currentReport: comment.currentUserReport,
    }
  }, [reviews, t, target])

  const open = useCallback((
    targetType: ReportTargetType,
    targetId: string,
    reviewId: string
  ) => {
    setTarget({ targetType, targetId, reviewId })
    setFeedback(null)
  }, [setFeedback, setTarget])

  const close = useCallback(() => {
    if (submitting || removing) return
    setTarget(null)
    setFeedback(null)
  }, [removing, setFeedback, setTarget, submitting])

  const submit = useCallback(async ({
    reason,
    description,
  }: {
    reason: ReportReason
    description: string
  }) => {
    if (!currentUserId || !activeTarget) return

    const expectedScopeKey = scopeKey
    const submittedTarget = activeTarget
    setSubmitting(true)
    setFeedback(null)

    const reportResult = await submitContentReport({
      userId: currentUserId,
      targetType: submittedTarget.targetType,
      targetId: submittedTarget.targetId,
      targetAuthorId: submittedTarget.authorId,
      reason,
      description,
    })

    if (!isScopeActive(expectedScopeKey)) return

    if (reportResult.error) {
      setFeedback({
        tone: 'error',
        message: getReviewErrorMessage(t, reportResult.error, 'report'),
      })
      setSubmitting(false)
      return
    }

    if (reportResult.data) {
      setReviews(current => applyContentReportState(
        current,
        submittedTarget.reviewId,
        submittedTarget.targetType,
        submittedTarget.targetId,
        reportResult.data
      ))
    }

    setFeedback({
      tone: reportResult.status === 'already_exists' ? 'info' : 'success',
      message:
        reportResult.status === 'already_exists'
          ? t('game.details.reportAlreadyExists')
          : t('game.details.reportCreated'),
    })
    setSubmitting(false)
  }, [
    activeTarget,
    currentUserId,
    isScopeActive,
    scopeKey,
    setFeedback,
    setReviews,
    setSubmitting,
    t,
  ])

  const remove = useCallback(async () => {
    if (!currentUserId || !activeTarget?.currentReport) return

    const expectedScopeKey = scopeKey
    const removedTarget = activeTarget
    setRemoving(true)
    setFeedback(null)

    const reportResult = await deleteContentReport({
      userId: currentUserId,
      reportId: activeTarget.currentReport.id,
    })

    if (!isScopeActive(expectedScopeKey)) return

    if (reportResult.error) {
      setFeedback({
        tone: 'error',
        message: getReviewErrorMessage(t, reportResult.error, 'report_delete'),
      })
      setRemoving(false)
      return
    }

    setReviews(current => applyContentReportState(
      current,
      removedTarget.reviewId,
      removedTarget.targetType,
      removedTarget.targetId,
      null
    ))
    setFeedback({
      tone: 'success',
      message: t('game.details.reportRemoved'),
    })
    setRemoving(false)
  }, [
    activeTarget,
    currentUserId,
    isScopeActive,
    scopeKey,
    setFeedback,
    setRemoving,
    setReviews,
    t,
  ])

  return {
    activeTarget,
    feedback,
    submitting,
    removing,
    open,
    close,
    submit,
    remove,
  }
}
