import { supabase } from '../../../supabase-client'
import { translate } from '../../../i18n'
import {
  getPerformanceNow,
  logPerformanceTiming,
} from '../../../utils/performanceDiagnostics'
import { normalizeReviewError } from '../domain/reviewError'
import type {
  ProfileReviewItem,
  RecentReviewActivity,
  ReviewGamePreview,
  ReviewServiceResult,
} from '../domain/reviewModels'

interface GetProfileReviewsOptions {
  currentUserId?: string | null
  includeRestrictedAuthorReviews?: boolean
}

interface GetProfileReviewsPageOptions extends GetProfileReviewsOptions {
  page?: number
  pageSize?: number
}

interface ProfileReviewsQueryTimings {
  totalMs: number
  queryMs: number
  normalizeMs: number
  requestCount: number
  privacyFilterMs: number
}

interface PaginatedServiceResult<T> extends ReviewServiceResult<T> {
  totalCount: number | null
  hasMore: boolean
  nextPage: number | null
  timings: ProfileReviewsQueryTimings
}

interface ReviewAuthorRow {
  id?: string
  username: string
  avatar_path: string | null
}

type ReviewAuthorRelation = ReviewAuthorRow | ReviewAuthorRow[] | null
type ReviewGameRelation = ReviewGamePreview | ReviewGamePreview[] | null

interface ProfileReviewRow {
  id: string
  usuario_id: string | null
  jogo_id: number | null
  nota: number | string | null
  texto_review: string | null
  curtidas: number | string | null
  data_publicacao: string | null
  editado_em: string | null
  usuario: ReviewAuthorRelation
  jogo?: ReviewGameRelation
}

interface RecentReviewActivityRow {
  id: string
  nota: number | null
  data_publicacao: string
  jogos: { titulo: string } | { titulo: string }[] | null
  usuarios: ReviewAuthorRelation
}

const PROFILE_REVIEW_SELECT = `
  id,
  usuario_id,
  jogo_id,
  nota,
  texto_review,
  curtidas,
  data_publicacao,
  editado_em,
  usuario:usuarios(id, username, avatar_path),
  jogo:jogos(id, titulo, capa_url)
`

const RECENT_REVIEW_ACTIVITY_SELECT = `
  id,
  nota,
  data_publicacao,
  jogos!inner(titulo),
  usuarios!inner(id, username, avatar_path)
`

const DEFAULT_PROFILE_REVIEWS_PAGE_SIZE = 6

function resolveSingleRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmedValue = value?.trim() || ''
  return trimmedValue ? trimmedValue : null
}

function isCompleteProfileReviewRow(
  row: ProfileReviewRow
): row is ProfileReviewRow & {
  usuario_id: string
  jogo_id: number
  nota: number | string
  data_publicacao: string
} {
  return Boolean(
    row.id &&
    row.usuario_id &&
    row.jogo_id &&
    row.nota !== null &&
    row.data_publicacao
  )
}

function normalizeProfileReviewItem(row: ProfileReviewRow & {
  usuario_id: string
  jogo_id: number
  nota: number | string
  data_publicacao: string
}): ProfileReviewItem {
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
    comentarios: [],
    likedByCurrentUser: false,
    canLike: false,
    dislikes: 0,
    dislikedByCurrentUser: false,
    canDislike: false,
    currentUserReport: null,
    jogo: resolveSingleRelation(row.jogo),
  }
}

function normalizeProfileReviewsPageOptions(
  options: GetProfileReviewsPageOptions = {}
) {
  const page = Math.max(0, options.page || 0)
  const pageSize = Math.min(
    Math.max(1, options.pageSize || DEFAULT_PROFILE_REVIEWS_PAGE_SIZE),
    36
  )
  const from = page * pageSize
  const to = from + pageSize - 1

  return {
    ...options,
    page,
    pageSize,
    from,
    to,
  }
}

function buildProfileReviewsPageMetadata(
  totalCount: number | null,
  page: number,
  pageSize: number,
  itemCount: number
) {
  const loadedCount = page * pageSize + itemCount
  const hasMore =
    totalCount === null ? itemCount === pageSize : loadedCount < totalCount

  return {
    totalCount,
    hasMore,
    nextPage: hasMore ? page + 1 : null,
  }
}

function normalizeRecentReviewActivity(
  row: RecentReviewActivityRow
): RecentReviewActivity {
  const reviewGame = resolveSingleRelation(row.jogos)
  const reviewUser = resolveSingleRelation(row.usuarios)

  return {
    id: row.id,
    authorName: reviewUser?.username || 'Usuario',
    authorAvatar: reviewUser?.avatar_path || null,
    gameTitle: reviewGame?.titulo || translate('common.unknownGame'),
    summary: 'Publicou uma review na comunidade.',
    score: row.nota ?? null,
    publishedAt: row.data_publicacao,
  }
}

