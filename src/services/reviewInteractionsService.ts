import { supabase } from '../supabase-client'
import type { ReviewError } from './reviewService'

export type ReportTargetType = 'review' | 'comment'
export type ReportReason =
  | 'spam'
  | 'assedio_ou_ofensa'
  | 'conteudo_improprio'
  | 'informacao_enganosa'
  | 'discurso_de_odio'
  | 'outro'
export type ReportStatus = 'pending' | 'under_review' | 'resolved' | 'dismissed'

export interface ReviewReactionState {
  curtidas: number
  likedByCurrentUser: boolean
  dislikes: number
  dislikedByCurrentUser: boolean
}

export interface CommentDislikeState {
  dislikes: number
  dislikedByCurrentUser: boolean
}

export interface CurrentUserReportSummary {
  id: string
  targetType: ReportTargetType
  reason: ReportReason
  description: string | null
  status: ReportStatus
  createdAt: string
}

interface ServiceResult<T> {
  data: T
  error: ReviewError | null
}

interface ReviewLikeRow {
  avaliacao_id: string
  usuario_id: string
}

interface ReviewDislikeRow {
  avaliacao_id: string
  usuario_id: string
}

interface CommentDislikeRow {
  comentario_id: string
  usuario_id: string
}

interface ContentReportRow {
  id: string
  tipo_conteudo: ReportTargetType
  avaliacao_id: string | null
  comentario_id: string | null
  motivo: ReportReason
  descricao: string | null
  status: ReportStatus
  created_at: string
}

interface ToggleReviewDislikeParams {
  reviewId: string
  userId: string
  reviewAuthorId: string
  likedByCurrentUser: boolean
  dislikedByCurrentUser: boolean
  currentLikeCount: number
  currentDislikeCount: number
}

interface ToggleCommentDislikeParams {
  commentId: string
  userId: string
  commentAuthorId: string
  dislikedByCurrentUser: boolean
  currentDislikeCount: number
}

interface SubmitContentReportParams {
  userId: string
  targetType: ReportTargetType
  targetId: string
  targetAuthorId?: string
  reason: ReportReason
  description?: string
}

interface ToggleReviewDislikeResult {
  status: 'disliked' | 'undisliked' | 'error'
  data: ReviewReactionState | null
  error: ReviewError | null
}

interface ToggleCommentDislikeResult {
  status: 'disliked' | 'undisliked' | 'error'
  data: CommentDislikeState | null
  error: ReviewError | null
}

interface SubmitContentReportResult {
  status: 'created' | 'already_exists' | 'error'
  data: CurrentUserReportSummary | null
  error: ReviewError | null
}

interface ContentReportMaps {
  reportsByReviewId: Map<string, CurrentUserReportSummary>
  reportsByCommentId: Map<string, CurrentUserReportSummary>
}

const CONTENT_REPORT_SELECT = `
  id,
  tipo_conteudo,
  avaliacao_id,
  comentario_id,
  motivo,
  descricao,
  status,
  created_at
`

export const REPORT_REASON_OPTIONS: Array<{ value: ReportReason; label: string }> = [
  { value: 'spam', label: 'Spam' },
  { value: 'assedio_ou_ofensa', label: 'Assedio ou ofensa' },
  { value: 'conteudo_improprio', label: 'Conteudo improprio' },
  { value: 'informacao_enganosa', label: 'Informacao enganosa' },
  { value: 'discurso_de_odio', label: 'Discurso de odio' },
  { value: 'outro', label: 'Outro' },
]

export const REPORT_REASON_LABELS: Record<ReportReason, string> = REPORT_REASON_OPTIONS.reduce(
  (labels, option) => ({
    ...labels,
    [option.value]: option.label,
  }),
  {} as Record<ReportReason, string>
)

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  pending: 'Pendente',
  under_review: 'Em analise',
  resolved: 'Resolvida',
  dismissed: 'Arquivada',
}

function normalizeReviewError(error: unknown, fallbackMessage: string): ReviewError {
  if (error && typeof error === 'object') {
    const message =
      'message' in error && typeof error.message === 'string' ? error.message : fallbackMessage
    const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined
    const details =
      'details' in error && typeof error.details === 'string' ? error.details : null
    const hint = 'hint' in error && typeof error.hint === 'string' ? error.hint : null

    return { code, message, details, hint }
  }

  return { message: fallbackMessage }
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmedValue = value?.trim() || ''
  return trimmedValue ? trimmedValue : null
}

