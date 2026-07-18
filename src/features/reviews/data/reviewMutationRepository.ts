import { supabase } from '../../../supabase-client'
import {
  normalizeReviewError,
  type ReviewError,
} from '../domain/reviewError'
import type {
  ReviewReactionState,
} from '../domain/reviewInteractions'
import type { ReviewServiceResult } from '../domain/reviewModels'
import { toggleContentReaction } from './reactionRepository'

interface SaveReviewParams {
  userId: string
  gameId: number
  nota: number
  textoReview: string
}

interface ToggleReviewLikeParams {
  reviewId: string
  userId: string
  reviewAuthorId: string
  likedByCurrentUser: boolean
  dislikedByCurrentUser: boolean
  currentLikeCount: number
  currentDislikeCount: number
}

interface CreateReviewCommentParams {
  userId: string
  reviewId: string
  texto: string
}

interface DeleteReviewCommentParams {
  userId: string
  commentId: string
}

interface DeleteReviewParams {
  userId: string
  reviewId: string
}

interface SaveReviewResult {
  status: 'created' | 'updated' | 'error'
  error: ReviewError | null
}

interface ToggleReviewLikeResult {
  status: 'liked' | 'unliked' | 'error'
  data: ReviewReactionState | null
  error: ReviewError | null
}

interface DeleteReviewResult {
  ok: boolean
  error: ReviewError | null
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmedValue = value?.trim() || ''
  return trimmedValue ? trimmedValue : null
}

function validateSaveReviewParams({
  userId,
  gameId,
  nota,
}: SaveReviewParams): ReviewError | null {
  if (!userId.trim()) {
    return {
      message: 'Nao foi possivel identificar o usuario da review.',
    }
  }

  if (!Number.isInteger(gameId) || gameId <= 0) {
    return {
      message: 'Nao foi possivel identificar o jogo da review.',
    }
  }

  if (!Number.isFinite(nota) || nota < 1 || nota > 10) {
    return {
      message: 'Escolha uma nota de 1 a 10 para publicar a review.',
    }
  }

  return null
}

export async function saveReview({
  userId,
  gameId,
  nota,
  textoReview,
}: SaveReviewParams): Promise<SaveReviewResult> {
  const validationError = validateSaveReviewParams({ userId, gameId, nota, textoReview })

  if (validationError) {
    return {
      status: 'error',
      error: validationError,
    }
  }

  const normalizedText = normalizeOptionalText(textoReview)

  try {
    const { data: existingReview, error: existingReviewError } = await supabase
      .from('avaliacoes')
      .select('id')
      .eq('usuario_id', userId)
      .eq('jogo_id', gameId)
      .maybeSingle()

    if (existingReviewError) {
      return {
        status: 'error',
        error: normalizeReviewError(
          existingReviewError,
          'Nao foi possivel verificar a review atual deste jogo.'
        ),
      }
    }

    if (existingReview?.id) {
      const { error } = await supabase
        .from('avaliacoes')
        .update({
          nota,
          texto_review: normalizedText,
        })
        .eq('id', existingReview.id)
        .eq('usuario_id', userId)

      if (error) {
        return {
          status: 'error',
          error: normalizeReviewError(error, 'Nao foi possivel atualizar a review deste jogo.'),
        }
      }

      return {
        status: 'updated',
        error: null,
      }
    }

    const { error } = await supabase.from('avaliacoes').insert({
      usuario_id: userId,
      jogo_id: gameId,
      nota,
      texto_review: normalizedText,
    })

    if (error) {
      return {
        status: 'error',
        error: normalizeReviewError(error, 'Nao foi possivel criar a review deste jogo.'),
      }
    }

    return {
      status: 'created',
      error: null,
    }
  } catch (error) {
    return {
      status: 'error',
      error: normalizeReviewError(error, 'Erro inesperado ao salvar a review deste jogo.'),
    }
  }
}

export async function toggleReviewLike({
  reviewId,
  userId,
  reviewAuthorId,
}: ToggleReviewLikeParams): Promise<ToggleReviewLikeResult> {
  if (userId === reviewAuthorId) {
    return {
      status: 'error',
      data: null,
      error: {
        message: 'Voce nao pode curtir a propria review.',
      },
    }
  }

  const result = await toggleContentReaction('review', reviewId, 'like')

  if (result.status !== 'liked' && result.status !== 'unliked') {
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

export async function createReviewComment({
  userId,
  reviewId,
  texto,
}: CreateReviewCommentParams): Promise<ReviewServiceResult<null>> {
  const normalizedText = texto.trim()

  if (!normalizedText) {
    return {
      data: null,
      error: {
        message: 'O comentario nao pode ser enviado vazio.',
      },
    }
  }

  try {
    const { error } = await supabase.from('comentarios').insert({
      usuario_id: userId,
      review_id: reviewId,
      texto: normalizedText,
    })

    if (error) {
      return {
        data: null,
        error: normalizeReviewError(error, 'Nao foi possivel publicar o comentario desta review.'),
      }
    }

    return {
      data: null,
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: normalizeReviewError(error, 'Erro inesperado ao publicar o comentario desta review.'),
    }
  }
}

export async function deleteReviewComment({
  userId,
  commentId,
}: DeleteReviewCommentParams): Promise<DeleteReviewResult> {
  try {
    const { data, error } = await supabase
      .from('comentarios')
      .delete()
      .eq('id', commentId)
      .eq('usuario_id', userId)
      .select('id')
      .maybeSingle()

    if (error) {
      return {
        ok: false,
        error: normalizeReviewError(error, 'Nao foi possivel apagar este comentario.'),
      }
    }

    if (!data) {
      return {
        ok: false,
        error: {
          message: 'Voce nao tem permissao para apagar este comentario ou ele nao existe mais.',
        },
      }
    }

    return {
      ok: true,
      error: null,
    }
  } catch (error) {
    return {
      ok: false,
      error: normalizeReviewError(error, 'Erro inesperado ao apagar este comentario.'),
    }
  }
}

export async function deleteReview({
  userId,
  reviewId,
}: DeleteReviewParams): Promise<DeleteReviewResult> {
  try {
    const { data, error } = await supabase
      .from('avaliacoes')
      .delete()
      .eq('id', reviewId)
      .eq('usuario_id', userId)
      .select('id')
      .maybeSingle()

    if (error) {
      return {
        ok: false,
        error: normalizeReviewError(error, 'Nao foi possivel apagar esta review.'),
      }
    }

    if (!data) {
      return {
        ok: false,
        error: {
          message: 'Voce nao tem permissao para apagar esta review ou ela nao existe mais.',
        },
      }
    }

    return {
      ok: true,
      error: null,
    }
  } catch (error) {
    return {
      ok: false,
      error: normalizeReviewError(error, 'Erro inesperado ao apagar esta review.'),
    }
  }
}
