import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { GameCoverImage } from '../components/GameCoverImage'
import { ContentReportModal } from '../components/reviews/ContentReportModal'
import { useAuth } from '../contexts/AuthContext'
import { GameReviewCard } from '../features/reviews/components/GameReviewCard'
import {
  createReviewComment,
  deleteReviewComment,
  deleteReview,
  getGameRatingSummaries,
  getReviewsByGameId,
  saveReview,
  sortCommentsByRelevance,
  sortReviewsByRelevance,
  toggleReviewLike,
  type ReviewComment,
  type ReviewError,
  type GameRatingSummary,
  type ReviewItem,
} from '../services/reviewService'
import {
  deleteContentReport,
  toggleCommentLike,
  submitContentReport,
  toggleCommentDislike,
  toggleReviewDislike,
  type CommentReactionState,
  type CurrentUserReportSummary,
  type ReportReason,
  type ReportTargetType,
  type ReviewReactionState,
} from '../services/reviewInteractionsService'
import {
  STATUS_VALUES,
  deleteGameStatus,
  getGameStatusEntry,
  saveGameStatus,
  type GameStatusEntry,
  type GameStatusError,
  type GameStatusValue,
} from '../services/gameStatusService'
import {
  addGameToWishlist,
  deleteWishlistEntry,
  getWishlistEntry,
} from '../services/wishlistService'
import {
  getCatalogGameDetailsById,
  type CatalogGameDetails,
} from '../services/gameCatalogService'
import { formatLocalizedDate, translate } from '../i18n'
import { useI18n } from '../i18n/I18nContext'
import {
  isSupabaseDuplicateError,
  isSupabasePermissionError,
  isSupabaseStructureError,
} from '../utils/supabaseErrors'
import './GameDetailsPage.css'

type FeedbackTone = 'success' | 'error' | 'info'

interface FeedbackState {
  tone: FeedbackTone
  message: string
}

interface ReportModalTargetState {
  targetType: ReportTargetType
  targetId: string
  reviewId: string
}

type QuickProfileStatusValue = GameStatusValue

const REVIEW_SCORE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const INITIAL_VISIBLE_REVIEW_COUNT = 3
const VISIBLE_REVIEW_BATCH_SIZE = 4
const INITIAL_VISIBLE_COMMENT_COUNT = 2
const VISIBLE_COMMENT_BATCH_SIZE = 4
const QUICK_PROFILE_STATUS_OPTIONS: Array<{
  value: QuickProfileStatusValue
  labelKey: string
}> = STATUS_VALUES.map(value => ({
  value,
  labelKey: `game.status.${value}`,
}))

function normalizeList(value: string[] | string | null | undefined) {
  if (!value) return []
  return Array.isArray(value) ? value.filter(Boolean) : [value]
}

function formatList(value: string[] | string | null | undefined, fallback: string) {
  const items = normalizeList(value)
  return items.length > 0 ? items.join(', ') : fallback
}

function formatDate(value: string | null | undefined, fallback?: string) {
  return formatLocalizedDate(value, { fallback })
}

function getInitialVisibleCommentCount(totalComments: number) {
  if (totalComments <= INITIAL_VISIBLE_COMMENT_COUNT) {
    return totalComments
  }

  return INITIAL_VISIBLE_COMMENT_COUNT
}

function getInitialVisibleReviewCount(totalReviews: number) {
  if (totalReviews <= INITIAL_VISIBLE_REVIEW_COUNT) {
    return totalReviews
  }

  return INITIAL_VISIBLE_REVIEW_COUNT
}

function getEmptyRatingSummary(gameId: number): GameRatingSummary {
  return {
    gameId,
    averageRating: null,
    reviewCount: 0,
  }
}

function clampVisibleCommentCount(visibleComments: number, totalComments: number) {
  return Math.max(0, Math.min(visibleComments, totalComments))
}

function clampVisibleReviewCount(visibleReviews: number, totalReviews: number) {
  return Math.max(0, Math.min(visibleReviews, totalReviews))
}

function getWishlistErrorMessage(
  error: {
    code?: string
    message: string
    details?: string | null
    hint?: string | null
  } | null,
  action: 'save' | 'delete' = 'save'
) {
  if (!error) {
    return action === 'save'
      ? 'Nao foi possivel salvar este jogo na sua lista de desejos agora.'
      : 'Nao foi possivel remover este jogo da sua lista de desejos agora.'
  }

  if (isSupabasePermissionError(error)) {
    return action === 'save'
      ? 'Nao foi possivel acessar sua lista de desejos por permissao. Verifique as policies da tabela lista_desejos no Supabase.'
      : 'Nao foi possivel remover este jogo da sua lista de desejos por permissao. Verifique as policies DELETE da tabela lista_desejos no Supabase.'
  }

  if (isSupabaseDuplicateError(error)) {
    return 'Esse jogo já está na sua lista de desejos.'
  }

  if (isSupabaseStructureError(error)) {
    return 'A estrutura da tabela lista_desejos nao corresponde ao frontend.'
  }

  return action === 'save'
    ? 'Nao foi possivel salvar este jogo na sua lista de desejos agora.'
    : 'Nao foi possivel remover este jogo da sua lista de desejos agora.'
}

function getGameStatusErrorMessage(
  error: GameStatusError | null,
  action: 'save' | 'delete' = 'save'
) {
  if (!error) {
    return action === 'save'
      ? 'Nao foi possivel salvar este jogo no seu perfil agora.'
      : 'Nao foi possivel remover este jogo do seu perfil agora.'
  }

  if (isSupabasePermissionError(error)) {
    return action === 'save'
      ? 'Nao foi possivel salvar este jogo no perfil por permissao. Verifique as policies da tabela status_jogo no Supabase.'
      : 'Nao foi possivel remover este jogo do perfil por permissao. Verifique as policies DELETE da tabela status_jogo no Supabase.'
  }

  if (isSupabaseStructureError(error)) {
    return 'A estrutura da tabela status_jogo nao corresponde ao frontend.'
  }

  return action === 'save'
    ? 'Nao foi possivel salvar este jogo no seu perfil agora.'
    : 'Nao foi possivel remover este jogo do seu perfil agora.'
}

