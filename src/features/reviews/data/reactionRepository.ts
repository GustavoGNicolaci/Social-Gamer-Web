import { supabase } from '../../../supabase-client'
import {
  normalizeReviewError,
  type ReviewError,
} from '../domain/reviewError'
import type {
  AtomicReactionToggleResult,
  CommentReactionState,
  ReactionSummaryMaps,
  ReactionToggleStatus,
  ReviewReactionState,
} from '../domain/reviewInteractions'

interface ServiceResult<T> {
  data: T
  error: ReviewError | null
}

type ReactionContentType = 'review' | 'comment'
type ReactionType = 'like' | 'dislike'

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

function normalizeReactionState(
  row: ReactionSummaryRow | ReactionToggleRow
): ReviewReactionState {
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
      const targetMap =
        row.content_type === 'review' ? reactionStates.reviews : reactionStates.comments

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

export type {
  AtomicReactionToggleResult,
  CommentReactionState,
  ReactionSummaryMaps,
  ReviewReactionState,
} from '../domain/reviewInteractions'
