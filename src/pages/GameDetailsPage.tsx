import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ContentReportModal } from '../components/reviews/ContentReportModal'
import { UserAvatar } from '../components/UserAvatar'
import { useAuth } from '../contexts/AuthContext'
import {
  createReviewComment,
  deleteReviewComment,
  deleteReview,
  getReviewsByGameId,
  saveReview,
  toggleReviewLike,
  type ReviewComment,
  type ReviewError,
  type ReviewItem,
} from '../services/reviewService'
import {
  submitContentReport,
  toggleCommentDislike,
  toggleReviewDislike,
  type CommentDislikeState,
  type CurrentUserReportSummary,
  type ReportReason,
  type ReportTargetType,
  type ReviewReactionState,
} from '../services/reviewInteractionsService'
import {
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
import { supabase } from '../supabase-client'
import { getOptionalPublicProfilePath } from '../utils/profileRoutes'
import './GameDetailsPage.css'

interface Game {
  id: number
  titulo: string
  capa_url: string
  desenvolvedora: string[] | string
  generos: string[] | string
  data_lancamento: string
  descricao: string
  plataformas: string[] | string
}

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
const INITIAL_VISIBLE_COMMENT_COUNT = 2
const VISIBLE_COMMENT_BATCH_SIZE = 4
const QUICK_PROFILE_STATUS_OPTIONS: Array<{
  value: QuickProfileStatusValue
  label: string
}> = [
  { value: 'jogando', label: 'Jogando' },
  { value: 'zerado', label: 'Zerei' },
  { value: 'dropado', label: 'Dropei' },
]

function normalizeList(value: string[] | string | null | undefined) {
  if (!value) return []
  return Array.isArray(value) ? value.filter(Boolean) : [value]
}

function formatList(value: string[] | string | null | undefined, fallback: string) {
  const items = normalizeList(value)
  return items.length > 0 ? items.join(', ') : fallback
}

function formatDate(value: string | null | undefined, fallback = 'Nao informado') {
  if (!value) return fallback

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return fallback

  return parsedDate.toLocaleDateString('pt-BR')
}

function formatReviewScore(score: number) {
  return score.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })
}

function getInitialVisibleCommentCount(totalComments: number) {
  if (totalComments <= INITIAL_VISIBLE_COMMENT_COUNT) {
    return totalComments
  }

  return INITIAL_VISIBLE_COMMENT_COUNT
}

