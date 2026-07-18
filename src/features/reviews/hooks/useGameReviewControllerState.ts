import { useState } from 'react'
import type {
  GameRatingSummary,
  GameReviewOverview,
  ReviewItem,
} from '../domain/reviewModels'
import type {
  ReportModalTargetState,
  ReviewFeedbackState,
} from './gameReviewControllerContracts'

export function useGameReviewFeedState(gameId: number | null) {
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [ownReviewForForm, setOwnReviewForForm] = useState<ReviewItem | null>(null)
  const [ratingSummary, setRatingSummary] = useState<GameRatingSummary | null>(null)
  const [reviewOverview, setReviewOverview] = useState<GameReviewOverview | null>(null)
  const [reviewOverviewFallbackUsed, setReviewOverviewFallbackUsed] = useState(false)
  const [totalReviewCount, setTotalReviewCount] = useState(0)
  const [nextReviewOffset, setNextReviewOffset] = useState(0)
  const [reviewsLoading, setReviewsLoading] = useState(Boolean(gameId))
  const [reviewsError, setReviewsError] = useState<string | null>(null)
  const [loadingMoreReviews, setLoadingMoreReviews] = useState(false)

  return {
    reviews,
    setReviews,
    ownReviewForForm,
    setOwnReviewForForm,
    ratingSummary,
    setRatingSummary,
    reviewOverview,
    setReviewOverview,
    reviewOverviewFallbackUsed,
    setReviewOverviewFallbackUsed,
    totalReviewCount,
    setTotalReviewCount,
    nextReviewOffset,
    setNextReviewOffset,
    reviewsLoading,
    setReviewsLoading,
    reviewsError,
    setReviewsError,
    loadingMoreReviews,
    setLoadingMoreReviews,
  }
}

export function useGameReviewEditorState() {
  const [nota, setNota] = useState(5)
  const [textoReview, setTextoReview] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reviewFeedback, setReviewFeedback] = useState<ReviewFeedbackState | null>(null)

  return {
    nota,
    setNota,
    textoReview,
    setTextoReview,
    submitting,
    setSubmitting,
    reviewFeedback,
    setReviewFeedback,
  }
}

export function useGameReviewCommentsState() {
  const [comentarioTexto, setComentarioTexto] = useState<Record<string, string>>({})
  const [visibleCommentsByReviewId, setVisibleCommentsByReviewId] = useState<Record<string, number>>({})
  const [commentTotalsByReviewId, setCommentTotalsByReviewId] = useState<Record<string, number>>({})
  const [nextCommentOffsetByReviewId, setNextCommentOffsetByReviewId] = useState<Record<string, number>>({})
  const [loadingCommentsByReviewId, setLoadingCommentsByReviewId] = useState<Record<string, boolean>>({})
  const [submittingComentario, setSubmittingComentario] = useState<Record<string, boolean>>({})

  return {
    comentarioTexto,
    setComentarioTexto,
    visibleCommentsByReviewId,
    setVisibleCommentsByReviewId,
    commentTotalsByReviewId,
    setCommentTotalsByReviewId,
    nextCommentOffsetByReviewId,
    setNextCommentOffsetByReviewId,
    loadingCommentsByReviewId,
    setLoadingCommentsByReviewId,
    submittingComentario,
    setSubmittingComentario,
  }
}

export function useGameReviewReactionState() {
  const [pendingReviewReactionIds, setPendingReviewReactionIds] = useState<string[]>([])
  const [pendingCommentReactionIds, setPendingCommentReactionIds] = useState<string[]>([])
  const [deletingReviewIds, setDeletingReviewIds] = useState<string[]>([])

  return {
    pendingReviewReactionIds,
    setPendingReviewReactionIds,
    pendingCommentReactionIds,
    setPendingCommentReactionIds,
    deletingReviewIds,
    setDeletingReviewIds,
  }
}

export function useGameReviewReportState() {
  const [reportModalTarget, setReportModalTarget] = useState<ReportModalTargetState | null>(null)
  const [reportModalFeedback, setReportModalFeedback] = useState<ReviewFeedbackState | null>(null)
  const [submittingReport, setSubmittingReport] = useState(false)
  const [removingReport, setRemovingReport] = useState(false)

  return {
    reportModalTarget,
    setReportModalTarget,
    reportModalFeedback,
    setReportModalFeedback,
    submittingReport,
    setSubmittingReport,
    removingReport,
    setRemovingReport,
  }
}
