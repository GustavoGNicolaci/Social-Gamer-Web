import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react'
import {
  getGameReviewOverview,
  getGameReviewsPage,
  getReviewByGameAndUserId,
  getReviewCommentsPage,
  resolveGameReviewAnchor,
  type GameRatingSummary,
  type ReviewError,
  type ReviewItem,
} from '../../../services/reviewService'
import {
  mergeCommentPagePreservingClientState,
  mergeRefreshedReviews,
  mergeReviewPagePreservingClientState,
} from '../domain/gameReviewState'
import {
  INITIAL_VISIBLE_COMMENT_COUNT,
  INITIAL_VISIBLE_REVIEW_COUNT,
  type GameReviewsController,
  type UseGameReviewsControllerOptions,
} from './gameReviewControllerContracts'
import {
  useGameReviewCommentsState,
  useGameReviewEditorState,
  useGameReviewFeedState,
  useGameReviewReactionState,
  useGameReviewReportState,
} from './useGameReviewControllerState'
import {
  getReviewErrorMessage,
  getReviewHashTargetId,
} from './reviewControllerHelpers'
import { useGameReviewReports } from './useGameReviewReports'
import { useGameReviewReactions } from './useGameReviewReactions'
import { useGameReviewEditor } from './useGameReviewEditor'
import { useGameReviewComments } from './useGameReviewComments'
import { useGameReviewFeedActions } from './useGameReviewFeedActions'

export {
  INITIAL_VISIBLE_COMMENT_COUNT,
  INITIAL_VISIBLE_REVIEW_COUNT,
  VISIBLE_COMMENT_BATCH_SIZE,
  VISIBLE_REVIEW_BATCH_SIZE,
  getInitialVisibleCommentCount,
} from './gameReviewControllerContracts'
export type {
  GameReviewReportTarget,
  GameReviewsActionsController,
  GameReviewsController,
  GameReviewsFormController,
  GameReviewsListController,
  GameReviewsOverviewController,
  GameReviewsReportController,
  GameReviewsSectionController,
  ReportModalTargetState,
  ReviewFeedbackState,
} from './gameReviewControllerContracts'

function getEmptyRatingSummary(gameId: number): GameRatingSummary {
  return {
    gameId,
    averageRating: null,
    reviewCount: 0,
  }
}

