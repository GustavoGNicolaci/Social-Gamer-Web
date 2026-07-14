import { supabase } from '../supabase-client'
import {
  normalizeReviewError,
  type ReviewError,
} from '../features/reviews/domain/reviewError'

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

export interface CommentReactionState {
  curtidas: number
  likedByCurrentUser: boolean
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

type ReactionContentType = 'review' | 'comment'
type ReactionType = 'like' | 'dislike'
type ReactionToggleStatus = 'liked' | 'unliked' | 'disliked' | 'undisliked'

interface ReactionSummaryRow {
  content_type: ReactionContentType
  content_id: string
  curtidas: number
  dislikes: number
  liked_by_current_user: boolean
  disliked_by_current_user: boolean
}

interface ReactionToggleRow {
  reaction_status: ReactionToggleStatus
  curtidas: number
  dislikes: number
  liked_by_current_user: boolean
  disliked_by_current_user: boolean
}

export interface ReactionSummaryMaps {
  reviews: Map<string, ReviewReactionState>
  comments: Map<string, CommentReactionState>
}

export interface AtomicReactionToggleResult {
  status: ReactionToggleStatus | 'error'
  data: ReviewReactionState | null
  error: ReviewError | null
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
  likedByCurrentUser: boolean
  dislikedByCurrentUser: boolean
  currentLikeCount: number
  currentDislikeCount: number
}

interface ToggleCommentLikeParams {
  commentId: string
  userId: string
  commentAuthorId: string
  likedByCurrentUser: boolean
  dislikedByCurrentUser: boolean
  currentLikeCount: number
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
  data: CommentReactionState | null
  error: ReviewError | null
}

interface ToggleCommentLikeResult {
  status: 'liked' | 'unliked' | 'error'
  data: CommentReactionState | null
  error: ReviewError | null
}

interface SubmitContentReportResult {
  status: 'created' | 'already_exists' | 'error'
  data: CurrentUserReportSummary | null
  error: ReviewError | null
}

interface DeleteContentReportParams {
  userId: string
  reportId: string
}

interface DeleteContentReportResult {
  status: 'deleted' | 'error'
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

function normalizeOptionalText(value: string | null | undefined) {
  const trimmedValue = value?.trim() || ''
  return trimmedValue ? trimmedValue : null
}

function createReactionStateMap(contentIds: string[]) {
  const reactionStates = new Map<string, ReviewReactionState>()

  contentIds.forEach(contentId => {
    reactionStates.set(contentId, {
      curtidas: 0,
      likedByCurrentUser: false,
      dislikes: 0,
      dislikedByCurrentUser: false,
    })
  })

  return reactionStates
}

function normalizeReactionState(row: ReactionSummaryRow | ReactionToggleRow): ReviewReactionState {
  return {
    curtidas: Math.max(Number(row.curtidas) || 0, 0),
    likedByCurrentUser: Boolean(row.liked_by_current_user),
    dislikes: Math.max(Number(row.dislikes) || 0, 0),
    dislikedByCurrentUser: Boolean(row.disliked_by_current_user),
  }
}

function normalizeContentIds(contentIds: string[]) {
  return Array.from(new Set(contentIds.filter(Boolean)))
}

const REACTION_SUMMARY_BATCH_SIZE = 500

function createReactionSummaryBatches(reviewIds: string[], commentIds: string[]) {
  const batches: Array<{ reviewIds: string[]; commentIds: string[] }> = []
  let reviewIndex = 0
  let commentIndex = 0

  while (reviewIndex < reviewIds.length || commentIndex < commentIds.length) {
    let remaining = REACTION_SUMMARY_BATCH_SIZE
    const batchReviewIds = reviewIds.slice(reviewIndex, reviewIndex + remaining)
    reviewIndex += batchReviewIds.length
    remaining -= batchReviewIds.length

    const batchCommentIds = commentIds.slice(commentIndex, commentIndex + remaining)
    commentIndex += batchCommentIds.length

    batches.push({ reviewIds: batchReviewIds, commentIds: batchCommentIds })
  }

  return batches
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

export async function getReactionSummaryStates(
  reviewIds: string[],
  commentIds: string[]
): Promise<ServiceResult<ReactionSummaryMaps>> {
  const normalizedReviewIds = normalizeContentIds(reviewIds)
  const normalizedCommentIds = normalizeContentIds(commentIds)
  const reactionStates: ReactionSummaryMaps = {
    reviews: createReactionStateMap(normalizedReviewIds),
    comments: createReactionStateMap(normalizedCommentIds),
  }

  if (normalizedReviewIds.length === 0 && normalizedCommentIds.length === 0) {
    return {
      data: reactionStates,
      error: null,
    }
  }

  try {
    const summaryRows: ReactionSummaryRow[] = []

    for (const batch of createReactionSummaryBatches(
      normalizedReviewIds,
      normalizedCommentIds
    )) {
      const { data, error } = await supabase.rpc('get_review_reaction_summaries', {
        p_review_ids: batch.reviewIds,
        p_comment_ids: batch.commentIds,
      })

      if (error) {
        return {
          data: reactionStates,
          error: normalizeReviewError(
            error,
            'Nao foi possivel carregar as reacoes das reviews.'
          ),
        }
      }

      summaryRows.push(...((data || []) as ReactionSummaryRow[]))
    }

    summaryRows.forEach(row => {
      const targetMap = row.content_type === 'review' ? reactionStates.reviews : reactionStates.comments

      if (!targetMap.has(row.content_id)) return

      targetMap.set(row.content_id, normalizeReactionState(row))
    })

    return {
      data: reactionStates,
      error: null,
    }
  } catch (error) {
    return {
      data: reactionStates,
      error: normalizeReviewError(
        error,
        'Erro inesperado ao carregar as reacoes das reviews.'
      ),
    }
  }
}

export async function toggleContentReaction(
  contentType: ReactionContentType,
  contentId: string,
  reaction: ReactionType
): Promise<AtomicReactionToggleResult> {
  try {
    const { data, error } = await supabase.rpc('toggle_review_reaction', {
      p_content_type: contentType,
      p_content_id: contentId,
      p_reaction: reaction,
    })

    if (error) {
      return {
        status: 'error',
        data: null,
        error: normalizeReviewError(error, 'Nao foi possivel atualizar esta reacao.'),
      }
    }

    const row = (data?.[0] || null) as ReactionToggleRow | null

    if (!row) {
      return {
        status: 'error',
        data: null,
        error: {
          message: 'A atualizacao da reacao nao retornou um estado valido.',
        },
      }
    }

    return {
      status: row.reaction_status,
      data: normalizeReactionState(row),
      error: null,
    }
  } catch (error) {
    return {
      status: 'error',
      data: null,
      error: normalizeReviewError(error, 'Erro inesperado ao atualizar esta reacao.'),
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

  const result = await toggleContentReaction('review', reviewId, 'dislike')

  if (result.status !== 'disliked' && result.status !== 'undisliked') {
    return {
      status: 'error',
      data: result.data,
      error: result.error || { message: 'A review retornou um estado de reacao inesperado.' },
    }
  }

  return {
    status: result.status,
    data: result.data,
    error: result.error,
  }
}

export async function toggleCommentLike({
  commentId,
  userId,
  commentAuthorId,
}: ToggleCommentLikeParams): Promise<ToggleCommentLikeResult> {
  if (userId === commentAuthorId) {
    return {
      status: 'error',
      data: null,
      error: {
        message: 'Voce nao pode curtir o proprio comentario.',
      },
    }
  }

  const result = await toggleContentReaction('comment', commentId, 'like')

  if (result.status !== 'liked' && result.status !== 'unliked') {
    return {
      status: 'error',
      data: result.data,
      error: result.error || { message: 'O comentario retornou um estado de reacao inesperado.' },
    }
  }

  return {
    status: result.status,
    data: result.data,
    error: result.error,
  }
}

export async function toggleCommentDislike({
  commentId,
  userId,
  commentAuthorId,
}: ToggleCommentDislikeParams): Promise<ToggleCommentDislikeResult> {
  if (userId === commentAuthorId) {
    return {
      status: 'error',
      data: null,
      error: {
        message: 'Você não pode marcar "Não gostei" no próprio comentário.',
      },
    }
  }

  const result = await toggleContentReaction('comment', commentId, 'dislike')

  if (result.status !== 'disliked' && result.status !== 'undisliked') {
    return {
      status: 'error',
      data: result.data,
      error: result.error || { message: 'O comentario retornou um estado de reacao inesperado.' },
    }
  }

  return {
    status: result.status,
    data: result.data,
    error: result.error,
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

export async function deleteContentReport({
  userId,
  reportId,
}: DeleteContentReportParams): Promise<DeleteContentReportResult> {
  if (!userId || !reportId) {
    return {
      status: 'error',
      error: {
        message: 'Nao foi possivel identificar a denuncia que voce deseja remover.',
      },
    }
  }

  try {
    const { data, error } = await supabase
      .from('denuncias_conteudo')
      .delete()
      .eq('id', reportId)
      .eq('denunciante_id', userId)
      .select('id')
      .maybeSingle()

    if (error) {
      return {
        status: 'error',
        error: normalizeReviewError(error, 'Nao foi possivel remover esta denuncia.'),
      }
    }

    if (!data) {
      return {
        status: 'error',
        error: {
          message: 'Esta denuncia nao foi encontrada ou ja foi removida.',
        },
      }
    }

    return {
      status: 'deleted',
      error: null,
    }
  } catch (error) {
    return {
      status: 'error',
      error: normalizeReviewError(error, 'Erro inesperado ao remover esta denuncia.'),
    }
  }
}