function clampVisibleCommentCount(visibleComments: number, totalComments: number) {
  return Math.max(0, Math.min(visibleComments, totalComments))
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

  const fullMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()

  if (
    error.code === '42501' ||
    fullMessage.includes('permission denied') ||
    fullMessage.includes('row-level security') ||
    fullMessage.includes('policy')
  ) {
    return action === 'save'
      ? 'Nao foi possivel acessar sua lista de desejos por permissao. Verifique as policies da tabela lista_desejos no Supabase.'
      : 'Nao foi possivel remover este jogo da sua lista de desejos por permissao. Verifique as policies DELETE da tabela lista_desejos no Supabase.'
  }

  if (fullMessage.includes('duplicate') || fullMessage.includes('unique')) {
    return 'Esse jogo ja esta na sua lista de desejos.'
  }

  if (fullMessage.includes('column')) {
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

  const fullMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()

  if (
    error.code === '42501' ||
    fullMessage.includes('permission denied') ||
    fullMessage.includes('row-level security') ||
    fullMessage.includes('policy')
  ) {
    return action === 'save'
      ? 'Nao foi possivel salvar este jogo no perfil por permissao. Verifique as policies da tabela status_jogo no Supabase.'
      : 'Nao foi possivel remover este jogo do perfil por permissao. Verifique as policies DELETE da tabela status_jogo no Supabase.'
  }

  if (fullMessage.includes('column')) {
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
    | 'comment_dislike'
    | 'report'
    | 'delete'
) {
  if (!error) {
    if (action === 'save') return 'Nao foi possivel salvar sua review agora.'
    if (action === 'comment') return 'Nao foi possivel publicar seu comentario agora.'
    if (action === 'comment_delete') return 'Nao foi possivel apagar este comentario agora.'
    if (action === 'review_like') return 'Nao foi possivel atualizar a curtida desta review agora.'
    if (action === 'review_dislike') {
      return 'Nao foi possivel atualizar o "Não gostei" desta review agora.'
    }
    if (action === 'comment_dislike') {
      return 'Nao foi possivel atualizar o "Não gostei" deste comentario agora.'
    }
    if (action === 'report') return 'Nao foi possivel registrar esta denuncia agora.'
    if (action === 'delete') return 'Nao foi possivel apagar esta review agora.'
    return 'Nao foi possivel carregar as reviews deste jogo agora.'
  }

  const fullMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()

  if (
    error.code === '42501' ||
    fullMessage.includes('permission denied') ||
    fullMessage.includes('row-level security') ||
    fullMessage.includes('policy')
  ) {
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
      return 'Nao foi possivel atualizar esta curtida por permissao. Verifique as policies da tabela avaliacao_curtidas no Supabase.'
    }

    if (action === 'review_dislike') {
      return 'Nao foi possivel atualizar este "Não gostei" por permissao. Verifique as policies da tabela avaliacao_deslikes no Supabase.'
    }

    if (action === 'comment_dislike') {
      return 'Nao foi possivel atualizar este "Não gostei" por permissao. Verifique as policies da tabela comentario_deslikes no Supabase.'
    }

    if (action === 'report') {
      return 'Nao foi possivel registrar esta denuncia por permissao. Verifique as policies da tabela denuncias_conteudo no Supabase.'
    }

    if (action === 'delete') {
      return 'Nao foi possivel apagar esta review por permissao. Verifique as policies DELETE da tabela avaliacoes no Supabase.'
    }

    return 'Nao foi possivel carregar as reviews por permissao. Verifique as policies das tabelas avaliacoes, comentarios, avaliacao_curtidas, avaliacao_deslikes, comentario_deslikes e denuncias_conteudo no Supabase.'
  }

  if (fullMessage.includes('duplicate') || fullMessage.includes('unique')) {
    if (action === 'review_like') {
      return 'Essa review ja estava curtida por este usuario.'
    }

    if (action === 'review_dislike' || action === 'comment_dislike') {
      return 'Esse "Não gostei" ja estava registrado por este usuario.'
    }

    if (action === 'report') {
      return 'Voce ja denunciou este conteudo anteriormente.'
    }

    return 'Ja existe uma review sua para este jogo. Envie novamente para atualizar a avaliacao.'
  }

  if (fullMessage.includes('column')) {
    return 'A estrutura das tabelas de reviews nao corresponde ao frontend.'
  }

  return error.message
}

function getGameStatusLabel(status: GameStatusValue | null | undefined) {
  if (status === 'zerado') return 'Zerei'
  if (status === 'dropado') return 'Dropei'
  return 'Jogando'
}

function getUserName(usuario: { username?: string | null } | null | undefined) {
  const username = usuario?.username?.trim()
  return username || 'Usuario'
}

function getInitial(name: string) {
  const firstCharacter = name.trim().charAt(0)
  return firstCharacter ? firstCharacter.toUpperCase() : 'U'
}

function iconHeart(isFilled: boolean) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 20.4L10.55 19.08C5.4 14.36 2 11.27 2 7.5C2 4.41 4.42 2 7.5 2C9.24 2 10.91 2.81 12 4.09C13.09 2.81 14.76 2 16.5 2C19.58 2 22 4.41 22 7.5C22 11.27 18.6 14.36 13.45 19.09L12 20.4Z"
        fill={isFilled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function iconThumbDown(isFilled: boolean) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M14 4H6.5C5.67 4 4.95 4.5 4.64 5.22L2.08 11.18C2.03 11.31 2 11.45 2 11.6V13.5C2 14.33 2.67 15 3.5 15H8.24L7.52 18.46C7.5 18.56 7.49 18.66 7.49 18.76C7.49 19.17 7.66 19.56 7.93 19.84L8.72 20.62L13.64 15.71C13.88 15.47 14 15.15 14 14.81V4ZM18 4H22V14H18V4Z"
        fill={isFilled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function iconFlag(isFilled: boolean) {
  return (
    <span className={`game-review-report-emoji${isFilled ? ' is-filled' : ''}`} aria-hidden="true">
      {isFilled ? '⚑' : '⚐'}
    </span>
  )
}

function GameDetailsPage() {
  const { id } = useParams()
  const { user } = useAuth()

  const [game, setGame] = useState<Game | null>(null)
  const [reviews, setReviews] = useState<ReviewItem[]>([])
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
  const [pendingCommentDislikeIds, setPendingCommentDislikeIds] = useState<string[]>([])
  const [deletingReviewIds, setDeletingReviewIds] = useState<string[]>([])
  const [reportModalTarget, setReportModalTarget] = useState<ReportModalTargetState | null>(null)
  const [reportModalFeedback, setReportModalFeedback] = useState<FeedbackState | null>(null)
  const [submittingReport, setSubmittingReport] = useState(false)
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

          return result.data.map(review => {
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
              comentarios: review.comentarios.map(comment => {
                const currentComment = currentCommentStateById.get(comment.id)

                if (!currentComment) {
                  return comment
                }

                return {
                  ...comment,
                  dislikes: currentComment.dislikes,
                  dislikedByCurrentUser: currentComment.dislikedByCurrentUser,
                  currentUserReport: currentComment.currentUserReport,
                }
              }),
            }
          })
        }

        return result.data
      })

      if (result.error && result.data.length === 0) {
        setReviewsError(getReviewErrorMessage(result.error, 'load'))
      } else {
        setReviewsError(null)
      }

      return result
    },
    [user?.id]
  )

  const applyReviewReactionState = useCallback(
    (reviewId: string, nextReactionState: ReviewReactionState) => {
      setReviews(currentReviews =>
        currentReviews.map(currentReview =>
          currentReview.id === reviewId
            ? {
                ...currentReview,
                curtidas: nextReactionState.curtidas,
                likedByCurrentUser: nextReactionState.likedByCurrentUser,
                dislikes: nextReactionState.dislikes,
                dislikedByCurrentUser: nextReactionState.dislikedByCurrentUser,
              }
            : currentReview
        )
      )
    },
    []
  )

  const applyCommentDislikeState = useCallback(
    (reviewId: string, commentId: string, nextDislikeState: CommentDislikeState) => {
      setReviews(currentReviews =>
        currentReviews.map(currentReview =>
          currentReview.id === reviewId
            ? {
                ...currentReview,
                comentarios: currentReview.comentarios.map(currentComment =>
                  currentComment.id === commentId
                    ? {
                        ...currentComment,
                        dislikes: nextDislikeState.dislikes,
                        dislikedByCurrentUser: nextDislikeState.dislikedByCurrentUser,
                      }
                    : currentComment
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
      nextReport: CurrentUserReportSummary
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
          setReviewsError(null)
          setLoading(false)
        }
        return
      }

      setLoading(true)

      const [gameResponse, reviewsResult] = await Promise.all([
        supabase.from('jogos').select('*').eq('id', gameId).single(),
        getReviewsByGameId(gameId, user?.id),
      ])

      if (!isMounted) return

      if (gameResponse.error) {
        console.error('Erro ao buscar jogo:', gameResponse.error)
        setGame(null)
      } else {
        setGame((gameResponse.data as Game | null) || null)
      }

      setReviews(reviewsResult.data)
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

    const refreshResult = await refreshReviews(game.id)

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

  const handleToggleCommentDislike = async (reviewId: string, comment: ReviewComment) => {
    if (!user || pendingCommentDislikeIds.includes(comment.id) || !comment.canDislike) return

    const previousDislikeState: CommentDislikeState = {
      dislikes: comment.dislikes,
      dislikedByCurrentUser: comment.dislikedByCurrentUser,
    }
    const optimisticDislikeState: CommentDislikeState = {
      dislikes: Math.max(comment.dislikes + (comment.dislikedByCurrentUser ? -1 : 1), 0),
      dislikedByCurrentUser: !comment.dislikedByCurrentUser,
    }

    setPendingCommentDislikeIds(currentIds =>
      currentIds.includes(comment.id) ? currentIds : [...currentIds, comment.id]
    )
    setReviewFeedback(null)
    applyCommentDislikeState(reviewId, comment.id, optimisticDislikeState)

    const dislikeResult = await toggleCommentDislike({
      commentId: comment.id,
      userId: user.id,
      commentAuthorId: comment.usuario_id,
      dislikedByCurrentUser: comment.dislikedByCurrentUser,
      currentDislikeCount: comment.dislikes,
    })

    if (dislikeResult.error) {
      applyCommentDislikeState(reviewId, comment.id, previousDislikeState)
      setReviewFeedback({
        tone: 'error',
        message: getReviewErrorMessage(dislikeResult.error, 'comment_dislike'),
      })
      setPendingCommentDislikeIds(currentIds => currentIds.filter(currentId => currentId !== comment.id))
      return
    }

    if (dislikeResult.data) {
      applyCommentDislikeState(reviewId, comment.id, dislikeResult.data)
    }

    setPendingCommentDislikeIds(currentIds => currentIds.filter(currentId => currentId !== comment.id))
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
    if (submittingReport) return

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
          ? 'Voce ja havia denunciado este conteudo. Mantivemos o registro atual.'
          : 'Denuncia enviada com sucesso. Obrigado por ajudar a manter a comunidade segura.',
    })
    setSubmittingReport(false)
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
    setPendingCommentDislikeIds(currentIds => currentIds.filter(currentId => currentId !== comment.id))
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
          comentarios: nextComments,
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
    setPendingCommentDislikeIds(currentIds =>
      currentIds.filter(currentId =>
        !review.comentarios.some(currentComment => currentComment.id === currentId)
      )
    )
    setReportModalTarget(currentTarget =>
      currentTarget && currentTarget.reviewId === review.id ? null : currentTarget
    )
    setReportModalFeedback(null)

    const refreshResult = await refreshReviews(game.id)

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
          message: 'Jogo removido da sua lista de desejos.',
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
          message: 'Jogo salvo na sua lista de desejos.',
        })
      } else if (result.status === 'duplicate') {
        setIsInWishlist(true)
        setWishlistEntryId(result.data?.id || null)
        setWishlistFeedback({
          tone: 'info',
          message: 'Esse jogo ja esta na sua lista de desejos.',
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
          message: 'Jogo removido do seu perfil.',
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
            ? 'Status do jogo atualizado no seu perfil.'
            : 'Jogo adicionado ao seu perfil.',
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
            <span className="game-details-state-badge">GamePage</span>
            <h1>Carregando detalhes do jogo</h1>
            <p>Estamos preparando capa, informacoes principais e avaliacoes da comunidade.</p>
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
            <span className="game-details-state-badge">GamePage</span>
            <h1>Jogo nao encontrado</h1>
            <p>O item solicitado nao esta disponivel no catalogo ou pode ter sido removido.</p>
            <div className="game-details-state-actions">
              <Link to="/games" className="game-button game-details-secondary-button">
                Voltar ao catalogo
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
  const releaseDate = formatDate(game.data_lancamento)
  const descricaoCompleta = game.descricao?.trim() || 'Descricao nao informada.'
  const totalAvaliacoes = reviews.length
  const totalComentarios = reviews.reduce(
    (commentCount, review) => commentCount + review.comentarios.length,
    0
  )
  const mediaAvaliacoes =
    totalAvaliacoes > 0
      ? reviews.reduce((scoreTotal, review) => scoreTotal + review.nota, 0) / totalAvaliacoes
      : null
  const mediaAvaliacoesLabel = mediaAvaliacoes
    ? mediaAvaliacoes.toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
    : 'Sem notas'
  const totalAvaliacoesLabel =
    totalAvaliacoes === 1 ? '1 avaliacao' : `${totalAvaliacoes} avaliacoes`
  const totalComentariosLabel =
    totalComentarios === 1 ? '1 comentario' : `${totalComentarios} comentarios`
  const wishlistButtonLabel = wishlistLoading
    ? 'Verificando...'
    : wishlistSaving
      ? isInWishlist
        ? 'Removendo...'
        : 'Salvando...'
      : isInWishlist
        ? 'Na sua lista'
        : 'Salvar na lista'
  const profileStatusTitle = gameStatusEntry
    ? 'Atualize rapidamente este jogo no seu perfil'
    : 'Adicione este jogo direto ao seu perfil'
  const profileStatusSubtitle = gameStatusLoading
    ? 'Verificando como esse jogo aparece no seu perfil...'
    : gameStatusEntry
      ? `Status atual: ${getGameStatusLabel(gameStatusEntry.status)}. Toque novamente no botao ativo para remover.`
      : 'Escolha um status rapido sem sair da pagina.'
  const reviewFormHeading = currentUserReview
    ? 'Atualize sua review para este jogo'
    : 'Publique sua review para este jogo'
  const reviewFormDescription = currentUserReview
    ? 'Sua nota continua obrigatoria e o comentario pode ficar vazio se voce quiser deixar apenas a avaliacao numerica.'
    : 'Escolha uma nota e, se quiser, complemente com um comentario. O comentario e opcional.'

  return (
    <div className="page-container">
      <div className="page-content game-details-page">
        <section className="game-details-hero">
          <div className="game-details-hero-glow game-details-hero-glow-left"></div>
          <div className="game-details-hero-glow game-details-hero-glow-right"></div>

          <div className="game-details-hero-grid">
            <div className="game-details-cover-card">
              {game.capa_url ? (
                <img
                  src={game.capa_url}
                  alt={`Capa do jogo ${game.titulo}`}
                  className="game-details-cover-image"
                />
              ) : (
                <div className="game-details-cover-fallback">
                  <span>{getInitial(game.titulo)}</span>
                </div>
              )}

              <div className="game-details-cover-top">
                <span className="game-details-pill">Catalogo Social Gamer</span>
                <span className="game-details-cover-date">{releaseDate}</span>
              </div>

              <div className="game-details-cover-bottom">
                <div className="game-details-score-chip">
                  <span className="game-details-score-label">Media</span>
                  <strong>{mediaAvaliacoes ? `${mediaAvaliacoesLabel}/10` : mediaAvaliacoesLabel}</strong>
                </div>
              </div>
            </div>

            <div className="game-details-hero-copy">
              <span className="game-details-eyebrow">Detalhes do jogo</span>
              <h1>{game.titulo}</h1>

              <div className="game-details-chip-section">
                <span className="game-details-chip-label">Categorias</span>

                <div className="game-details-chip-row">
                  {generos.length > 0 ? (
                    generos.map(genero => (
                      <span key={genero} className="genre-chip game-details-chip">
                        {genero}
                      </span>
                    ))
                  ) : (
                    <span className="game-details-muted-chip">Genero nao informado</span>
                  )}
                </div>
              </div>

              <div className="game-details-actions">
                {user ? (
                  <a href="#game-community" className="game-button game-details-primary-button">
                    Avaliar agora
                  </a>
                ) : (
                  <Link to="/login" className="game-button game-details-primary-button">
                    Fazer login para avaliar
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
                    Fazer login para salvar
                  </Link>
                )}

                <Link to="/games" className="game-button game-details-secondary-button">
                  Voltar ao catalogo
                </Link>
              </div>

              {user ? (
                <div className="game-details-profile-status-card">
                  <div className="game-details-profile-status-copy">
                    <span className="game-details-panel-kicker">Perfil</span>
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
                                ? 'Removendo...'
                                : 'Salvando...'
                              : option.label}
                          </span>
                          <small className="game-details-profile-status-button-hint">
                            {isSelected ? 'Toque para remover' : 'Salvar no perfil'}
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

        <section className="game-details-highlights" aria-label="Informacoes principais">
          <article className="game-details-highlight-card">
            <span className="game-details-highlight-label">Desenvolvedora</span>
            <strong>{formatList(desenvolvedoras, 'Nao informada')}</strong>
          </article>

          <article className="game-details-highlight-card">
            <span className="game-details-highlight-label">Plataformas</span>
            <strong>{formatList(plataformas, 'Nao informadas')}</strong>
          </article>

          <article className="game-details-highlight-card">
            <span className="game-details-highlight-label">Lancamento</span>
            <strong>{releaseDate}</strong>
          </article>

          <article className="game-details-highlight-card">
            <span className="game-details-highlight-label">Comunidade</span>
            <strong>{mediaAvaliacoes ? `${mediaAvaliacoesLabel}/10` : 'Ainda sem notas'}</strong>
            <small>{`${totalAvaliacoesLabel} | ${totalComentariosLabel}`}</small>
          </article>
        </section>

        <section className="game-details-info-grid">
          <article className="game-details-panel game-details-panel-full">
            <span className="game-details-panel-kicker">Descricao</span>
            <h2>Sobre o jogo</h2>
            <p className="game-details-description-body">{descricaoCompleta}</p>
          </article>
        </section>

        <section id="game-community" className="game-details-reviews">
          <div className="game-details-section-heading">
            <div>
              <span className="game-details-panel-kicker">Comunidade</span>
              <h2>Avaliacoes e comentarios</h2>
              <p>Veja como a comunidade descreve a experiencia deste jogo.</p>
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
                  <span className="game-details-review-form-badge">Review ja publicada</span>
                ) : null}
              </div>

              <div className="game-details-form-block">
                <label className="game-details-form-label">Sua nota</label>
                <div className="game-details-rating-grid" role="radiogroup" aria-label="Escolha sua nota">
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
                  Comentario <span className="game-details-form-caption">(opcional)</span>
                </label>
                <textarea
                  id="game-review-text"
                  className="game-details-textarea"
                  value={textoReview}
                  onChange={event => setTextoReview(event.target.value)}
                  placeholder="Compartilhe sua opiniao sobre jogabilidade, historia, visual ou comunidade, se quiser."
                />
              </div>

              <div className="game-details-review-form-footer">
                <span className="game-details-form-helper">
                  Sua review fica vinculada automaticamente a este jogo e aparece no seu perfil.
                </span>
                <button
                  type="submit"
                  disabled={submitting}
                  className="game-button game-details-primary-button game-details-submit-button"
                >
                  {submitting
                    ? 'Salvando...'
                    : currentUserReview
                      ? 'Atualizar review'
                      : 'Publicar review'}
                </button>
              </div>
            </form>
          ) : (
            <div className="game-details-login-card">
              <div>
                <span className="game-details-panel-kicker">Participar</span>
                <h3>Entre para avaliar este jogo</h3>
                <p>Faca login para publicar reviews, comentar e curtir as avaliacoes da comunidade.</p>
              </div>

              <Link to="/login" className="game-button game-details-primary-button">
                Fazer login
              </Link>
            </div>
          )}

          {reviewFeedback ? (
            <p className={`game-details-feedback is-${reviewFeedback.tone}`}>{reviewFeedback.message}</p>
          ) : null}

          <div className="game-details-review-list">
            {reviewsError && reviews.length === 0 ? (
              <div className="game-details-empty-card">
                <h3>As reviews nao puderam ser carregadas</h3>
                <p>{reviewsError}</p>
                <button
                  type="button"
                  className="game-button game-details-secondary-button"
                  onClick={() => void refreshReviews(game.id)}
                >
                  Tentar novamente
                </button>
              </div>
            ) : reviews.length === 0 ? (
              <div className="game-details-empty-card">
                <h3>Nenhuma avaliacao por enquanto</h3>
                <p>Seja a primeira pessoa a compartilhar uma opiniao sobre este titulo.</p>
              </div>
            ) : (
              reviews.map(review => {
                const avaliadorNome = getUserName(review.usuario)
                const avaliadorProfilePath = getOptionalPublicProfilePath(review.usuario?.username)
                const isReactionPending = pendingReviewReactionIds.includes(review.id)
                const isDeletePending = deletingReviewIds.includes(review.id)
                const isOwnerReview = Boolean(user && review.usuario_id === user.id)
                const visibleCommentCount =
                  visibleCommentsByReviewId[review.id] ??
                  getInitialVisibleCommentCount(review.comentarios.length)
                const visibleComments = review.comentarios.slice(0, visibleCommentCount)
                const hiddenCommentsCount = review.comentarios.length - visibleComments.length
                const likeButtonLabel = !user
                  ? 'Faca login para curtir'
                  : review.canLike
                    ? review.likedByCurrentUser
                      ? 'Descurtir review'
                      : 'Curtir review'
                    : 'Sua propria review'
                const dislikeButtonLabel = !user
                  ? 'Faca login para usar "Não gostei"'
                  : review.canDislike
                    ? review.dislikedByCurrentUser
                      ? 'Remover "Não gostei" da review'
                      : 'Marcar "Não gostei" nesta review'
                    : 'Sua propria review'
                const reportButtonLabel = review.currentUserReport
                  ? 'Ver detalhes da sua denuncia desta review'
                  : 'Denunciar review'

                return (
                  <article key={review.id} className="game-review-card">
                    <div className="game-review-card-header">
                      {avaliadorProfilePath ? (
                        <Link
                          to={avaliadorProfilePath}
                          className="game-review-user-link"
                          aria-label={`Abrir perfil de ${avaliadorNome}`}
                        >
                          <UserAvatar
                            name={avaliadorNome}
                            avatarPath={review.usuario?.avatar_path}
                            imageClassName="game-review-avatar"
                            fallbackClassName="game-review-avatar-fallback"
                          />

                          <div className="game-review-user-copy">
                            <strong>{avaliadorNome}</strong>
                            <span>{formatDate(review.data_publicacao)}</span>
                          </div>
                        </Link>
                      ) : (
                        <div className="game-review-user">
                          <UserAvatar
                            name={avaliadorNome}
                            avatarPath={review.usuario?.avatar_path}
                            imageClassName="game-review-avatar"
                            fallbackClassName="game-review-avatar-fallback"
                          />

                          <div className="game-review-user-copy">
                            <strong>{avaliadorNome}</strong>
                            <span>{formatDate(review.data_publicacao)}</span>
                          </div>
                        </div>
                      )}

                      <div className="game-review-header-side">
                        {user && !isOwnerReview ? (
                          <button
                            type="button"
                            className={`game-review-report-button${review.currentUserReport ? ' is-reported' : ''}`}
                            onClick={() => handleOpenReportModal('review', review.id, review.id)}
                            aria-label={reportButtonLabel}
                            title={reportButtonLabel}
                          >
                            {iconFlag(Boolean(review.currentUserReport))}
                          </button>
                        ) : null}

                        <div className="game-review-score">
                          <div className="game-review-score-grid">
                            {REVIEW_SCORE_OPTIONS.map(score => (
                              <span
                                key={score}
                                className={`game-review-score-pill${score <= review.nota ? ' is-filled' : ''}`}
                              >
                                {score}
                              </span>
                            ))}
                          </div>
                          <span className="game-review-score-label">
                            {formatReviewScore(review.nota)}/10
                          </span>
                        </div>
                      </div>
                    </div>

                    {review.texto_review ? (
                      <p className="game-review-body">{review.texto_review}</p>
                    ) : (
                      <p className="game-review-body is-muted">
                        Esta review foi publicada apenas com a nota.
                      </p>
                    )}

                    <div className="game-review-meta">
                      <div className="game-review-reactions">
                        <button
                          type="button"
                          className={`game-review-reaction-button is-like${review.likedByCurrentUser ? ' is-active is-liked' : ''}`}
                          onClick={() => void handleToggleReviewLike(review)}
                          disabled={!user || !review.canLike || isReactionPending}
                          aria-label={likeButtonLabel}
                          title={likeButtonLabel}
                        >
                          <span className="game-review-reaction-icon">
                            {iconHeart(review.likedByCurrentUser)}
                          </span>
                          <span>
                            {isReactionPending
                              ? 'Atualizando...'
                              : review.likedByCurrentUser
                                ? 'Curtido'
                                : 'Curtir'}
                          </span>
                        </button>
                        <span>{review.curtidas} curtidas</span>

                        <button
                          type="button"
                          className={`game-review-reaction-button is-dislike${review.dislikedByCurrentUser ? ' is-active is-disliked' : ''}`}
                          onClick={() => void handleToggleReviewDislike(review)}
                          disabled={!user || !review.canDislike || isReactionPending}
                          aria-label={dislikeButtonLabel}
                          title={dislikeButtonLabel}
                        >
                          <span className="game-review-reaction-icon">
                            {iconThumbDown(review.dislikedByCurrentUser)}
                          </span>
                          <span>
                            {isReactionPending
                              ? 'Atualizando...'
                              : review.dislikedByCurrentUser
                                ? 'Não gostei'
                                : 'Não gostei'}
                          </span>
                        </button>
                        <span>{review.dislikes} não gostaram</span>
                      </div>

                      <span>
                        {review.comentarios.length === 1
                          ? '1 comentario'
                          : `${review.comentarios.length} comentarios`}
                      </span>
                      {isOwnerReview ? (
                        <button
                          type="button"
                          className="game-review-delete-button"
                          onClick={() => void handleDeleteReview(review)}
                          disabled={isDeletePending}
                        >
                          {isDeletePending ? 'Apagando...' : 'Apagar review'}
                        </button>
                      ) : null}
                    </div>

                    <div className="game-review-comments">
                      {review.comentarios.length > 0 ? (
                        <div className="game-review-comments-list">
                          {visibleComments.map(comentario => {
                            const autorComentario = getUserName(comentario.usuario)
                            const autorComentarioProfilePath = getOptionalPublicProfilePath(
                              comentario.usuario?.username
                            )
                            const isOwnerComment = Boolean(user && comentario.usuario_id === user.id)
                            const isCommentDislikePending = pendingCommentDislikeIds.includes(
                              comentario.id
                            )
                            const canReportComment = Boolean(user && !isOwnerComment)
                            const commentDislikeButtonLabel = !user
                              ? 'Faca login para usar "Não gostei"'
                              : comentario.canDislike
                                ? comentario.dislikedByCurrentUser
                                  ? 'Remover "Não gostei" do comentario'
                                  : 'Marcar "Não gostei" neste comentario'
                                : 'Seu proprio comentario'
                            const commentReportButtonLabel = comentario.currentUserReport
                              ? 'Ver detalhes da sua denuncia deste comentario'
                              : 'Denunciar comentario'

                            return (
                              <div key={comentario.id} className="game-review-comment-card">
                                <div className="game-review-comment-header">
                                  {autorComentarioProfilePath ? (
                                    <Link
                                      to={autorComentarioProfilePath}
                                      className="game-review-comment-author-link"
                                      aria-label={`Abrir perfil de ${autorComentario}`}
                                    >
                                      <UserAvatar
                                        name={autorComentario}
                                        avatarPath={comentario.usuario?.avatar_path}
                                        imageClassName="game-review-comment-avatar"
                                        fallbackClassName="game-review-comment-avatar-fallback"
                                      />

                                      <strong>{autorComentario}</strong>
                                    </Link>
                                  ) : (
                                    <div className="game-review-comment-author">
                                      <UserAvatar
                                        name={autorComentario}
                                        avatarPath={comentario.usuario?.avatar_path}
                                        imageClassName="game-review-comment-avatar"
                                        fallbackClassName="game-review-comment-avatar-fallback"
                                      />

                                      <strong>{autorComentario}</strong>
                                    </div>
                                  )}

                                  <div className="game-review-comment-meta">
                                    <span className="game-review-comment-date">
                                      {formatDate(comentario.data_comentario)}
                                    </span>

                                    <div className="game-review-comment-meta-actions">
                                      {canReportComment ? (
                                        <button
                                          type="button"
                                          className={`game-review-report-button is-comment${comentario.currentUserReport ? ' is-reported' : ''}`}
                                          onClick={() =>
                                            handleOpenReportModal(
                                              'comment',
                                              comentario.id,
                                              review.id
                                            )
                                          }
                                          aria-label={commentReportButtonLabel}
                                          title={commentReportButtonLabel}
                                        >
                                          {iconFlag(Boolean(comentario.currentUserReport))}
                                        </button>
                                      ) : null}

                                      <button
                                        type="button"
                                        className={`game-review-comment-reaction-button${comentario.dislikedByCurrentUser ? ' is-disliked' : ''}`}
                                        onClick={() =>
                                          void handleToggleCommentDislike(review.id, comentario)
                                        }
                                        disabled={
                                          !user ||
                                          !comentario.canDislike ||
                                          isCommentDislikePending
                                        }
                                        aria-label={commentDislikeButtonLabel}
                                        title={commentDislikeButtonLabel}
                                      >
                                        <span className="game-review-reaction-icon">
                                          {iconThumbDown(comentario.dislikedByCurrentUser)}
                                        </span>
                                        <span>
                                          {isCommentDislikePending
                                            ? 'Atualizando...'
                                            : comentario.dislikedByCurrentUser
                                              ? `Não gostei (${comentario.dislikes})`
                                              : `Não gostei (${comentario.dislikes})`}
                                        </span>
                                      </button>

                                      {isOwnerComment ? (
                                        <button
                                          type="button"
                                          className="game-review-comment-delete-button"
                                          onClick={() =>
                                            void handleDeleteComment(review.id, comentario)
                                          }
                                        >
                                          Apagar
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>

                                <p className="game-review-comment-body">{comentario.texto}</p>
                              </div>
                            )
                          })}
                        </div>
                      ) : null}

                      {hiddenCommentsCount > 0 ? (
                        <button
                          type="button"
                          className="game-review-comments-expand-button"
                          onClick={() => handleExpandComments(review.id, review.comentarios.length)}
                          aria-label={`Ver mais comentarios. ${hiddenCommentsCount} restantes.`}
                        >
                          Ver mais comentarios
                        </button>
                      ) : null}

                      {user ? (
                        <form
                          onSubmit={event => handleSubmitComentario(review.id, event)}
                          className="game-review-comment-form"
                        >
                          <textarea
                            className="game-review-comment-input"
                            value={comentarioTexto[review.id] || ''}
                            onChange={event =>
                              setComentarioTexto(prevState => ({
                                ...prevState,
                                [review.id]: event.target.value,
                              }))
                            }
                            placeholder="Adicione um comentario para continuar a conversa."
                            required
                          />

                          <button
                            type="submit"
                            disabled={submittingComentario[review.id]}
                            className="game-review-comment-button"
                          >
                            {submittingComentario[review.id] ? 'Enviando...' : 'Comentar'}
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </section>

        {activeReportTarget ? (
          <ContentReportModal
            key={`${activeReportTarget.targetType}-${activeReportTarget.targetId}-${activeReportTarget.currentReport?.id || 'new'}`}
            targetType={activeReportTarget.targetType}
            targetLabel={
              activeReportTarget.targetType === 'review'
                ? `a review de ${activeReportTarget.authorName}`
                : `o comentario de ${activeReportTarget.authorName}`
            }
            currentReport={activeReportTarget.currentReport}
            feedback={reportModalFeedback}
            isSubmitting={submittingReport}
            onClose={handleCloseReportModal}
            onSubmit={handleSubmitReport}
          />
        ) : null}
      </div>
    </div>
  )
}

export default GameDetailsPage