function getReviewErrorMessage(
  error: ReviewError | null,
  action:
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
) {
  if (!error) {
    if (action === 'save') return 'Nao foi possivel salvar sua review agora.'
    if (action === 'comment') return 'Nao foi possivel publicar seu comentario agora.'
    if (action === 'comment_delete') return 'Nao foi possivel apagar este comentario agora.'
    if (action === 'review_like') return 'Nao foi possivel atualizar a curtida desta review agora.'
    if (action === 'comment_like') return 'Nao foi possivel atualizar a curtida deste comentario agora.'
    if (action === 'review_dislike') {
      return 'Nao foi possivel atualizar o "Não gostei" desta review agora.'
    }
    if (action === 'comment_dislike') {
      return 'Nao foi possivel atualizar o "Não gostei" deste comentario agora.'
    }
    if (action === 'report') return 'Nao foi possivel registrar está denuncia agora.'
    if (action === 'report_delete') return 'Nao foi possivel remover está denuncia agora.'
    if (action === 'delete') return 'Nao foi possivel apagar está review agora.'
    return 'Nao foi possivel carregar as reviews deste jogo agora.'
  }

  if (isSupabasePermissionError(error)) {
    if (action === 'save') {
      return 'Nao foi possivel salvar sua review por permissao. Verifique as policies da tabela avaliacoes no Supabase.'
    }

    if (action === 'comment') {
      return 'Nao foi possivel publicar seu comentario por permissao. Verifique as policies da tabela comentarios no Supabase.'
    }

    if (action === 'comment_delete') {
      return 'Nao foi possivel apagar este comentario por permissao. Verifique as policies DELETE da tabela comentarios no Supabase.'
    }

    if (action === 'review_like') {
      return 'Nao foi possivel atualizar está curtida por permissao. Verifique as policies da tabela avaliacao_curtidas no Supabase.'
    }

    if (action === 'comment_like') {
      return 'Nao foi possivel atualizar está curtida por permissao. Verifique as policies da tabela comentario_curtidas no Supabase.'
    }

    if (action === 'review_dislike') {
      return 'Nao foi possivel atualizar este "Não gostei" por permissao. Verifique as policies da tabela avaliacao_deslikes no Supabase.'
    }

    if (action === 'comment_dislike') {
      return 'Nao foi possivel atualizar este "Não gostei" por permissao. Verifique as policies da tabela comentario_deslikes no Supabase.'
    }

    if (action === 'report') {
      return 'Nao foi possivel registrar está denuncia por permissao. Verifique as policies da tabela denuncias_conteudo no Supabase.'
    }

    if (action === 'report_delete') {
      return 'Nao foi possivel remover está denuncia por permissao. Verifique as policies DELETE da tabela denuncias_conteudo no Supabase.'
    }

    if (action === 'delete') {
      return 'Nao foi possivel apagar está review por permissao. Verifique as policies DELETE da tabela avaliacoes no Supabase.'
    }

    return 'Nao foi possivel carregar as reviews por permissao. Verifique as policies das tabelas avaliacoes, comentarios, avaliacao_curtidas, comentario_curtidas, avaliacao_deslikes, comentario_deslikes e denuncias_conteudo no Supabase.'
  }

  if (isSupabaseDuplicateError(error)) {
    if (action === 'review_like') {
      return 'Essa review já estava curtida por este usuario.'
    }

    if (action === 'comment_like') {
      return 'Esse comentario já estava curtido por este usuario.'
    }

    if (action === 'review_dislike' || action === 'comment_dislike') {
      return 'Esse "Não gostei" já estava registrado por este usuario.'
    }

    if (action === 'report') {
      return 'Você já denunciou este conteudo anteriormente.'
    }

    return 'Ja existe uma review sua para este jogo. Envie novamente para atualizar a avaliacao.'
  }

  if (isSupabaseStructureError(error)) {
    return 'A estrutura das tabelas de reviews nao corresponde ao frontend.'
  }

  return error.message
}

function getGameStatusLabel(status: GameStatusValue | null | undefined) {
  if (status === 'zerado') return translate('game.status.zerado')
  if (status === 'dropado') return translate('game.status.dropado')
  if (status === 'planejando') return translate('game.status.planejando')
  if (status === 'pausado') return translate('game.status.pausado')
  return translate('game.status.jogando')
}

function getUserName(usuario: { username?: string | null } | null | undefined) {
  const username = usuario?.username?.trim()
  return username || translate('common.username')
}

function getInitial(name: string) {
  const firstCharacter = name.trim().charAt(0)
  return firstCharacter ? firstCharacter.toUpperCase() : 'U'
}

