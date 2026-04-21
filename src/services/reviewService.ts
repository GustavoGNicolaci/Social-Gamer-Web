import { supabase } from '../supabase-client'
import type { CatalogGamePreview } from './gameCatalogService'

export interface ReviewError {
  code?: string
  message: string
  details?: string | null
  hint?: string | null
}

export interface ReviewAuthor {
  username: string
  avatar_url: string | null
}

export interface ReviewGamePreview extends Pick<CatalogGamePreview, 'id' | 'titulo' | 'capa_url'> {}

export interface ReviewComment {
  id: string
  usuario_id: string
  review_id: string
  texto: string
  data_comentario: string
  editado_em: string | null
  usuario: ReviewAuthor | null
}

export interface ReviewItem {
  id: string
  usuario_id: string
  jogo_id: number
  nota: number
  texto_review: string | null
  curtidas: number
  data_publicacao: string
  editado_em: string | null
  usuario: ReviewAuthor | null
  comentarios: ReviewComment[]
  likedByCurrentUser: boolean
  canLike: boolean
}

export interface ProfileReviewItem extends ReviewItem {
  jogo: ReviewGamePreview | null
}

interface ServiceResult<T> {
  data: T
  error: ReviewError | null
}

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
}

interface CreateReviewCommentParams {
  userId: string
  reviewId: string
  texto: string
}

interface DeleteReviewParams {
  userId: string
  reviewId: string
}

interface ReviewAuthorRow {
  username: string
  avatar_url: string | null
}

type ReviewAuthorRelation = ReviewAuthorRow | ReviewAuthorRow[] | null
type ReviewGameRelation = ReviewGamePreview | ReviewGamePreview[] | null

interface ReviewCommentRow {
  id: string
  usuario_id: string
  review_id: string
  texto: string
  data_comentario: string
  editado_em: string | null
  usuario: ReviewAuthorRelation
}

interface ReviewRow {
  id: string
  usuario_id: string
  jogo_id: number
  nota: number | string
  texto_review: string | null
  curtidas: number | string | null
  data_publicacao: string
  editado_em: string | null
  usuario: ReviewAuthorRelation
  comentarios?: ReviewCommentRow[] | null
  jogo?: ReviewGameRelation
}

interface SaveReviewResult {
  status: 'created' | 'updated' | 'error'
  error: ReviewError | null
}

interface ToggleReviewLikeResult {
  status: 'liked' | 'unliked' | 'error'
  error: ReviewError | null
}

interface DeleteReviewResult {
  ok: boolean
  error: ReviewError | null
}

const GAME_REVIEW_SELECT = `
  id,
  usuario_id,
  jogo_id,
  nota,
  texto_review,
  curtidas,
  data_publicacao,
  editado_em,
  usuario:usuarios(username, avatar_url),
  comentarios(
    id,
    usuario_id,
    review_id,
    texto,
    data_comentario,
    editado_em,
    usuario:usuarios(username, avatar_url)
  )
`

const PROFILE_REVIEW_SELECT = `
  id,
  usuario_id,
  jogo_id,
  nota,
  texto_review,
  curtidas,
  data_publicacao,
  editado_em,
  usuario:usuarios(username, avatar_url),
  jogo:jogos(id, titulo, capa_url)
`

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

function resolveSingleRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmedValue = value?.trim() || ''
  return trimmedValue ? trimmedValue : null
}

function getTimestamp(value: string | null | undefined) {
  if (!value) return 0

  const parsedDate = new Date(value)
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime()
}

function normalizeReviewComment(row: ReviewCommentRow): ReviewComment {
  return {
    id: row.id,
    usuario_id: row.usuario_id,
    review_id: row.review_id,
    texto: row.texto,
    data_comentario: row.data_comentario,
    editado_em: row.editado_em,
    usuario: resolveSingleRelation(row.usuario),
  }
}

function normalizeReviewItem(row: ReviewRow, currentUserId?: string | null): ReviewItem {
  const comentarios = (row.comentarios || [])
    .map(normalizeReviewComment)
    .sort((leftComment, rightComment) => {
      return getTimestamp(leftComment.data_comentario) - getTimestamp(rightComment.data_comentario)
    })

  return {
    id: row.id,
    usuario_id: row.usuario_id,
    jogo_id: row.jogo_id,
    nota: Number(row.nota),
    texto_review: normalizeOptionalText(row.texto_review),
    curtidas: Number(row.curtidas || 0),
    data_publicacao: row.data_publicacao,
    editado_em: row.editado_em,
    usuario: resolveSingleRelation(row.usuario),
    comentarios,
    likedByCurrentUser: false,
    canLike: Boolean(currentUserId) && currentUserId !== row.usuario_id,
  }
}