function createReviewReactionStateMap(reviewIds: string[]) {
  const reactionStates = new Map<string, ReviewReactionState>()

  reviewIds.forEach(reviewId => {
    reactionStates.set(reviewId, {
      curtidas: 0,
      likedByCurrentUser: false,
      dislikes: 0,
      dislikedByCurrentUser: false,
    })
  })

  return reactionStates
}

function createCommentDislikeStateMap(commentIds: string[]) {
  const dislikeStates = new Map<string, CommentDislikeState>()

  commentIds.forEach(commentId => {
    dislikeStates.set(commentId, {
      dislikes: 0,
      dislikedByCurrentUser: false,
    })
  })

  return dislikeStates
}

function normalizeReportSummary(row: ContentReportRow): CurrentUserReportSummary {
  return {
    id: row.id,
    targetType: row.tipo_conteudo,
    reason: row.motivo,
    description: row.descricao,
    status: row.status,
    createdAt: row.created_at,
  }
}

async function rollbackInsertedReviewLike(reviewId: string, userId: string) {
  await supabase
    .from('avaliacao_curtidas')
    .delete()
    .eq('avaliacao_id', reviewId)
    .eq('usuario_id', userId)
}

async function rollbackInsertedReviewDislike(reviewId: string, userId: string) {
  await supabase
    .from('avaliacao_deslikes')
    .delete()
    .eq('avaliacao_id', reviewId)
    .eq('usuario_id', userId)
}

export async function getReviewLikeStates(
  reviewIds: string[],
  currentUserId?: string | null
): Promise<ServiceResult<Map<string, ReviewReactionState>>> {
  const reactionStates = createReviewReactionStateMap(reviewIds)

  if (reviewIds.length === 0) {
    return {
      data: reactionStates,
      error: null,
    }
  }

  try {
    const { data, error } = await supabase
      .from('avaliacao_curtidas')
      .select('avaliacao_id, usuario_id')
      .in('avaliacao_id', reviewIds)

    if (error) {
      return {
        data: reactionStates,
        error: normalizeReviewError(error, 'Nao foi possivel carregar as curtidas das reviews.'),
      }
    }

    const likeRows = (data || []) as ReviewLikeRow[]

    likeRows.forEach(like => {
      const currentState = reactionStates.get(like.avaliacao_id)

      if (!currentState) return

      reactionStates.set(like.avaliacao_id, {
        ...currentState,
        curtidas: currentState.curtidas + 1,
        likedByCurrentUser:
          currentState.likedByCurrentUser ||
          Boolean(currentUserId && like.usuario_id === currentUserId),
      })
    })

    return {
      data: reactionStates,
      error: null,
    }
  } catch (error) {
    return {
      data: reactionStates,
      error: normalizeReviewError(error, 'Erro inesperado ao carregar as curtidas das reviews.'),
    }
  }
}

export async function getReviewDislikeStates(
  reviewIds: string[],
  currentUserId?: string | null
): Promise<ServiceResult<Map<string, ReviewReactionState>>> {
  const reactionStates = createReviewReactionStateMap(reviewIds)

  if (reviewIds.length === 0) {
    return {
      data: reactionStates,
      error: null,
    }
  }

  try {
    const { data, error } = await supabase
      .from('avaliacao_deslikes')
      .select('avaliacao_id, usuario_id')
      .in('avaliacao_id', reviewIds)

    if (error) {
      return {
        data: reactionStates,
        error: normalizeReviewError(error, 'Nao foi possivel carregar os dislikes das reviews.'),
      }
    }

    const dislikeRows = (data || []) as ReviewDislikeRow[]

    dislikeRows.forEach(dislike => {
      const currentState = reactionStates.get(dislike.avaliacao_id)

      if (!currentState) return

      reactionStates.set(dislike.avaliacao_id, {
        ...currentState,
        dislikes: currentState.dislikes + 1,
        dislikedByCurrentUser:
          currentState.dislikedByCurrentUser ||
          Boolean(currentUserId && dislike.usuario_id === currentUserId),
      })
    })

    return {
      data: reactionStates,
      error: null,
    }
  } catch (error) {
    return {
      data: reactionStates,
      error: normalizeReviewError(error, 'Erro inesperado ao carregar os dislikes das reviews.'),
    }
  }
}