export function useGameReviewsController({
  gameId,
  currentUserId,
  locationHash,
  t,
}: UseGameReviewsControllerOptions): GameReviewsController {
  const {
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
  } = useGameReviewFeedState(gameId)
  const {
    nota,
    setNota,
    textoReview,
    setTextoReview,
    submitting,
    setSubmitting,
    reviewFeedback,
    setReviewFeedback,
  } = useGameReviewEditorState()
  const {
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
  } = useGameReviewCommentsState()
  const {
    pendingReviewReactionIds,
    setPendingReviewReactionIds,
    pendingCommentReactionIds,
    setPendingCommentReactionIds,
    deletingReviewIds,
    setDeletingReviewIds,
  } = useGameReviewReactionState()
  const {
    reportModalTarget,
    setReportModalTarget,
    reportModalFeedback,
    setReportModalFeedback,
    submittingReport,
    setSubmittingReport,
    removingReport,
    setRemovingReport,
  } = useGameReviewReportState()

  const scopeKey = `${gameId ?? 'none'}:${currentUserId ?? 'anonymous'}`
  const scopeKeyRef = useRef(scopeKey)
  const mountedRef = useRef(false)
  const reviewsRequestVersionRef = useRef(0)
  const ratingRequestVersionRef = useRef(0)
  const paginationRequestVersionRef = useRef(0)
  const anchorRequestVersionRef = useRef(0)
  const loadingMoreReviewsRef = useRef<string | null>(null)
  const loadingCommentIdsRef = useRef(new Set<string>())
  const resolvedAnchorKeyRef = useRef('')
  const anchorRequestKeyRef = useRef('')

  useLayoutEffect(() => {
    scopeKeyRef.current = scopeKey
  }, [scopeKey])

  useEffect(() => {
    const loadingCommentIds = loadingCommentIdsRef.current
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      reviewsRequestVersionRef.current += 1
      ratingRequestVersionRef.current += 1
      paginationRequestVersionRef.current += 1
      anchorRequestVersionRef.current += 1
      loadingMoreReviewsRef.current = null
      loadingCommentIds.clear()
      anchorRequestKeyRef.current = ''
    }
  }, [])

  const isScopeActive = useCallback((expectedScopeKey: string) => (
    mountedRef.current && scopeKeyRef.current === expectedScopeKey
  ), [])
  const reportController = useGameReviewReports({
    currentUserId,
    scopeKey,
    isScopeActive,
    reviews,
    setReviews,
    target: reportModalTarget,
    setTarget: setReportModalTarget,
    feedback: reportModalFeedback,
    setFeedback: setReportModalFeedback,
    submitting: submittingReport,
    setSubmitting: setSubmittingReport,
    removing: removingReport,
    setRemoving: setRemovingReport,
    t,
  })
  const commentsController = useGameReviewComments({
    currentUserId,
    gameId,
    scopeKey,
    isScopeActive,
    reviews,
    setReviews,
    commentText: comentarioTexto,
    setCommentText: setComentarioTexto,
    commentTotals: commentTotalsByReviewId,
    setCommentTotals: setCommentTotalsByReviewId,
    nextCommentOffsets: nextCommentOffsetByReviewId,
    setNextCommentOffsets: setNextCommentOffsetByReviewId,
    setVisibleCommentCounts: setVisibleCommentsByReviewId,
    setLoadingComments: setLoadingCommentsByReviewId,
    setSubmittingComments: setSubmittingComentario,
    setPendingCommentIds: setPendingCommentReactionIds,
    setReportTarget: setReportModalTarget,
    setReportFeedback: setReportModalFeedback,
    setReviewFeedback,
    setOverview: setReviewOverview,
    loadingCommentIdsRef,
    paginationRequestVersionRef,
    t,
  })

  const refreshReviews = useCallback(async (requestedGameId = gameId) => {
    if (!requestedGameId || requestedGameId !== gameId) {
      return {
        data: [] as ReviewItem[],
        error: null as ReviewError | null,
        totalCount: 0,
        hasMore: false,
        nextOffset: null,
        commentTotals: {},
      }
    }

    const expectedScopeKey = scopeKey
    const requestVersion = ++reviewsRequestVersionRef.current
    const result = await getGameReviewsPage(requestedGameId, {
      currentUserId,
      limit: Math.min(Math.max(reviews.length, INITIAL_VISIBLE_REVIEW_COUNT), 20),
      offset: 0,
      initialCommentsLimit: INITIAL_VISIBLE_COMMENT_COUNT,
    })

    if (
      !isScopeActive(expectedScopeKey) ||
      requestVersion !== reviewsRequestVersionRef.current
    ) {
      return result
    }

    setReviews(currentReviews => (
      result.error && result.data.length === 0
        ? mergeRefreshedReviews(currentReviews, result)
        : mergeReviewPagePreservingClientState(currentReviews, result.data)
    ))
    const refreshedOwnReview = result.data.find(review => review.usuario_id === currentUserId)
    if (refreshedOwnReview) setOwnReviewForForm(refreshedOwnReview)
    setTotalReviewCount(current => result.totalCount ?? Math.max(current, result.data.length))
    setNextReviewOffset(current => Math.max(current, result.nextOffset ?? result.data.length))
    setCommentTotalsByReviewId(current => ({ ...current, ...(result.commentTotals || {}) }))
    setVisibleCommentsByReviewId(current => {
      const next = { ...current }
      result.data.forEach(review => {
        next[review.id] = Math.max(next[review.id] ?? 0, review.comentarios.length)
      })
      return next
    })
    setNextCommentOffsetByReviewId(current => {
      const next = { ...current }
      result.data.forEach(review => {
        next[review.id] = Math.max(next[review.id] ?? 0, review.comentarios.length)
      })
      return next
    })

    setReviewsError(
      result.error && result.data.length === 0
        ? getReviewErrorMessage(t, result.error, 'load')
        : null
    )

    return result
  }, [
    currentUserId,
    gameId,
    isScopeActive,
    reviews.length,
    scopeKey,
    setCommentTotalsByReviewId,
    setNextCommentOffsetByReviewId,
    setNextReviewOffset,
    setOwnReviewForForm,
    setReviews,
    setReviewsError,
    setTotalReviewCount,
    setVisibleCommentsByReviewId,
    t,
  ])
  const reactionController = useGameReviewReactions({
    currentUserId,
    gameId,
    scopeKey,
    isScopeActive,
    pendingReviewIds: pendingReviewReactionIds,
    setPendingReviewIds: setPendingReviewReactionIds,
    pendingCommentIds: pendingCommentReactionIds,
    setPendingCommentIds: setPendingCommentReactionIds,
    setReviews,
    setFeedback: setReviewFeedback,
    refreshReviews,
    t,
  })

  const refreshRatingSummary = useCallback(async (requestedGameId = gameId) => {
    if (!requestedGameId || requestedGameId !== gameId) return null

    const expectedScopeKey = scopeKey
    const requestVersion = ++ratingRequestVersionRef.current
    const result = await getGameReviewOverview(requestedGameId)

    if (
      !isScopeActive(expectedScopeKey) ||
      requestVersion !== ratingRequestVersionRef.current
    ) {
      return result
    }

    if (result.error) {
      console.error(t('game.details.reviewFeedback.ratingSummaryLoadLog'), result.error)
      setRatingSummary(null)
      setReviewOverview(null)
      setReviewOverviewFallbackUsed(false)
      return result
    }

    const overview = result.data
    setReviewOverview(overview)
    setReviewOverviewFallbackUsed(Boolean(result.fallbackUsed))
    setRatingSummary(overview
      ? {
          gameId: overview.gameId,
          averageRating: overview.averageRating,
          reviewCount: overview.reviewCount,
        }
      : getEmptyRatingSummary(requestedGameId)
    )
    return result
  }, [
    gameId,
    isScopeActive,
    scopeKey,
    setRatingSummary,
    setReviewOverview,
    setReviewOverviewFallbackUsed,
    t,
  ])
  const editorController = useGameReviewEditor({
    currentUserId,
    gameId,
    scopeKey,
    isScopeActive,
    reviews,
    ownReview: ownReviewForForm,
    score: nota,
    setScore: setNota,
    text: textoReview,
    setText: setTextoReview,
    setSubmitting,
    setFeedback: setReviewFeedback,
    refreshReviews,
    refreshOverview: refreshRatingSummary,
    t,
  })
  const feedActions = useGameReviewFeedActions({
    currentUserId,
    gameId,
    scopeKey,
    isScopeActive,
    nextReviewOffset,
    totalReviewCount,
    deletingReviewIds,
    setReviews,
    setOwnReview: setOwnReviewForForm,
    setTotalReviewCount,
    setNextReviewOffset,
    setLoadingMoreReviews,
    setCommentText: setComentarioTexto,
    setSubmittingComments: setSubmittingComentario,
    setVisibleCommentCounts: setVisibleCommentsByReviewId,
    setCommentTotals: setCommentTotalsByReviewId,
    setNextCommentOffsets: setNextCommentOffsetByReviewId,
    setLoadingComments: setLoadingCommentsByReviewId,
    setPendingReviewIds: setPendingReviewReactionIds,
    setPendingCommentIds: setPendingCommentReactionIds,
    setDeletingReviewIds,
    setReportTarget: setReportModalTarget,
    setReportFeedback: setReportModalFeedback,
    setFeedback: setReviewFeedback,
    loadingMoreReviewsRef,
    paginationRequestVersionRef,
    refreshReviews,
    refreshOverview: refreshRatingSummary,
    t,
  })

  useEffect(() => {
    const expectedScopeKey = scopeKey
    const reviewsRequestVersion = ++reviewsRequestVersionRef.current
    const ratingRequestVersion = ++ratingRequestVersionRef.current

    const loadReviews = async () => {
      setReviews([])
      setOwnReviewForForm(null)
      setRatingSummary(null)
      setReviewOverview(null)
      setReviewOverviewFallbackUsed(false)
      setTotalReviewCount(0)
      setNextReviewOffset(0)
      setReviewsError(null)
      setReviewFeedback(null)
      setComentarioTexto({})
      setVisibleCommentsByReviewId({})
      setCommentTotalsByReviewId({})
      setNextCommentOffsetByReviewId({})
      setLoadingMoreReviews(false)
      setLoadingCommentsByReviewId({})
      setSubmittingComentario({})
      setPendingReviewReactionIds([])
      setPendingCommentReactionIds([])
      setDeletingReviewIds([])
      setReportModalTarget(null)
      setReportModalFeedback(null)
      setSubmitting(false)
      setSubmittingReport(false)
      setRemovingReport(false)
      loadingMoreReviewsRef.current = null
      loadingCommentIdsRef.current.clear()
      resolvedAnchorKeyRef.current = ''
      anchorRequestKeyRef.current = ''
      paginationRequestVersionRef.current += 1
      anchorRequestVersionRef.current += 1

      if (!gameId) {
        setReviewsLoading(false)
        return
      }

      setReviewsLoading(true)

      const [reviewsResult, ratingResult, ownReviewResult] = await Promise.all([
        getGameReviewsPage(gameId, {
          currentUserId,
          limit: INITIAL_VISIBLE_REVIEW_COUNT,
          offset: 0,
          initialCommentsLimit: INITIAL_VISIBLE_COMMENT_COUNT,
        }),
        getGameReviewOverview(gameId),
        currentUserId
          ? getReviewByGameAndUserId(gameId, currentUserId)
          : Promise.resolve({ data: null, error: null }),
      ])

      if (
        !isScopeActive(expectedScopeKey) ||
        reviewsRequestVersion !== reviewsRequestVersionRef.current ||
        ratingRequestVersion !== ratingRequestVersionRef.current
      ) {
        return
      }

      setReviews(reviewsResult.data)
      setOwnReviewForForm(
        reviewsResult.data.find(review => review.usuario_id === currentUserId) ||
        ownReviewResult.data
      )
      setTotalReviewCount(reviewsResult.totalCount ?? reviewsResult.data.length)
      setNextReviewOffset(reviewsResult.nextOffset ?? reviewsResult.data.length)
      setCommentTotalsByReviewId(reviewsResult.commentTotals || {})
      setVisibleCommentsByReviewId(Object.fromEntries(
        reviewsResult.data.map(review => [review.id, review.comentarios.length])
      ))
      setNextCommentOffsetByReviewId(Object.fromEntries(
        reviewsResult.data.map(review => [review.id, review.comentarios.length])
      ))
      setReviewsError(
        reviewsResult.error && reviewsResult.data.length === 0
          ? getReviewErrorMessage(t, reviewsResult.error, 'load')
          : null
      )

      if (ratingResult.error) {
        console.error(t('game.details.reviewFeedback.ratingSummaryLoadLog'), ratingResult.error)
        setRatingSummary(null)
        setReviewOverview(null)
        setReviewOverviewFallbackUsed(false)
      } else {
        setReviewOverview(ratingResult.data)
        setReviewOverviewFallbackUsed(Boolean(ratingResult.fallbackUsed))
        setRatingSummary(ratingResult.data
          ? {
              gameId: ratingResult.data.gameId,
              averageRating: ratingResult.data.averageRating,
              reviewCount: ratingResult.data.reviewCount,
            }
          : getEmptyRatingSummary(gameId)
        )
      }

      setReviewsLoading(false)
    }

    void loadReviews()
  }, [
    currentUserId,
    gameId,
    isScopeActive,
    scopeKey,
    setComentarioTexto,
    setCommentTotalsByReviewId,
    setDeletingReviewIds,
    setLoadingCommentsByReviewId,
    setLoadingMoreReviews,
    setNextCommentOffsetByReviewId,
    setNextReviewOffset,
    setOwnReviewForForm,
    setPendingCommentReactionIds,
    setPendingReviewReactionIds,
    setRatingSummary,
    setRemovingReport,
    setReportModalFeedback,
    setReportModalTarget,
    setReviewFeedback,
    setReviewOverview,
    setReviewOverviewFallbackUsed,
    setReviews,
    setReviewsError,
    setReviewsLoading,
    setSubmitting,
    setSubmittingComentario,
    setSubmittingReport,
    setTotalReviewCount,
    setVisibleCommentsByReviewId,
    t,
  ])

  const visibleReviews = reviews
  const hiddenReviewsCount = Math.max(totalReviewCount - reviews.length, 0)

  useEffect(() => {
    const targetId = getReviewHashTargetId(locationHash)
    if (!targetId || !gameId || reviewsLoading) return

    const targetReviewId = targetId.startsWith('review-')
      ? targetId.replace('review-', '')
      : null
    const targetCommentId = targetId.startsWith('comment-')
      ? targetId.replace('comment-', '')
      : null
    if (!targetReviewId && !targetCommentId) return

    const anchorKey = `${scopeKey}:${targetId}`
    const targetElement = document.getElementById(targetId)
    if (targetElement) {
      resolvedAnchorKeyRef.current = anchorKey
      const frameId = window.requestAnimationFrame(() => {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
      return () => window.cancelAnimationFrame(frameId)
    }

    if (
      resolvedAnchorKeyRef.current === anchorKey ||
      anchorRequestKeyRef.current === anchorKey
    ) return

    const expectedScopeKey = scopeKey
    const requestVersion = ++anchorRequestVersionRef.current
    anchorRequestKeyRef.current = anchorKey

    const loadAnchor = async () => {
      try {
        const anchorResult = await resolveGameReviewAnchor(gameId, {
          reviewId: targetReviewId,
          commentId: targetCommentId,
        })
        if (
          !isScopeActive(expectedScopeKey) ||
          requestVersion !== anchorRequestVersionRef.current ||
          !anchorResult.data
        ) return

        const anchor = anchorResult.data
        let anchorReview = reviews.find(review => review.id === anchor.reviewId) || null

        if (!anchorReview) {
          const reviewPage = await getGameReviewsPage(gameId, {
            currentUserId,
            limit: 1,
            offset: anchor.reviewOffset,
            initialCommentsLimit: INITIAL_VISIBLE_COMMENT_COUNT,
          })
          if (
            !isScopeActive(expectedScopeKey) ||
            requestVersion !== anchorRequestVersionRef.current
          ) return

          anchorReview = reviewPage.data.find(review => review.id === anchor.reviewId) || null
          if (anchorReview) {
            setReviews(current => mergeReviewPagePreservingClientState(current, [anchorReview!]))
            setTotalReviewCount(current => reviewPage.totalCount ?? current)
            setCommentTotalsByReviewId(current => ({
              ...current,
              ...(reviewPage.commentTotals || {}),
            }))
            setVisibleCommentsByReviewId(current => ({
              ...current,
              [anchorReview!.id]: Math.max(
                current[anchorReview!.id] ?? 0,
                anchorReview!.comentarios.length
              ),
            }))
            setNextCommentOffsetByReviewId(current => ({
              ...current,
              [anchorReview!.id]: Math.max(
                current[anchorReview!.id] ?? 0,
                anchorReview!.comentarios.length
              ),
            }))
          }
        }

        if (!anchorReview) return

        if (
          targetCommentId &&
          anchorReview &&
          !anchorReview.comentarios.some(comment => comment.id === targetCommentId) &&
          anchor.commentOffset !== null
        ) {
          const commentPage = await getReviewCommentsPage(anchor.reviewId, {
            currentUserId,
            limit: 1,
            offset: anchor.commentOffset,
          })
          if (
            !isScopeActive(expectedScopeKey) ||
            requestVersion !== anchorRequestVersionRef.current
          ) return

          if (!commentPage.data.some(comment => comment.id === targetCommentId)) return

          setReviews(current => current.map(review => (
            review.id === anchor.reviewId
              ? {
                  ...review,
                  comentarios: mergeCommentPagePreservingClientState(
                    review.comentarios,
                    commentPage.data
                  ),
                }
              : review
          )))
          setCommentTotalsByReviewId(current => ({
            ...current,
            [anchor.reviewId]: commentPage.totalCount ?? current[anchor.reviewId] ?? 0,
          }))
          setVisibleCommentsByReviewId(current => ({
            ...current,
            [anchor.reviewId]: Math.max(
              current[anchor.reviewId] ?? 0,
              (anchorReview?.comentarios.length || 0) + commentPage.data.length
            ),
          }))
        }

        resolvedAnchorKeyRef.current = anchorKey
        window.setTimeout(() => {
          window.requestAnimationFrame(() => {
            document.getElementById(targetId)?.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            })
          })
        }, 0)
      } finally {
        if (anchorRequestKeyRef.current === anchorKey) {
          anchorRequestKeyRef.current = ''
        }
      }
    }

    void loadAnchor()
  }, [
    currentUserId,
    gameId,
    isScopeActive,
    locationHash,
    reviews,
    reviewsLoading,
    scopeKey,
    setCommentTotalsByReviewId,
    setNextCommentOffsetByReviewId,
    setReviews,
    setTotalReviewCount,
    setVisibleCommentsByReviewId,
  ])

  return {
    overview: {
      reviews,
      ratingSummary,
      totalComments:
        reviewOverview && !reviewOverviewFallbackUsed
          ? reviewOverview.commentCount
          : reviews.reduce(
              (total, review) => total + (
                commentTotalsByReviewId[review.id] ?? review.comentarios.length
              ),
              0
            ),
      loading: reviewsLoading,
    },
    section: {
      form: {
        authenticated: Boolean(currentUserId),
        score: nota,
        setScore: setNota,
        text: textoReview,
        setText: setTextoReview,
        submitting,
        feedback: reviewFeedback,
        editing: Boolean(editorController.currentUserReview),
        submit: editorController.submit,
      },
      list: {
        userId: currentUserId,
        total: totalReviewCount,
        visible: visibleReviews,
        error: reviewsError,
        commentCounts: visibleCommentsByReviewId,
        commentTotals: commentTotalsByReviewId,
        commentText: comentarioTexto,
        submittingComments: submittingComentario,
        pendingReviews: pendingReviewReactionIds,
        pendingComments: pendingCommentReactionIds,
        deletingReviews: deletingReviewIds,
        loadingMoreReviews,
        loadingComments: loadingCommentsByReviewId,
        hidden: hiddenReviewsCount,
      },
      report: {
        target: reportController.activeTarget,
        feedback: reportController.feedback,
        submitting: reportController.submitting,
        removing: reportController.removing,
      },
      actions: {
        refreshReviews,
        reviewLike: reactionController.reviewLike,
        reviewDislike: reactionController.reviewDislike,
        reviewDelete: feedActions.remove,
        commentLike: reactionController.commentLike,
        commentDislike: reactionController.commentDislike,
        commentDelete: commentsController.remove,
        openReport: reportController.open,
        expandComments: commentsController.expand,
        submitComment: commentsController.submit,
        setCommentText: setComentarioTexto,
        expandReviews: feedActions.expand,
        closeReport: reportController.close,
        submitReport: reportController.submit,
        removeReport: reportController.remove,
      },
    },
  }
}