function GameDetailsPage() {
  const { id } = useParams()
  const location = useLocation()
  const { user } = useAuth()
  const { t, formatNumber } = useI18n()

  const [game, setGame] = useState<CatalogGameDetails | null>(null)
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [ratingSummary, setRatingSummary] = useState<GameRatingSummary | null>(null)
  const [visibleReviewCount, setVisibleReviewCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [reviewsError, setReviewsError] = useState<string | null>(null)
  const [nota, setNota] = useState(5)
  const [textoReview, setTextoReview] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reviewFeedback, setReviewFeedback] = useState<FeedbackState | null>(null)
  const [comentarioTexto, setComentarioTexto] = useState<Record<string, string>>({})
  const [visibleCommentsByReviewId, setVisibleCommentsByReviewId] = useState<Record<string, number>>({})
  const [submittingComentario, setSubmittingComentario] = useState<Record<string, boolean>>({})
  const [pendingReviewReactionIds, setPendingReviewReactionIds] = useState<string[]>([])
  const [pendingCommentReactionIds, setPendingCommentReactionIds] = useState<string[]>([])
  const [deletingReviewIds, setDeletingReviewIds] = useState<string[]>([])
  const [reportModalTarget, setReportModalTarget] = useState<ReportModalTargetState | null>(null)
  const [reportModalFeedback, setReportModalFeedback] = useState<FeedbackState | null>(null)
  const [submittingReport, setSubmittingReport] = useState(false)
  const [removingReport, setRemovingReport] = useState(false)
  const [wishlistLoading, setWishlistLoading] = useState(false)
  const [wishlistSaving, setWishlistSaving] = useState(false)
  const [isInWishlist, setIsInWishlist] = useState(false)
  const [wishlistEntryId, setWishlistEntryId] = useState<string | null>(null)
  const [wishlistFeedback, setWishlistFeedback] = useState<FeedbackState | null>(null)
  const [gameStatusLoading, setGameStatusLoading] = useState(false)
  const [gameStatusSaving, setGameStatusSaving] = useState(false)
  const [pendingGameStatus, setPendingGameStatus] = useState<QuickProfileStatusValue | null>(null)
  const [gameStatusEntry, setGameStatusEntry] = useState<GameStatusEntry | null>(null)
  const [gameStatusFeedback, setGameStatusFeedback] = useState<FeedbackState | null>(null)

  const refreshReviews = useCallback(
    async (gameId: number) => {
      const result = await getReviewsByGameId(gameId, user?.id)

      setReviews(currentReviews => {
        if (result.error && result.data.length === 0) {
          return currentReviews
        }

        if (result.error && result.data.length > 0) {
          const currentReviewStateById = new Map(currentReviews.map(review => [review.id, review]))

          return sortReviewsByRelevance(result.data.map(review => {
            const currentReview = currentReviewStateById.get(review.id)

            if (!currentReview) {
              return review
            }

            const currentCommentStateById = new Map(
              currentReview.comentarios.map(comment => [comment.id, comment])
            )

            return {
              ...review,
              curtidas: currentReview.curtidas,
              likedByCurrentUser: currentReview.likedByCurrentUser,
              dislikes: currentReview.dislikes,
              dislikedByCurrentUser: currentReview.dislikedByCurrentUser,
              currentUserReport: currentReview.currentUserReport,
              comentarios: sortCommentsByRelevance(review.comentarios.map(comment => {
                const currentComment = currentCommentStateById.get(comment.id)

                if (!currentComment) {
                  return comment
                }

                return {
                  ...comment,
                  curtidas: currentComment.curtidas,
                  likedByCurrentUser: currentComment.likedByCurrentUser,
                  dislikes: currentComment.dislikes,
                  dislikedByCurrentUser: currentComment.dislikedByCurrentUser,
                  currentUserReport: currentComment.currentUserReport,
                }
              })),
            }
          }))
        }

        return result.data
      })

      if (!(result.error && result.data.length === 0)) {
        setVisibleReviewCount(currentVisibleReviewCount => {
          if (currentVisibleReviewCount === 0) {
            return getInitialVisibleReviewCount(result.data.length)
          }

          return clampVisibleReviewCount(currentVisibleReviewCount, result.data.length)
        })
      }

      if (result.error && result.data.length === 0) {
        setReviewsError(getReviewErrorMessage(result.error, 'load'))
      } else {
        setReviewsError(null)
      }

      return result
    },
    [user?.id]
  )

  const refreshRatingSummary = useCallback(async (gameId: number) => {
    const result = await getGameRatingSummaries([gameId])

    if (result.error) {
      console.error('Erro ao buscar media do jogo:', result.error)
      setRatingSummary(null)
      return result
    }

    const nextSummary = result.data.find(summary => summary.gameId === gameId) || getEmptyRatingSummary(gameId)

    setRatingSummary(nextSummary)

    return result
  }, [])

  const applyReviewReactionState = useCallback(
    (reviewId: string, nextReactionState: ReviewReactionState) => {
      setReviews(currentReviews =>
        sortReviewsByRelevance(currentReviews.map(currentReview =>
          currentReview.id === reviewId
            ? {
                ...currentReview,
                curtidas: nextReactionState.curtidas,
                likedByCurrentUser: nextReactionState.likedByCurrentUser,
                dislikes: nextReactionState.dislikes,
                dislikedByCurrentUser: nextReactionState.dislikedByCurrentUser,
              }
            : currentReview
        ))
      )
    },
    []
  )

  const applyCommentReactionState = useCallback(
    (reviewId: string, commentId: string, nextReactionState: CommentReactionState) => {
      setReviews(currentReviews =>
        currentReviews.map(currentReview =>
          currentReview.id === reviewId
            ? {
                ...currentReview,
                comentarios: sortCommentsByRelevance(
                  currentReview.comentarios.map(currentComment =>
                    currentComment.id === commentId
                      ? {
                          ...currentComment,
                          curtidas: nextReactionState.curtidas,
                          likedByCurrentUser: nextReactionState.likedByCurrentUser,
                          dislikes: nextReactionState.dislikes,
                          dislikedByCurrentUser: nextReactionState.dislikedByCurrentUser,
                        }
                      : currentComment
                  )
                ),
              }
            : currentReview
        )
      )
    },
    []
  )

  const applyContentReportState = useCallback(
    (
      reviewId: string,
      targetType: ReportTargetType,
      targetId: string,
      nextReport: CurrentUserReportSummary | null
    ) => {
      setReviews(currentReviews =>
        currentReviews.map(currentReview => {
          if (currentReview.id !== reviewId) {
            return currentReview
          }

          if (targetType === 'review') {
            return {
              ...currentReview,
              currentUserReport: nextReport,
            }
          }

          return {
            ...currentReview,
            comentarios: currentReview.comentarios.map(currentComment =>
              currentComment.id === targetId
                ? {
                    ...currentComment,
                    currentUserReport: nextReport,
                  }
                : currentComment
            ),
          }
        })
      )
    },
    []
  )

  useEffect(() => {
    let isMounted = true
    const gameId = Number(id)

    const fetchPageData = async () => {
        if (!id || Number.isNaN(gameId)) {
          if (isMounted) {
            setGame(null)
            setReviews([])
            setRatingSummary(null)
            setVisibleReviewCount(0)
            setReviewsError(null)
            setLoading(false)
          }
        return
      }

      setLoading(true)

      const [gameResult, reviewsResult, ratingSummaryResult] = await Promise.all([
        getCatalogGameDetailsById(gameId),
        getReviewsByGameId(gameId, user?.id),
        getGameRatingSummaries([gameId]),
      ])

      if (!isMounted) return

      if (gameResult.error) {
        console.error('Erro ao buscar jogo:', gameResult.error)
        setGame(null)
      } else {
        setGame(gameResult.data)
      }

      setReviews(reviewsResult.data)

      if (ratingSummaryResult.error) {
        console.error('Erro ao buscar media do jogo:', ratingSummaryResult.error)
        setRatingSummary(null)
      } else {
        setRatingSummary(
          ratingSummaryResult.data.find(summary => summary.gameId === gameId) ||
            getEmptyRatingSummary(gameId)
        )
      }
      setVisibleReviewCount(getInitialVisibleReviewCount(reviewsResult.data.length))
      setReviewsError(
        reviewsResult.error && reviewsResult.data.length === 0
          ? getReviewErrorMessage(reviewsResult.error, 'load')
          : null
      )
      setLoading(false)
    }

    void fetchPageData()

    return () => {
      isMounted = false
    }
  }, [id, user?.id])

  useEffect(() => {
    let isMounted = true

    const loadWishlistStatus = async () => {
      if (!user || !game) {
        if (isMounted) {
          setWishlistLoading(false)
          setIsInWishlist(false)
          setWishlistEntryId(null)
          setWishlistFeedback(null)
        }
        return
      }

      setWishlistLoading(true)
      setWishlistFeedback(null)

      const { data, error } = await getWishlistEntry(user.id, game.id)

      if (!isMounted) return

      if (error) {
        console.error('Erro ao verificar wishlist do jogo:', error)
        setWishlistFeedback({
          tone: 'error',
          message: 'Nao foi possivel verificar sua lista de desejos agora.',
        })
        setIsInWishlist(false)
        setWishlistEntryId(null)
      } else {
        setIsInWishlist(Boolean(data))
        setWishlistEntryId(data?.id || null)
      }

      setWishlistLoading(false)
    }

    void loadWishlistStatus()

    return () => {
      isMounted = false
    }
  }, [game, user])

  useEffect(() => {
    let isMounted = true

    const loadGameStatus = async () => {
      if (!user || !game) {
        if (isMounted) {
          setGameStatusLoading(false)
          setGameStatusEntry(null)
          setGameStatusFeedback(null)
        }
        return
      }

      setGameStatusLoading(true)
      setGameStatusFeedback(null)

      const { data, error } = await getGameStatusEntry(user.id, game.id)

      if (!isMounted) return

      if (error) {
        console.error('Erro ao verificar status do jogo no perfil:', error)
        setGameStatusEntry(null)
        setGameStatusFeedback({
          tone: 'error',
          message: 'Nao foi possivel verificar o status deste jogo no seu perfil agora.',
        })
      } else {
        setGameStatusEntry(data)
      }

      setGameStatusLoading(false)
    }

    void loadGameStatus()

    return () => {
      isMounted = false
    }
  }, [game, user])

  const effectiveVisibleReviewCount =
    visibleReviewCount > 0 || reviews.length === 0
      ? clampVisibleReviewCount(visibleReviewCount, reviews.length)
      : getInitialVisibleReviewCount(reviews.length)
  const visibleReviews = reviews.slice(0, effectiveVisibleReviewCount)
  const hiddenReviewsCount = Math.max(reviews.length - visibleReviews.length, 0)

  useEffect(() => {
    if (!location.hash || reviews.length === 0) return

    const targetId = decodeURIComponent(location.hash.slice(1))
    if (!targetId) return

    let expanded = false
    let nextVisibleReviewCount: number | null = null
    let nextVisibleCommentCount: { reviewId: string; count: number } | null = null

    if (targetId.startsWith('review-')) {
      const reviewId = targetId.replace('review-', '')
      const reviewIndex = reviews.findIndex(review => review.id === reviewId)

      if (reviewIndex >= effectiveVisibleReviewCount && reviewIndex >= 0) {
        nextVisibleReviewCount = reviewIndex + 1
        expanded = true
      }
    }

    if (targetId.startsWith('comment-')) {
      const commentId = targetId.replace('comment-', '')
      const reviewIndex = reviews.findIndex(review =>
        review.comentarios.some(comment => comment.id === commentId)
      )
      const parentReview = reviewIndex >= 0 ? reviews[reviewIndex] : null

      if (parentReview && reviewIndex >= effectiveVisibleReviewCount) {
        nextVisibleReviewCount = Math.max(nextVisibleReviewCount ?? 0, reviewIndex + 1)
        expanded = true
      }

      if (parentReview) {
        const commentIndex = parentReview.comentarios.findIndex(comment => comment.id === commentId)
        const visibleCommentCount =
          visibleCommentsByReviewId[parentReview.id] ??
          getInitialVisibleCommentCount(parentReview.comentarios.length)

        if (commentIndex >= visibleCommentCount && commentIndex >= 0) {
          nextVisibleCommentCount = { reviewId: parentReview.id, count: commentIndex + 1 }
          expanded = true
        }
      }
    }

    if (expanded) {
      const timeoutId = window.setTimeout(() => {
        if (nextVisibleReviewCount !== null) {
          setVisibleReviewCount(currentCount => Math.max(currentCount, nextVisibleReviewCount))
        }

        if (nextVisibleCommentCount) {
          setVisibleCommentsByReviewId(currentVisibleComments => {
            const currentCount = currentVisibleComments[nextVisibleCommentCount.reviewId] ?? 0
            if (currentCount >= nextVisibleCommentCount.count) return currentVisibleComments

            return {
              ...currentVisibleComments,
              [nextVisibleCommentCount.reviewId]: nextVisibleCommentCount.count,
            }
          })
        }
      }, 0)

      return () => window.clearTimeout(timeoutId)
    }

    const frameId = window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [effectiveVisibleReviewCount, location.hash, reviews, visibleCommentsByReviewId])

  const currentUserReview = useMemo(() => {
    if (!user) return null
    return reviews.find(review => review.usuario_id === user.id) || null
  }, [reviews, user])

  const activeReportTarget = useMemo(() => {
    if (!reportModalTarget) return null

    if (reportModalTarget.targetType === 'review') {
      const review = reviews.find(currentReview => currentReview.id === reportModalTarget.targetId)

      if (!review) return null

      return {
        targetType: 'review' as const,
        targetId: review.id,
        reviewId: review.id,
        authorId: review.usuario_id,
        authorName: getUserName(review.usuario),
        currentReport: review.currentUserReport,
      }
    }

    const parentReview = reviews.find(currentReview => currentReview.id === reportModalTarget.reviewId)
    const comment = parentReview?.comentarios.find(
      currentComment => currentComment.id === reportModalTarget.targetId
    )

    if (!parentReview || !comment) return null

    return {
      targetType: 'comment' as const,
      targetId: comment.id,
      reviewId: parentReview.id,
      authorId: comment.usuario_id,
      authorName: getUserName(comment.usuario),
      currentReport: comment.currentUserReport,
    }
  }, [reportModalTarget, reviews])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setReviewFeedback(null)

      if (!user || !game) {
        setNota(5)
        setTextoReview('')
        return
      }

      if (currentUserReview) {
        setNota(currentUserReview.nota)
        setTextoReview(currentUserReview.texto_review || '')
        return
      }

      setNota(5)
      setTextoReview('')
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [currentUserReview, game, user])

  const handleSubmitAvaliacao = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !game) return

    setSubmitting(true)
    setReviewFeedback(null)

    const saveResult = await saveReview({
      userId: user.id,
      gameId: game.id,
      nota,
      textoReview,
    })

    if (saveResult.error) {
      setReviewFeedback({
        tone: 'error',
        message: getReviewErrorMessage(saveResult.error, 'save'),
      })
      setSubmitting(false)
      return
    }

    const [refreshResult] = await Promise.all([
      refreshReviews(game.id),
      refreshRatingSummary(game.id),
    ])

    if (refreshResult.error && refreshResult.data.length === 0) {
      setReviewFeedback({
        tone: 'info',
        message: 'Sua review foi salva, mas nao foi possivel atualizar a lista agora.',
      })
    } else {
      setReviewFeedback({
        tone: 'success',
        message:
          saveResult.status === 'updated'
            ? 'Sua review foi atualizada com sucesso.'
            : 'Sua review foi publicada com sucesso.',
      })
    }

    setSubmitting(false)
  }

  const handleSubmitComentario = async (reviewId: string, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !game) return

    const texto = comentarioTexto[reviewId]?.trim()
    if (!texto) return

    setSubmittingComentario(prevState => ({ ...prevState, [reviewId]: true }))
    setReviewFeedback(null)

    const commentResult = await createReviewComment({
      userId: user.id,
      reviewId,
      texto,
    })

    if (commentResult.error) {
      setReviewFeedback({
        tone: 'error',
        message: getReviewErrorMessage(commentResult.error, 'comment'),
      })
      setSubmittingComentario(prevState => ({ ...prevState, [reviewId]: false }))
      return
    }

    setComentarioTexto(prevState => ({ ...prevState, [reviewId]: '' }))

    const refreshResult = await refreshReviews(game.id)

    const updatedReview = refreshResult.data.find(review => review.id === reviewId)

    if (updatedReview) {
      setVisibleCommentsByReviewId(currentVisibleComments => ({
        ...currentVisibleComments,
        [reviewId]: updatedReview.comentarios.length,
      }))
    }

    if (refreshResult.error && refreshResult.data.length === 0) {
      setReviewFeedback({
        tone: 'info',
        message: 'Seu comentario foi publicado, mas nao foi possivel atualizar a lista agora.',
      })
    }

    setSubmittingComentario(prevState => ({ ...prevState, [reviewId]: false }))
  }

  const handleToggleReviewLike = async (review: ReviewItem) => {
    if (!user || !game || !review.canLike || pendingReviewReactionIds.includes(review.id)) return

    const wasLiked = review.likedByCurrentUser
    const previousReactionState: ReviewReactionState = {
      curtidas: review.curtidas,
      likedByCurrentUser: review.likedByCurrentUser,
      dislikes: review.dislikes,
      dislikedByCurrentUser: review.dislikedByCurrentUser,
    }
    const optimisticReactionState: ReviewReactionState = {
      curtidas: Math.max(review.curtidas + (wasLiked ? -1 : 1), 0),
      likedByCurrentUser: !wasLiked,
      dislikes: Math.max(review.dislikes - (review.dislikedByCurrentUser && !wasLiked ? 1 : 0), 0),
      dislikedByCurrentUser: false,
    }

    setPendingReviewReactionIds(currentIds =>
      currentIds.includes(review.id) ? currentIds : [...currentIds, review.id]
    )
    setReviewFeedback(null)
    applyReviewReactionState(review.id, optimisticReactionState)

    const likeResult = await toggleReviewLike({
      reviewId: review.id,
      userId: user.id,
      reviewAuthorId: review.usuario_id,
      likedByCurrentUser: wasLiked,
      dislikedByCurrentUser: review.dislikedByCurrentUser,
      currentLikeCount: review.curtidas,
      currentDislikeCount: review.dislikes,
    })

    if (likeResult.error) {
      applyReviewReactionState(review.id, previousReactionState)
      setReviewFeedback({
        tone: 'error',
        message: getReviewErrorMessage(likeResult.error, 'review_like'),
      })
      setPendingReviewReactionIds(currentIds => currentIds.filter(currentId => currentId !== review.id))
      return
    }

    if (likeResult.data) {
      applyReviewReactionState(review.id, likeResult.data)
    }

    const refreshResult = await refreshReviews(game.id)

    if (refreshResult.error && refreshResult.data.length === 0) {
      setReviewFeedback({
        tone: 'info',
        message: 'A curtida foi atualizada, mas nao foi possivel recarregar a lista agora.',
      })
    }

    setPendingReviewReactionIds(currentIds => currentIds.filter(currentId => currentId !== review.id))
  }

  const handleToggleReviewDislike = async (review: ReviewItem) => {
    if (!user || !game || !review.canDislike || pendingReviewReactionIds.includes(review.id)) return

    const wasDisliked = review.dislikedByCurrentUser
    const previousReactionState: ReviewReactionState = {
      curtidas: review.curtidas,
      likedByCurrentUser: review.likedByCurrentUser,
      dislikes: review.dislikes,
      dislikedByCurrentUser: review.dislikedByCurrentUser,
    }
    const optimisticReactionState: ReviewReactionState = {
      curtidas: Math.max(review.curtidas - (review.likedByCurrentUser && !wasDisliked ? 1 : 0), 0),
      likedByCurrentUser: false,
      dislikes: Math.max(review.dislikes + (wasDisliked ? -1 : 1), 0),
      dislikedByCurrentUser: !wasDisliked,
    }

    setPendingReviewReactionIds(currentIds =>
      currentIds.includes(review.id) ? currentIds : [...currentIds, review.id]
    )
    setReviewFeedback(null)
    applyReviewReactionState(review.id, optimisticReactionState)

    const dislikeResult = await toggleReviewDislike({
      reviewId: review.id,
      userId: user.id,
      reviewAuthorId: review.usuario_id,
      likedByCurrentUser: review.likedByCurrentUser,
      dislikedByCurrentUser: wasDisliked,
      currentLikeCount: review.curtidas,
      currentDislikeCount: review.dislikes,
    })

    if (dislikeResult.error) {
      applyReviewReactionState(review.id, previousReactionState)
      setReviewFeedback({
        tone: 'error',
        message: getReviewErrorMessage(dislikeResult.error, 'review_dislike'),
      })
      setPendingReviewReactionIds(currentIds => currentIds.filter(currentId => currentId !== review.id))
      return
    }

    if (dislikeResult.data) {
      applyReviewReactionState(review.id, dislikeResult.data)
    }

    const refreshResult = await refreshReviews(game.id)

    if (refreshResult.error && refreshResult.data.length === 0) {
      setReviewFeedback({
        tone: 'info',
        message: 'O "Não gostei" foi atualizado, mas nao foi possivel recarregar a lista agora.',
      })
    }

    setPendingReviewReactionIds(currentIds => currentIds.filter(currentId => currentId !== review.id))
  }

  const handleToggleCommentLike = async (reviewId: string, comment: ReviewComment) => {
    if (!user || pendingCommentReactionIds.includes(comment.id) || !comment.canLike) return

    const wasLiked = comment.likedByCurrentUser
    const previousReactionState: CommentReactionState = {
      curtidas: comment.curtidas,
      likedByCurrentUser: comment.likedByCurrentUser,
      dislikes: comment.dislikes,
      dislikedByCurrentUser: comment.dislikedByCurrentUser,
    }
    const optimisticReactionState: CommentReactionState = {
      curtidas: Math.max(comment.curtidas + (wasLiked ? -1 : 1), 0),
      likedByCurrentUser: !wasLiked,
      dislikes: Math.max(comment.dislikes - (comment.dislikedByCurrentUser && !wasLiked ? 1 : 0), 0),
      dislikedByCurrentUser: false,
    }

    setPendingCommentReactionIds(currentIds =>
      currentIds.includes(comment.id) ? currentIds : [...currentIds, comment.id]
    )
    setReviewFeedback(null)
    applyCommentReactionState(reviewId, comment.id, optimisticReactionState)

    const likeResult = await toggleCommentLike({
      commentId: comment.id,
      userId: user.id,
      commentAuthorId: comment.usuario_id,
      likedByCurrentUser: wasLiked,
      dislikedByCurrentUser: comment.dislikedByCurrentUser,
      currentLikeCount: comment.curtidas,
      currentDislikeCount: comment.dislikes,
    })

    if (likeResult.error) {
      applyCommentReactionState(reviewId, comment.id, previousReactionState)
      setReviewFeedback({
        tone: 'error',
        message: getReviewErrorMessage(likeResult.error, 'comment_like'),
      })
      setPendingCommentReactionIds(currentIds => currentIds.filter(currentId => currentId !== comment.id))
      return
    }

    if (likeResult.data) {
      applyCommentReactionState(reviewId, comment.id, likeResult.data)
    }

    setPendingCommentReactionIds(currentIds => currentIds.filter(currentId => currentId !== comment.id))
  }

  const handleToggleCommentDislike = async (reviewId: string, comment: ReviewComment) => {
    if (!user || pendingCommentReactionIds.includes(comment.id) || !comment.canDislike) return

    const wasDisliked = comment.dislikedByCurrentUser
    const previousReactionState: CommentReactionState = {
      curtidas: comment.curtidas,
      likedByCurrentUser: comment.likedByCurrentUser,
      dislikes: comment.dislikes,
      dislikedByCurrentUser: comment.dislikedByCurrentUser,
    }
    const optimisticReactionState: CommentReactionState = {
      curtidas: Math.max(comment.curtidas - (comment.likedByCurrentUser && !wasDisliked ? 1 : 0), 0),
      likedByCurrentUser: false,
      dislikes: Math.max(comment.dislikes + (wasDisliked ? -1 : 1), 0),
      dislikedByCurrentUser: !wasDisliked,
    }

    setPendingCommentReactionIds(currentIds =>
      currentIds.includes(comment.id) ? currentIds : [...currentIds, comment.id]
    )
    setReviewFeedback(null)
    applyCommentReactionState(reviewId, comment.id, optimisticReactionState)

    const dislikeResult = await toggleCommentDislike({
      commentId: comment.id,
      userId: user.id,
      commentAuthorId: comment.usuario_id,
      likedByCurrentUser: comment.likedByCurrentUser,
      dislikedByCurrentUser: wasDisliked,
      currentLikeCount: comment.curtidas,
      currentDislikeCount: comment.dislikes,
    })

    if (dislikeResult.error) {
      applyCommentReactionState(reviewId, comment.id, previousReactionState)
      setReviewFeedback({
        tone: 'error',
        message: getReviewErrorMessage(dislikeResult.error, 'comment_dislike'),
      })
      setPendingCommentReactionIds(currentIds => currentIds.filter(currentId => currentId !== comment.id))
      return
    }

    if (dislikeResult.data) {
      applyCommentReactionState(reviewId, comment.id, dislikeResult.data)
    }

    setPendingCommentReactionIds(currentIds => currentIds.filter(currentId => currentId !== comment.id))
  }

  const handleOpenReportModal = (
    targetType: ReportTargetType,
    targetId: string,
    reviewId: string
  ) => {
    setReportModalTarget({
      targetType,
      targetId,
      reviewId,
    })
    setReportModalFeedback(null)
  }

  const handleCloseReportModal = () => {
    if (submittingReport || removingReport) return

    setReportModalTarget(null)
    setReportModalFeedback(null)
  }

  const handleSubmitReport = async ({
    reason,
    description,
  }: {
    reason: ReportReason
    description: string
  }) => {
    if (!user || !activeReportTarget) return

    setSubmittingReport(true)
    setReportModalFeedback(null)

    const reportResult = await submitContentReport({
      userId: user.id,
      targetType: activeReportTarget.targetType,
      targetId: activeReportTarget.targetId,
      targetAuthorId: activeReportTarget.authorId,
      reason,
      description,
    })

    if (reportResult.error) {
      setReportModalFeedback({
        tone: 'error',
        message: getReviewErrorMessage(reportResult.error, 'report'),
      })
      setSubmittingReport(false)
      return
    }

    if (reportResult.data) {
      applyContentReportState(
        activeReportTarget.reviewId,
        activeReportTarget.targetType,
        activeReportTarget.targetId,
        reportResult.data
      )
    }

    setReportModalFeedback({
      tone: reportResult.status === 'already_exists' ? 'info' : 'success',
      message:
        reportResult.status === 'already_exists'
          ? t('game.details.reportAlreadyExists')
          : t('game.details.reportCreated'),
    })
    setSubmittingReport(false)
  }

  const handleRemoveReport = async () => {
    if (!user || !activeReportTarget?.currentReport) return

    setRemovingReport(true)
    setReportModalFeedback(null)

    const reportResult = await deleteContentReport({
      userId: user.id,
      reportId: activeReportTarget.currentReport.id,
    })

    if (reportResult.error) {
      setReportModalFeedback({
        tone: 'error',
        message: getReviewErrorMessage(reportResult.error, 'report_delete'),
      })
      setRemovingReport(false)
      return
    }

    applyContentReportState(
      activeReportTarget.reviewId,
      activeReportTarget.targetType,
      activeReportTarget.targetId,
      null
    )
    setReportModalFeedback({
      tone: 'success',
      message: t('game.details.reportRemoved'),
    })
    setRemovingReport(false)
  }

  const handleExpandComments = (reviewId: string, totalComments: number) => {
    setVisibleCommentsByReviewId(currentVisibleComments => {
      const currentVisibleCommentsForReview =
        currentVisibleComments[reviewId] ?? getInitialVisibleCommentCount(totalComments)

      return {
        ...currentVisibleComments,
        [reviewId]: clampVisibleCommentCount(
          currentVisibleCommentsForReview + VISIBLE_COMMENT_BATCH_SIZE,
          totalComments
        ),
      }
    })
  }

  const handleExpandReviews = () => {
    setVisibleReviewCount(currentVisibleReviewCount =>
      clampVisibleReviewCount(currentVisibleReviewCount + VISIBLE_REVIEW_BATCH_SIZE, reviews.length)
    )
  }

  const handleDeleteComment = async (reviewId: string, comment: ReviewComment) => {
    if (!user || comment.usuario_id !== user.id) return

    const reviewToUpdate = reviews.find(review => review.id === reviewId)
    const originalCommentIndex =
      reviewToUpdate?.comentarios.findIndex(currentComment => currentComment.id === comment.id) ?? -1

    if (!reviewToUpdate || originalCommentIndex < 0) return

    setReviewFeedback(null)
    setReviews(currentReviews =>
      currentReviews.map(currentReview =>
        currentReview.id === reviewId
          ? {
              ...currentReview,
              comentarios: currentReview.comentarios.filter(
                currentComment => currentComment.id !== comment.id
              ),
            }
          : currentReview
      )
    )
    setPendingCommentReactionIds(currentIds => currentIds.filter(currentId => currentId !== comment.id))
    setReportModalTarget(currentTarget =>
      currentTarget && currentTarget.targetType === 'comment' && currentTarget.targetId === comment.id
        ? null
        : currentTarget
    )
    setReportModalFeedback(null)

    const deleteResult = await deleteReviewComment({
      userId: user.id,
      commentId: comment.id,
    })

    if (deleteResult.ok) {
      return
    }

    setReviews(currentReviews =>
      currentReviews.map(currentReview => {
        if (
          currentReview.id !== reviewId ||
          currentReview.comentarios.some(currentComment => currentComment.id === comment.id)
        ) {
          return currentReview
        }

        const nextComments = [...currentReview.comentarios]
        const restoreIndex = Math.min(originalCommentIndex, nextComments.length)
        nextComments.splice(restoreIndex, 0, comment)

        return {
          ...currentReview,
          comentarios: sortCommentsByRelevance(nextComments),
        }
      })
    )
    setReviewFeedback({
      tone: 'error',
      message: getReviewErrorMessage(deleteResult.error, 'comment_delete'),
    })
  }

  const handleDeleteReview = async (review: ReviewItem) => {
    if (!user || !game || review.usuario_id !== user.id || deletingReviewIds.includes(review.id)) {
      return
    }

    setDeletingReviewIds(currentIds =>
      currentIds.includes(review.id) ? currentIds : [...currentIds, review.id]
    )
    setReviewFeedback(null)

    const deleteResult = await deleteReview({
      userId: user.id,
      reviewId: review.id,
    })

    if (!deleteResult.ok) {
      setReviewFeedback({
        tone: 'error',
        message: getReviewErrorMessage(deleteResult.error, 'delete'),
      })
      setDeletingReviewIds(currentIds => currentIds.filter(currentId => currentId !== review.id))
      return
    }

    setReviews(currentReviews => currentReviews.filter(currentReview => currentReview.id !== review.id))
    setVisibleReviewCount(currentVisibleReviewCount =>
      clampVisibleReviewCount(currentVisibleReviewCount, Math.max(reviews.length - 1, 0))
    )
    setComentarioTexto(currentComments => {
      const nextComments = { ...currentComments }
      delete nextComments[review.id]
      return nextComments
    })
    setSubmittingComentario(currentStates => {
      const nextStates = { ...currentStates }
      delete nextStates[review.id]
      return nextStates
    })
    setVisibleCommentsByReviewId(currentVisibleComments => {
      const nextVisibleComments = { ...currentVisibleComments }
      delete nextVisibleComments[review.id]
      return nextVisibleComments
    })
    setPendingReviewReactionIds(currentIds => currentIds.filter(currentId => currentId !== review.id))
    setPendingCommentReactionIds(currentIds =>
      currentIds.filter(currentId =>
        !review.comentarios.some(currentComment => currentComment.id === currentId)
      )
    )
    setReportModalTarget(currentTarget =>
      currentTarget && currentTarget.reviewId === review.id ? null : currentTarget
    )
    setReportModalFeedback(null)

    const [refreshResult] = await Promise.all([
      refreshReviews(game.id),
      refreshRatingSummary(game.id),
    ])

    if (refreshResult.error && refreshResult.data.length === 0) {
      setReviewFeedback({
        tone: 'info',
        message: 'Sua review foi apagada, mas nao foi possivel atualizar a lista completa agora.',
      })
    } else {
      setReviewFeedback({
        tone: 'success',
        message: 'Sua review foi apagada com sucesso.',
      })
    }

    setDeletingReviewIds(currentIds => currentIds.filter(currentId => currentId !== review.id))
  }

  const handleWishlistToggle = async () => {
    if (!user || !game || wishlistLoading || wishlistSaving) return

    setWishlistSaving(true)
    setWishlistFeedback(null)

    if (isInWishlist && wishlistEntryId) {
      const { error } = await deleteWishlistEntry({
        userId: user.id,
        wishlistEntryId,
      })

      if (error) {
        console.error('Erro ao remover jogo da wishlist:', error)
        setWishlistFeedback({
          tone: 'error',
          message: getWishlistErrorMessage(error, 'delete'),
        })
      } else {
        setIsInWishlist(false)
        setWishlistEntryId(null)
        setWishlistFeedback({
          tone: 'info',
          message: t('game.details.wishlistRemoved'),
        })
      }
    } else {
      const result = await addGameToWishlist({
        userId: user.id,
        gameId: game.id,
      })

      if (result.status === 'added') {
        setIsInWishlist(true)
        setWishlistEntryId(result.data?.id || null)
        setWishlistFeedback({
          tone: 'success',
          message: t('game.details.wishlistSaved'),
        })
      } else if (result.status === 'duplicate') {
        setIsInWishlist(true)
        setWishlistEntryId(result.data?.id || null)
        setWishlistFeedback({
          tone: 'info',
          message: t('game.details.wishlistSaved'),
        })
      } else {
        console.error('Erro ao salvar jogo na wishlist:', result.error)
        setWishlistFeedback({
          tone: 'error',
          message: getWishlistErrorMessage(result.error, 'save'),
        })
      }
    }

    setWishlistSaving(false)
  }

  const handleSaveGameStatus = async (nextStatus: QuickProfileStatusValue) => {
    if (!user || !game || gameStatusLoading || gameStatusSaving) return

    setGameStatusSaving(true)
    setPendingGameStatus(nextStatus)
    setGameStatusFeedback(null)

    const isRemovingCurrentStatus =
      gameStatusEntry?.status === nextStatus && Boolean(gameStatusEntry.id)

    if (isRemovingCurrentStatus && gameStatusEntry?.id) {
      const { error } = await deleteGameStatus({
        userId: user.id,
        statusId: gameStatusEntry.id,
      })

      if (error) {
        console.error('Erro ao remover status do jogo pelo detalhe:', error)
        setGameStatusFeedback({
          tone: 'error',
          message: getGameStatusErrorMessage(error, 'delete'),
        })
      } else {
        setGameStatusEntry(null)
        setGameStatusFeedback({
          tone: 'info',
          message: t('game.details.removeStatusSuccess'),
        })
      }
    } else {
      const { data, error } = await saveGameStatus({
        userId: user.id,
        gameId: game.id,
        status: nextStatus,
        favorito: gameStatusEntry?.favorito || false,
      })

      if (error) {
        console.error('Erro ao salvar status do jogo pelo detalhe:', error)
        setGameStatusFeedback({
          tone: 'error',
          message: getGameStatusErrorMessage(error, 'save'),
        })
      } else {
        setGameStatusEntry(data)
        setGameStatusFeedback({
          tone: 'success',
          message: gameStatusEntry
            ? t('game.details.statusUpdated')
            : t('game.details.statusAdded'),
        })
      }
    }

    setGameStatusSaving(false)
    setPendingGameStatus(null)
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-content game-details-page">
          <section className="game-details-state-card">
            <span className="game-details-state-badge">{t('game.details.badge')}</span>
            <h1>{t('game.details.loadingTitle')}</h1>
            <p>{t('game.details.loadingText')}</p>
          </section>
        </div>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="page-container">
        <div className="page-content game-details-page">
          <section className="game-details-state-card">
            <span className="game-details-state-badge">{t('game.details.badge')}</span>
            <h1>{t('game.details.notFoundTitle')}</h1>
            <p>{t('game.details.notFoundText')}</p>
            <div className="game-details-state-actions">
              <Link to="/games" className="game-button game-details-secondary-button">
                {t('common.goBackToCatalog')}
              </Link>
            </div>
          </section>
        </div>
      </div>
    )
  }

  const generos = normalizeList(game.generos)
  const desenvolvedoras = normalizeList(game.desenvolvedora)
  const plataformas = normalizeList(game.plataformas)
  const releaseDate = formatDate(game.data_lancamento, t('common.notProvided'))
  const descricaoCompleta = game.description?.trim() || t('game.details.noDescription')
  const shouldShowDescriptionFallback = Boolean(game.descriptionFallback)
  const fallbackTotalAvaliacoes = reviews.length
  const fallbackMediaAvaliacoes =
    fallbackTotalAvaliacoes > 0
      ? reviews.reduce((scoreTotal, review) => scoreTotal + review.nota, 0) / fallbackTotalAvaliacoes
      : null
  const totalAvaliacoes = ratingSummary?.reviewCount ?? fallbackTotalAvaliacoes
  const totalComentarios = reviews.reduce(
    (commentCount, review) => commentCount + review.comentarios.length,
    0
  )
  const mediaAvaliacoes = ratingSummary?.averageRating ?? fallbackMediaAvaliacoes
  const mediaAvaliacoesLabel = mediaAvaliacoes !== null
    ? formatNumber(mediaAvaliacoes, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
    : t('game.details.noRatingYet')
  const totalAvaliacoesLabel =
    totalAvaliacoes === 1 ? t('game.details.totalReviews.one') : t('game.details.totalReviews.many', { count: formatNumber(totalAvaliacoes) })
  const totalComentariosLabel =
    totalComentarios === 1 ? t('game.details.comments.one') : t('game.details.comments.many', { count: formatNumber(totalComentarios) })
  const wishlistButtonLabel = wishlistLoading
    ? t('game.details.checking')
    : wishlistSaving
      ? isInWishlist
        ? t('common.removing')
        : t('common.saving')
      : isInWishlist
        ? t('game.details.inWishlist')
        : t('game.details.addWishlist')
  const profileStatusTitle = gameStatusEntry
    ? t('game.details.profilePanelTitleUpdate')
    : t('game.details.profilePanelTitleAdd')
  const profileStatusSubtitle = gameStatusLoading
    ? t('game.details.profilePanelChecking')
    : gameStatusEntry
      ? t('game.details.profilePanelCurrent', { status: getGameStatusLabel(gameStatusEntry.status) })
      : t('game.details.quickStatusText')
  const reviewFormHeading = currentUserReview
    ? t('game.details.editReview')
    : t('game.details.writeReview')
  const reviewFormDescription = currentUserReview
    ? t('game.details.reviewHelp')
    : t('game.details.reviewPlaceholder')

  return (
    <div className="page-container">
      <div className="page-content game-details-page">
        <section className="game-details-hero">
          <div className="game-details-hero-glow game-details-hero-glow-left"></div>
          <div className="game-details-hero-glow game-details-hero-glow-right"></div>

          <div className="game-details-hero-grid">
            <div className="game-details-cover-card">
              {game.capa_url ? (
                <GameCoverImage
                  src={game.capa_url}
                  alt={t('catalog.coverAlt', { title: game.titulo })}
                  className="game-details-cover-image"
                  width={320}
                  height={400}
                  sizes="(max-width: 480px) 280px, (max-width: 900px) 320px, 320px"
                  eager
                />
              ) : (
                <div className="game-details-cover-fallback">
                  <span>{getInitial(game.titulo)}</span>
                </div>
              )}

              <div className="game-details-cover-top">
                <span className="game-details-pill">{t('game.details.catalogBadge')}</span>
                <span className="game-details-cover-date">{releaseDate}</span>
              </div>

              <div className="game-details-cover-bottom">
                <div className="game-details-score-chip">
                  <span className="game-details-score-label">{t('game.details.averageRating')}</span>
                  <strong>{mediaAvaliacoes !== null ? `${mediaAvaliacoesLabel}/10` : mediaAvaliacoesLabel}</strong>
                </div>
              </div>
            </div>

            <div className="game-details-hero-copy">
              <span className="game-details-eyebrow">{t('game.details.gameDetails')}</span>
              <h1>{game.titulo}</h1>

              <div className="game-details-chip-section">
                <span className="game-details-chip-label">{t('game.details.categories')}</span>

                <div className="game-details-chip-row">
                  {generos.length > 0 ? (
                    generos.map(genero => (
                      <span key={genero} className="genre-chip game-details-chip">
                        {genero}
                      </span>
                    ))
                  ) : (
                    <span className="game-details-muted-chip">{t('game.details.genreMissing')}</span>
                  )}
                </div>
              </div>

              <div className="game-details-actions">
                {user ? (
                  <a href="#game-community" className="game-button game-details-primary-button">
                    {t('game.details.rateNow')}
                  </a>
                ) : (
                  <Link to="/login" className="game-button game-details-primary-button">
                    {t('game.details.loginToRate')}
                  </Link>
                )}

                {user ? (
                  <button
                    type="button"
                    className={`game-button game-details-secondary-button game-details-wishlist-button${isInWishlist ? ' is-saved' : ''}`}
                    onClick={handleWishlistToggle}
                    disabled={wishlistLoading || wishlistSaving}
                    aria-live="polite"
                  >
                    {wishlistButtonLabel}
                  </button>
                ) : (
                  <Link
                    to="/login"
                    className="game-button game-details-secondary-button game-details-wishlist-button"
                  >
                    {t('game.details.loginToSave')}
                  </Link>
                )}

                <Link to="/games" className="game-button game-details-secondary-button">
                  {t('common.goBackToCatalog')}
                </Link>
              </div>

              {user ? (
                <div className="game-details-profile-status-card">
                  <div className="game-details-profile-status-copy">
                    <span className="game-details-panel-kicker">{t('common.profile')}</span>
                    <strong>{profileStatusTitle}</strong>
                    <p>{profileStatusSubtitle}</p>
                  </div>

                  <div className="game-details-profile-status-actions">
                    {QUICK_PROFILE_STATUS_OPTIONS.map(option => {
                      const isSelected = gameStatusEntry?.status === option.value
                      const isPendingThisStatus = pendingGameStatus === option.value
                      const isRemovingThisStatus =
                        isPendingThisStatus && gameStatusEntry?.status === option.value

                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`game-button game-details-profile-status-button is-${option.value}${isSelected ? ' is-selected' : ''}`}
                          onClick={() => void handleSaveGameStatus(option.value)}
                          disabled={gameStatusLoading || gameStatusSaving}
                        >
                          <span className="game-details-profile-status-button-label">
                            {gameStatusSaving && isPendingThisStatus
                              ? isRemovingThisStatus
                                ? t('common.removing')
                                : t('common.saving')
                              : t(option.labelKey)}
                          </span>
                          <small className="game-details-profile-status-button-hint">
                            {isSelected ? t('game.details.profilePanelRemoveHint') : t('game.details.profilePanelHint')}
                          </small>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {wishlistFeedback ? (
                <p className={`game-details-feedback is-${wishlistFeedback.tone}`}>
                  {wishlistFeedback.message}
                </p>
              ) : null}

              {gameStatusFeedback ? (
                <p className={`game-details-feedback is-${gameStatusFeedback.tone}`}>
                  {gameStatusFeedback.message}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="game-details-highlights" aria-label={t('game.details.gameDetails')}>
          <article className="game-details-highlight-card">
            <span className="game-details-highlight-label">{t('game.details.developer')}</span>
            <strong>{formatList(desenvolvedoras, t('common.notProvided'))}</strong>
          </article>

          <article className="game-details-highlight-card">
            <span className="game-details-highlight-label">{t('game.details.platforms')}</span>
            <strong>{formatList(plataformas, t('common.notProvidedPlural'))}</strong>
          </article>

          <article className="game-details-highlight-card">
            <span className="game-details-highlight-label">{t('game.details.releaseDate')}</span>
            <strong>{releaseDate}</strong>
          </article>

          <article className="game-details-highlight-card">
            <span className="game-details-highlight-label">{t('game.details.community')}</span>
            <strong>{mediaAvaliacoes !== null ? `${mediaAvaliacoesLabel}/10` : t('game.details.noRatingYet')}</strong>
            <small>{`${totalAvaliacoesLabel} | ${totalComentariosLabel}`}</small>
          </article>
        </section>

        <section className="game-details-info-grid">
          <article className="game-details-panel game-details-panel-full">
            <span className="game-details-panel-kicker">{t('game.details.description')}</span>
            <h2>{t('game.details.aboutTitle')}</h2>
            <p className="game-details-description-body">{descricaoCompleta}</p>
            {shouldShowDescriptionFallback ? (
              <p className="game-details-description-note">
                {t('game.details.descriptionFallbackEnglish')}
              </p>
            ) : null}
          </article>
        </section>

        <section id="game-community" className="game-details-reviews">
          <div className="game-details-section-heading">
            <div>
              <span className="game-details-panel-kicker">{t('game.details.community')}</span>
              <h2>{t('game.details.reviewsHeading')}</h2>
              <p>{t('game.details.reviewsDescription')}</p>
            </div>
          </div>

          {user ? (
            <form onSubmit={handleSubmitAvaliacao} className="game-details-review-form">
              <div className="game-details-review-form-head">
                <div>
                  <strong>{reviewFormHeading}</strong>
                  <p>{reviewFormDescription}</p>
                </div>
                {currentUserReview ? (
                  <span className="game-details-review-form-badge">{t('game.details.reviewAlreadyPublished')}</span>
                ) : null}
              </div>

              <div className="game-details-form-block">
                <label className="game-details-form-label">{t('game.details.yourScore')}</label>
                <div className="game-details-rating-grid" role="radiogroup" aria-label={t('game.details.scoreAria')}>
                  {REVIEW_SCORE_OPTIONS.map(score => (
                    <button
                      key={score}
                      type="button"
                      className={`game-details-rating-button${nota === score ? ' is-selected' : ''}`}
                      onClick={() => setNota(score)}
                      aria-pressed={nota === score}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>

              <div className="game-details-form-block">
                <label htmlFor="game-review-text" className="game-details-form-label">
                  {t('game.details.commentOptional')} <span className="game-details-form-caption">({t('common.optional')})</span>
                </label>
                <textarea
                  id="game-review-text"
                  className="game-details-textarea"
                  value={textoReview}
                  onChange={event => setTextoReview(event.target.value)}
                  placeholder={t('game.details.reviewPlaceholder')}
                />
              </div>

              <div className="game-details-review-form-footer">
                <span className="game-details-form-helper">
                  {t('game.details.reviewHelper')}
                </span>
                <button
                  type="submit"
                  disabled={submitting}
                  className="game-button game-details-primary-button game-details-submit-button"
                >
                  {submitting
                    ? t('game.details.submittingReview')
                    : currentUserReview
                      ? t('game.details.updateReview')
                      : t('game.details.submitReview')}
                </button>
              </div>
            </form>
          ) : (
            <div className="game-details-login-card">
              <div>
                <span className="game-details-panel-kicker">{t('game.details.participate')}</span>
                <h3>{t('game.details.loginToReview')}</h3>
                <p>{t('game.details.loginToReviewText')}</p>
              </div>

              <Link to="/login" className="game-button game-details-primary-button">
                {t('auth.login.submit')}
              </Link>
            </div>
          )}

          {reviewFeedback ? (
            <p className={`game-details-feedback is-${reviewFeedback.tone}`}>{reviewFeedback.message}</p>
          ) : null}

          <div className="game-details-review-list">
            {reviewsError && reviews.length === 0 ? (
              <div className="game-details-empty-card">
                <h3>{t('game.details.reviewLoadErrorTitle')}</h3>
                <p>{reviewsError}</p>
                <button
                  type="button"
                  className="game-button game-details-secondary-button"
                  onClick={() => void refreshReviews(game.id)}
                >
                  {t('common.tryAgain')}
                </button>
              </div>
            ) : reviews.length === 0 ? (
              <div className="game-details-empty-card">
                <h3>{t('game.details.noReviewsTitle')}</h3>
                <p>{t('game.details.noReviewsText')}</p>
              </div>
            ) : (
              <>
                {visibleReviews.map(review => (
                  <GameReviewCard
                    key={review.id}
                    review={review}
                    currentUserId={user?.id ?? null}
                    visibleCommentCount={
                      visibleCommentsByReviewId[review.id] ??
                      getInitialVisibleCommentCount(review.comentarios.length)
                    }
                    commentText={comentarioTexto[review.id] || ''}
                    isSubmittingComment={Boolean(submittingComentario[review.id])}
                    isReviewReactionPending={pendingReviewReactionIds.includes(review.id)}
                    isReviewDeletePending={deletingReviewIds.includes(review.id)}
                    pendingCommentReactionIds={pendingCommentReactionIds}
                    onToggleReviewLike={handleToggleReviewLike}
                    onToggleReviewDislike={handleToggleReviewDislike}
                    onDeleteReview={handleDeleteReview}
                    onToggleCommentLike={handleToggleCommentLike}
                    onToggleCommentDislike={handleToggleCommentDislike}
                    onDeleteComment={handleDeleteComment}
                    onOpenReportModal={handleOpenReportModal}
                    onExpandComments={handleExpandComments}
                    onSubmitComment={handleSubmitComentario}
                    onCommentTextChange={(reviewId, value) =>
                      setComentarioTexto(currentComments => ({
                        ...currentComments,
                        [reviewId]: value,
                      }))
                    }
                  />
                ))}

                {hiddenReviewsCount > 0 ? (
                  <button
                    type="button"
                    className="game-details-reviews-expand-button"
                    onClick={handleExpandReviews}
                    aria-label={t('game.details.moreReviewsAria', { count: formatNumber(hiddenReviewsCount) })}
                  >
                    {t('game.details.moreReviews')}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </section>

        {activeReportTarget ? (
          <ContentReportModal
            key={`${activeReportTarget.targetType}-${activeReportTarget.targetId}-${activeReportTarget.currentReport?.id || 'new'}`}
            targetType={activeReportTarget.targetType}
            targetLabel={
              activeReportTarget.targetType === 'review'
                ? t('game.details.reviewTarget', { author: activeReportTarget.authorName })
                : t('game.details.commentTarget', { author: activeReportTarget.authorName })
            }
            currentReport={activeReportTarget.currentReport}
            feedback={reportModalFeedback}
            isSubmitting={submittingReport}
            isRemoving={removingReport}
            onClose={handleCloseReportModal}
            onSubmit={handleSubmitReport}
            onRemove={handleRemoveReport}
          />
        ) : null}
      </div>
    </div>
  )
}

export default GameDetailsPage