export async function getCommentDislikeStates(
  commentIds: string[],
  currentUserId?: string | null
): Promise<ServiceResult<Map<string, CommentDislikeState>>> {
  const dislikeStates = createCommentDislikeStateMap(commentIds)

  if (commentIds.length === 0) {
    return {
      data: dislikeStates,
      error: null,
    }
  }

  try {
    const { data, error } = await supabase
      .from('comentario_deslikes')
      .select('comentario_id, usuario_id')
      .in('comentario_id', commentIds)

    if (error) {
      return {
        data: dislikeStates,
        error: normalizeReviewError(error, 'Nao foi possivel carregar os dislikes dos comentarios.'),
      }
    }

    const dislikeRows = (data || []) as CommentDislikeRow[]

    dislikeRows.forEach(dislike => {
      const currentState = dislikeStates.get(dislike.comentario_id)

      if (!currentState) return

      dislikeStates.set(dislike.comentario_id, {
        dislikes: currentState.dislikes + 1,
        dislikedByCurrentUser:
          currentState.dislikedByCurrentUser ||
          Boolean(currentUserId && dislike.usuario_id === currentUserId),
      })
    })

    return {
      data: dislikeStates,
      error: null,
    }
  } catch (error) {
    return {
      data: dislikeStates,
      error: normalizeReviewError(error, 'Erro inesperado ao carregar os dislikes dos comentarios.'),
    }
  }
}