export async function getReviewsByUserId(
  userId: string,
  options: GetProfileReviewsOptions = {}
): Promise<ReviewServiceResult<ProfileReviewItem[]>> {
  void options

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

    const reviewRows = (data || []) as ProfileReviewRow[]

    return {
      data: reviewRows
        .filter(isCompleteProfileReviewRow)
        .map(normalizeProfileReviewItem),
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeReviewError(error, 'Erro inesperado ao carregar as reviews do perfil.'),
    }
  }
}

export async function getReviewsPageByUserId(
  userId: string,
  pageOptions: GetProfileReviewsPageOptions = {}
): Promise<PaginatedServiceResult<ProfileReviewItem[]>> {
  const options = normalizeProfileReviewsPageOptions(pageOptions)
  const startedAt = getPerformanceNow()
  const timings: ProfileReviewsQueryTimings = {
    totalMs: 0,
    queryMs: 0,
    normalizeMs: 0,
    requestCount: 0,
    privacyFilterMs: 0,
  }

  try {
    const queryStartedAt = getPerformanceNow()
    const { data, error, count } = await supabase
      .from('avaliacoes')
      .select(PROFILE_REVIEW_SELECT, { count: 'exact' })
      .eq('usuario_id', userId)
      .order('data_publicacao', { ascending: false })
      .range(options.from, options.to)

    timings.requestCount += 1
    timings.queryMs += getPerformanceNow() - queryStartedAt

    if (error) {
      timings.totalMs = getPerformanceNow() - startedAt
      logPerformanceTiming('profile.reviews.page', timings.totalMs, {
        userId,
        page: options.page,
        pageSize: options.pageSize,
        requestCount: timings.requestCount,
        hasError: true,
      })

      return {
        data: [],
        error: normalizeReviewError(error, 'Nao foi possivel carregar as reviews do perfil.'),
        totalCount: null,
        hasMore: false,
        nextPage: null,
        timings,
      }
    }

    const reviewRows = (data || []) as ProfileReviewRow[]
    const normalizeStartedAt = getPerformanceNow()
    const items = reviewRows
      .filter(isCompleteProfileReviewRow)
      .map(normalizeProfileReviewItem)
    timings.normalizeMs += getPerformanceNow() - normalizeStartedAt
    timings.totalMs = getPerformanceNow() - startedAt

    const result: PaginatedServiceResult<ProfileReviewItem[]> = {
      data: items,
      error: null,
      ...buildProfileReviewsPageMetadata(
        count,
        options.page,
        options.pageSize,
        items.length
      ),
      timings,
    }

    logPerformanceTiming('profile.reviews.page', timings.totalMs, {
      userId,
      page: options.page,
      pageSize: options.pageSize,
      requestCount: timings.requestCount,
      totalCount: result.totalCount,
      itemCount: result.data.length,
    })

    return result
  } catch (error) {
    timings.totalMs = getPerformanceNow() - startedAt
    logPerformanceTiming('profile.reviews.page', timings.totalMs, {
      userId,
      page: options.page,
      pageSize: options.pageSize,
      requestCount: timings.requestCount,
      hasError: true,
    })

    return {
      data: [],
      error: normalizeReviewError(error, 'Erro inesperado ao carregar as reviews do perfil.'),
      totalCount: null,
      hasMore: false,
      nextPage: null,
      timings,
    }
  }
}

export async function getRecentPublicReviewActivities(
  limit = 6,
  currentUserId?: string | null
): Promise<ReviewServiceResult<RecentReviewActivity[]>> {
  void currentUserId

  try {
    const { data, error } = await supabase
      .from('avaliacoes')
      .select(RECENT_REVIEW_ACTIVITY_SELECT)
      .order('data_publicacao', { ascending: false })
      .limit(Math.max(limit * 3, limit))

    if (error) {
      return {
        data: [],
        error: normalizeReviewError(error, 'Nao foi possivel carregar as reviews recentes.'),
      }
    }

    return {
      data: ((data || []) as RecentReviewActivityRow[])
        .map(normalizeRecentReviewActivity)
        .slice(0, limit),
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeReviewError(error, 'Erro inesperado ao carregar as reviews recentes.'),
    }
  }
}

export type {
  ProfileReviewItem,
  RecentReviewActivity,
  ReviewAuthor,
  ReviewGamePreview,
} from '../domain/reviewModels'