function normalizeProfileReviewItem(row: ReviewRow): ProfileReviewItem {
  return {
    ...normalizeReviewItem(row, null),
    jogo: resolveSingleRelation(row.jogo),
  }
}

async function getLikedReviewIds(reviewIds: string[], userId: string): Promise<ServiceResult<Set<string>>> {
  try {
    const { data, error } = await supabase
      .from('avaliacao_curtidas')
      .select('avaliacao_id')
      .eq('usuario_id', userId)
      .in('avaliacao_id', reviewIds)

    if (error) {
      return {
        data: new Set<string>(),
        error: normalizeReviewError(error, 'Nao foi possivel carregar o estado das curtidas.'),
      }
    }

    return {
      data: new Set((data || []).map(item => item.avaliacao_id as string)),
      error: null,
    }
  } catch (error) {
    return {
      data: new Set<string>(),
      error: normalizeReviewError(error, 'Erro inesperado ao carregar o estado das curtidas.'),
    }
  }
}

export async function getReviewsByGameId(
  gameId: number,
  currentUserId?: string | null
): Promise<ServiceResult<ReviewItem[]>> {
  try {
    const { data, error } = await supabase
      .from('avaliacoes')
      .select(GAME_REVIEW_SELECT)
      .eq('jogo_id', gameId)
      .order('data_publicacao', { ascending: false })

    if (error) {
      return {
        data: [],
        error: normalizeReviewError(error, 'Nao foi possivel carregar as reviews deste jogo.'),
      }
    }

    const normalizedReviews = ((data || []) as ReviewRow[]).map(row =>
      normalizeReviewItem(row, currentUserId)
    )

    if (!currentUserId || normalizedReviews.length === 0) {
      return {
        data: normalizedReviews,
        error: null,
      }
    }

    const likedIdsResult = await getLikedReviewIds(
      normalizedReviews.map(review => review.id),
      currentUserId
    )

    const reviewsWithLikeState = normalizedReviews.map(review => ({
      ...review,
      likedByCurrentUser: likedIdsResult.data.has(review.id),
    }))

    return {
      data: reviewsWithLikeState,
      error: likedIdsResult.error,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeReviewError(error, 'Erro inesperado ao carregar as reviews deste jogo.'),
    }
  }
}

export async function getReviewsByUserId(userId: string): Promise<ServiceResult<ProfileReviewItem[]>> {
  try {
    const { data, error } = await supabase
      .from('avaliacoes')
      .select(PROFILE_REVIEW_SELECT)
      .eq('usuario_id', userId)
      .order('data_publicacao', { ascending: false })

    if (error) {
      return {
        data: [],
        error: normalizeReviewError(error, 'Nao foi possivel carregar as reviews do perfil.'),
      }
    }

    return {
      data: ((data || []) as ReviewRow[]).map(normalizeProfileReviewItem),
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeReviewError(error, 'Erro inesperado ao carregar as reviews do perfil.'),
    }
  }
}

export async function saveReview({
  userId,
  gameId,
  nota,
  textoReview,
}: SaveReviewParams): Promise<SaveReviewResult> {
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
      curtidas: 0,
      data_publicacao: new Date().toISOString(),
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
  likedByCurrentUser,
}: ToggleReviewLikeParams): Promise<ToggleReviewLikeResult> {
  if (userId === reviewAuthorId) {
    return {
      status: 'error',
      error: {
        message: 'Voce nao pode curtir a propria review.',
      },
    }
  }

  try {
    if (likedByCurrentUser) {
      const { error } = await supabase
        .from('avaliacao_curtidas')
        .delete()
        .eq('avaliacao_id', reviewId)
        .eq('usuario_id', userId)

      if (error) {
        return {
          status: 'error',
          error: normalizeReviewError(error, 'Nao foi possivel remover a curtida desta review.'),
        }
      }

      return {
        status: 'unliked',
        error: null,
      }
    }

    const { error } = await supabase.from('avaliacao_curtidas').insert({
      avaliacao_id: reviewId,
      usuario_id: userId,
    })

    if (error) {
      return {
        status: 'error',
        error: normalizeReviewError(error, 'Nao foi possivel curtir esta review.'),
      }
    }

    return {
      status: 'liked',
      error: null,
    }
  } catch (error) {
    return {
      status: 'error',
      error: normalizeReviewError(error, 'Erro inesperado ao atualizar a curtida desta review.'),
    }
  }
}

export async function createReviewComment({
  userId,
  reviewId,
  texto,
}: CreateReviewCommentParams): Promise<ServiceResult<null>> {
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
      data_comentario: new Date().toISOString(),
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