export async function getCurrentUserContentReports(
  reviewIds: string[],
  commentIds: string[],
  currentUserId?: string | null
): Promise<ServiceResult<ContentReportMaps>> {
  const emptyResult: ContentReportMaps = {
    reportsByReviewId: new Map<string, CurrentUserReportSummary>(),
    reportsByCommentId: new Map<string, CurrentUserReportSummary>(),
  }

  if (!currentUserId || (reviewIds.length === 0 && commentIds.length === 0)) {
    return {
      data: emptyResult,
      error: null,
    }
  }

  try {
    const [reviewReportsResponse, commentReportsResponse] = await Promise.all([
      reviewIds.length > 0
        ? supabase
            .from('denuncias_conteudo')
            .select(CONTENT_REPORT_SELECT)
            .eq('denunciante_id', currentUserId)
            .eq('tipo_conteudo', 'review')
            .in('avaliacao_id', reviewIds)
        : Promise.resolve({ data: [], error: null }),
      commentIds.length > 0
        ? supabase
            .from('denuncias_conteudo')
            .select(CONTENT_REPORT_SELECT)
            .eq('denunciante_id', currentUserId)
            .eq('tipo_conteudo', 'comment')
            .in('comentario_id', commentIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (reviewReportsResponse.error || commentReportsResponse.error) {
      return {
        data: emptyResult,
        error: normalizeReviewError(
          reviewReportsResponse.error || commentReportsResponse.error,
          'Nao foi possivel carregar o estado das denuncias deste conteudo.'
        ),
      }
    }

    const reviewReports = (reviewReportsResponse.data || []) as ContentReportRow[]
    const commentReports = (commentReportsResponse.data || []) as ContentReportRow[]

    reviewReports.forEach(report => {
      if (!report.avaliacao_id) return
      emptyResult.reportsByReviewId.set(report.avaliacao_id, normalizeReportSummary(report))
    })

    commentReports.forEach(report => {
      if (!report.comentario_id) return
      emptyResult.reportsByCommentId.set(report.comentario_id, normalizeReportSummary(report))
    })

    return {
      data: emptyResult,
      error: null,
    }
  } catch (error) {
    return {
      data: emptyResult,
      error: normalizeReviewError(
        error,
        'Erro inesperado ao carregar o estado das denuncias deste conteudo.'
      ),
    }
  }
}

export async function getSingleReviewReactionState(
  reviewId: string,
  currentUserId?: string | null
): Promise<ServiceResult<ReviewReactionState | null>> {
  const [likeStatesResult, dislikeStatesResult] = await Promise.all([
    getReviewLikeStates([reviewId], currentUserId),
    getReviewDislikeStates([reviewId], currentUserId),
  ])

  const likeState = likeStatesResult.data.get(reviewId)
  const dislikeState = dislikeStatesResult.data.get(reviewId)

  return {
    data: {
      curtidas: likeState?.curtidas ?? 0,
      likedByCurrentUser: likeState?.likedByCurrentUser ?? false,
      dislikes: dislikeState?.dislikes ?? 0,
      dislikedByCurrentUser: dislikeState?.dislikedByCurrentUser ?? false,
    },
    error: likeStatesResult.error || dislikeStatesResult.error,
  }
}

export async function getSingleCommentDislikeState(
  commentId: string,
  currentUserId?: string | null
): Promise<ServiceResult<CommentDislikeState | null>> {
  const dislikeStatesResult = await getCommentDislikeStates([commentId], currentUserId)

  return {
    data: dislikeStatesResult.data.get(commentId) || null,
    error: dislikeStatesResult.error,
  }
}

async function getExistingContentReport(
  userId: string,
  targetType: ReportTargetType,
  targetId: string
): Promise<ServiceResult<CurrentUserReportSummary | null>> {
  try {
    const query = supabase
      .from('denuncias_conteudo')
      .select(CONTENT_REPORT_SELECT)
      .eq('denunciante_id', userId)
      .eq('tipo_conteudo', targetType)
      .limit(1)

    const filteredQuery =
      targetType === 'review'
        ? query.eq('avaliacao_id', targetId)
        : query.eq('comentario_id', targetId)

    const { data, error } = await filteredQuery.maybeSingle()

    if (error) {
      return {
        data: null,
        error: normalizeReviewError(error, 'Nao foi possivel verificar a denuncia atual.'),
      }
    }

    return {
      data: data ? normalizeReportSummary(data as ContentReportRow) : null,
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: normalizeReviewError(error, 'Erro inesperado ao verificar a denuncia atual.'),
    }
  }
}

export async function toggleReviewDislike({
  reviewId,
  userId,
  reviewAuthorId,
  likedByCurrentUser,
  dislikedByCurrentUser,
  currentLikeCount,
  currentDislikeCount,
}: ToggleReviewDislikeParams): Promise<ToggleReviewDislikeResult> {
  if (userId === reviewAuthorId) {
    return {
      status: 'error',
      data: null,
      error: {
        message: 'Voce nao pode marcar "Não gostei" na propria review.',
      },
    }
  }

  try {
    if (dislikedByCurrentUser) {
      const { error } = await supabase
        .from('avaliacao_deslikes')
        .delete()
        .eq('avaliacao_id', reviewId)
        .eq('usuario_id', userId)

      if (error) {
        return {
          status: 'error',
          data: null,
          error: normalizeReviewError(error, 'Nao foi possivel remover o "Não gostei" desta review.'),
        }
      }

      const reactionStateResult = await getSingleReviewReactionState(reviewId, userId)

      return {
        status: 'undisliked',
        data: reactionStateResult.data || {
          curtidas: currentLikeCount,
          likedByCurrentUser,
          dislikes: Math.max(currentDislikeCount - 1, 0),
          dislikedByCurrentUser: false,
        },
        error: null,
      }
    }

    const { error: insertDislikeError } = await supabase.from('avaliacao_deslikes').insert({
      avaliacao_id: reviewId,
      usuario_id: userId,
    })

    if (insertDislikeError && insertDislikeError.code !== '23505') {
      return {
        status: 'error',
        data: null,
        error: normalizeReviewError(insertDislikeError, 'Nao foi possivel marcar "Não gostei" nesta review.'),
      }
    }

    if (likedByCurrentUser) {
      const { error: removeLikeError } = await supabase
        .from('avaliacao_curtidas')
        .delete()
        .eq('avaliacao_id', reviewId)
        .eq('usuario_id', userId)

      if (removeLikeError) {
        if (!insertDislikeError) {
          await rollbackInsertedReviewDislike(reviewId, userId)
        }

        return {
          status: 'error',
          data: null,
          error: normalizeReviewError(
            removeLikeError,
            'Nao foi possivel sincronizar curtida e "Não gostei" desta review.'
          ),
        }
      }
    }

    const reactionStateResult = await getSingleReviewReactionState(reviewId, userId)

    return {
      status: 'disliked',
      data: reactionStateResult.data || {
        curtidas: Math.max(currentLikeCount - (likedByCurrentUser ? 1 : 0), 0),
        likedByCurrentUser: false,
        dislikes: currentDislikeCount + (dislikedByCurrentUser ? 0 : 1),
        dislikedByCurrentUser: true,
      },
      error: null,
    }
  } catch (error) {
    return {
      status: 'error',
      data: null,
      error: normalizeReviewError(error, 'Erro inesperado ao atualizar o "Não gostei" desta review.'),
    }
  }
}

export async function toggleCommentDislike({
  commentId,
  userId,
  commentAuthorId,
  dislikedByCurrentUser,
  currentDislikeCount,
}: ToggleCommentDislikeParams): Promise<ToggleCommentDislikeResult> {
  if (userId === commentAuthorId) {
    return {
      status: 'error',
      data: null,
      error: {
        message: 'Voce nao pode marcar "Não gostei" no proprio comentario.',
      },
    }
  }

  try {
    if (dislikedByCurrentUser) {
      const { error } = await supabase
        .from('comentario_deslikes')
        .delete()
        .eq('comentario_id', commentId)
        .eq('usuario_id', userId)

      if (error) {
        return {
          status: 'error',
          data: null,
          error: normalizeReviewError(error, 'Nao foi possivel remover o "Não gostei" deste comentario.'),
        }
      }

      const dislikeStateResult = await getSingleCommentDislikeState(commentId, userId)

      return {
        status: 'undisliked',
        data: dislikeStateResult.data || {
          dislikes: Math.max(currentDislikeCount - 1, 0),
          dislikedByCurrentUser: false,
        },
        error: null,
      }
    }

    const { error } = await supabase.from('comentario_deslikes').insert({
      comentario_id: commentId,
      usuario_id: userId,
    })

    if (error && error.code !== '23505') {
      return {
        status: 'error',
        data: null,
        error: normalizeReviewError(error, 'Nao foi possivel marcar "Não gostei" neste comentario.'),
      }
    }

    const dislikeStateResult = await getSingleCommentDislikeState(commentId, userId)

    return {
      status: 'disliked',
      data: dislikeStateResult.data || {
        dislikes: currentDislikeCount + 1,
        dislikedByCurrentUser: true,
      },
      error: null,
    }
  } catch (error) {
    return {
      status: 'error',
      data: null,
      error: normalizeReviewError(
        error,
        'Erro inesperado ao atualizar o "Não gostei" deste comentario.'
      ),
    }
  }
}

export async function submitContentReport({
  userId,
  targetType,
  targetId,
  targetAuthorId,
  reason,
  description,
}: SubmitContentReportParams): Promise<SubmitContentReportResult> {
  if (targetAuthorId && userId === targetAuthorId) {
    return {
      status: 'error',
      data: null,
      error: {
        message: 'Voce nao pode denunciar o proprio conteudo.',
      },
    }
  }

  const normalizedDescription = normalizeOptionalText(description)

  try {
    const { data, error } = await supabase
      .from('denuncias_conteudo')
      .insert({
        denunciante_id: userId,
        tipo_conteudo: targetType,
        avaliacao_id: targetType === 'review' ? targetId : null,
        comentario_id: targetType === 'comment' ? targetId : null,
        motivo: reason,
        descricao: normalizedDescription,
        created_at: new Date().toISOString(),
      })
      .select(CONTENT_REPORT_SELECT)
      .maybeSingle()

    if (error) {
      if (error.code === '23505') {
        const existingReportResult = await getExistingContentReport(userId, targetType, targetId)

        return {
          status: 'already_exists',
          data: existingReportResult.data,
          error: existingReportResult.error,
        }
      }

      return {
        status: 'error',
        data: null,
        error: normalizeReviewError(error, 'Nao foi possivel registrar esta denuncia.'),
      }
    }

    return {
      status: 'created',
      data: data ? normalizeReportSummary(data as ContentReportRow) : null,
      error: null,
    }
  } catch (error) {
    return {
      status: 'error',
      data: null,
      error: normalizeReviewError(error, 'Erro inesperado ao registrar esta denuncia.'),
    }
  }
}

export async function syncReviewLikeWithDislikeRemoval(reviewId: string, userId: string) {
  const { error } = await supabase
    .from('avaliacao_deslikes')
    .delete()
    .eq('avaliacao_id', reviewId)
    .eq('usuario_id', userId)

  return {
    error: error
      ? normalizeReviewError(error, 'Nao foi possivel remover o "Não gostei" desta review.')
      : null,
  }
}

export async function rollbackInsertedLike(reviewId: string, userId: string) {
  await rollbackInsertedReviewLike(reviewId, userId)
}
