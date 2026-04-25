import { supabase } from '../supabase-client'

export interface HomeError {
  code?: string
  message: string
  details?: string | null
  hint?: string | null
}

export interface HomeAuthor {
  id: string
  username: string
  name: string
  avatarPath: string | null
}

export interface HomeGameSummary {
  id: number
  title: string
  coverUrl: string | null
  genres: string[]
  releaseDate: string | null
}

export type HomeActivityType = 'review' | 'status' | 'favorite'

export interface HomeFollowingActivity {
  id: string
  type: HomeActivityType
  reviewId: string | null
  statusId: string | null
  author: HomeAuthor
  game: HomeGameSummary
  summary: string
  score: number | null
  statusValue: string | null
  isFavorite: boolean
  createdAt: string
}

export interface HomeTrendingReview {
  id: string
  reviewId: string
  author: HomeAuthor
  game: HomeGameSummary
  summary: string
  score: number | null
  likesCount: number
  publishedAt: string
}

export interface HomeFeaturedGame extends HomeGameSummary {
  recentReviewCount: number
  totalReviewCount: number
  averageRating: number | null
  latestReviewAt: string | null
}

export interface HomeSiteStats {
  games: number
  reviews: number
}

interface HomeResult<T> {
  data: T
  error: HomeError | null
}

interface FollowingActivityRow {
  activity_id: string
  activity_type: string
  review_id: string | null
  status_id: string | null
  author_id: string
  author_username: string | null
  author_name: string | null
  author_avatar_path: string | null
  game_id: number | string
  game_title: string | null
  game_cover_url: string | null
  game_genres: unknown
  score: number | string | null
  text_review: string | null
  status_value: string | null
  is_favorite: boolean | null
  activity_created_at: string
}

interface TrendingReviewRow {
  review_id: string
  author_id: string
  author_username: string | null
  author_name: string | null
  author_avatar_path: string | null
  game_id: number | string
  game_title: string | null
  game_cover_url: string | null
  game_genres: unknown
  score: number | string | null
  text_review: string | null
  likes_count: number | string | null
  published_at: string
}

interface FeaturedGameRow {
  game_id: number | string
  game_title: string | null
  game_cover_url: string | null
  game_genres: unknown
  release_date: string | null
  recent_review_count: number | string | null
  total_review_count: number | string | null
  average_rating: number | string | null
  latest_review_at: string | null
}

interface ReleaseGameRow {
  id: number
  titulo: string
  capa_url: string | null
  generos: unknown
  data_lancamento: string | null
}

function normalizeHomeError(error: unknown, fallbackMessage: string): HomeError {
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

function normalizeString(value: string | null | undefined, fallback: string) {
  const trimmedValue = value?.trim() || ''
  return trimmedValue || fallback
}

function normalizeNumber(value: number | string | null | undefined) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : null
}

function normalizeInteger(value: number | string | null | undefined) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

function normalizeList(value: unknown): string[] {
  if (!value) return []

  if (Array.isArray(value)) {
    return value
      .map(item => (typeof item === 'string' ? item.trim() : String(item).trim()))
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
  }

  return []
}

function truncateText(value: string | null | undefined, maxLength = 150) {
  const trimmedValue = value?.trim() || ''

  if (!trimmedValue) return ''
  if (trimmedValue.length <= maxLength) return trimmedValue

  return `${trimmedValue.slice(0, maxLength - 3).trim()}...`
}

function getLocalTodayIsoDate() {
  const now = new Date()
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 10)
}

function normalizeAuthor(row: {
  author_id: string
  author_username: string | null
  author_name: string | null
  author_avatar_path: string | null
}): HomeAuthor {
  const username = normalizeString(row.author_username, 'usuario')

  return {
    id: row.author_id,
    username,
    name: normalizeString(row.author_name, username),
    avatarPath: row.author_avatar_path || null,
  }
}

function normalizeGame(row: {
  game_id: number | string
  game_title: string | null
  game_cover_url: string | null
  game_genres: unknown
  release_date?: string | null
}): HomeGameSummary {
  return {
    id: normalizeInteger(row.game_id),
    title: normalizeString(row.game_title, 'Jogo desconhecido'),
    coverUrl: row.game_cover_url || null,
    genres: normalizeList(row.game_genres),
    releaseDate: row.release_date || null,
  }
}

function getStatusLabel(statusValue: string | null | undefined) {
  if (statusValue === 'zerado') return 'zerou'
  if (statusValue === 'dropado') return 'dropou'
  return 'comecou a jogar'
}

function normalizeActivityType(value: string): HomeActivityType {
  if (value === 'favorite') return 'favorite'
  if (value === 'status') return 'status'
  return 'review'
}

function buildFollowingActivitySummary(row: FollowingActivityRow) {
  const type = normalizeActivityType(row.activity_type)

  if (type === 'review') {
    return truncateText(row.text_review) || 'Publicou uma review na comunidade.'
  }

  if (row.is_favorite) {
    return 'Adicionou este jogo aos favoritos.'
  }

  return `Adicionou este jogo ao perfil e ${getStatusLabel(row.status_value)}.`
}

function normalizeFollowingActivity(row: FollowingActivityRow): HomeFollowingActivity {
  const type = normalizeActivityType(row.activity_type)

  return {
    id: row.activity_id,
    type,
    reviewId: row.review_id,
    statusId: row.status_id,
    author: normalizeAuthor(row),
    game: normalizeGame(row),
    summary: buildFollowingActivitySummary(row),
    score: normalizeNumber(row.score),
    statusValue: row.status_value || null,
    isFavorite: Boolean(row.is_favorite),
    createdAt: row.activity_created_at,
  }
}

function normalizeTrendingReview(row: TrendingReviewRow): HomeTrendingReview {
  return {
    id: row.review_id,
    reviewId: row.review_id,
    author: normalizeAuthor(row),
    game: normalizeGame(row),
    summary: truncateText(row.text_review) || 'Review em alta na comunidade.',
    score: normalizeNumber(row.score),
    likesCount: normalizeInteger(row.likes_count),
    publishedAt: row.published_at,
  }
}

function normalizeFeaturedGame(row: FeaturedGameRow): HomeFeaturedGame {
  return {
    ...normalizeGame(row),
    releaseDate: row.release_date || null,
    recentReviewCount: normalizeInteger(row.recent_review_count),
    totalReviewCount: normalizeInteger(row.total_review_count),
    averageRating: normalizeNumber(row.average_rating),
    latestReviewAt: row.latest_review_at || null,
  }
}

function normalizeReleaseGame(row: ReleaseGameRow): HomeGameSummary {
  return {
    id: row.id,
    title: normalizeString(row.titulo, 'Jogo desconhecido'),
    coverUrl: row.capa_url || null,
    genres: normalizeList(row.generos),
    releaseDate: row.data_lancamento || null,
  }
}

async function getFallbackFeaturedGames(limit: number): Promise<HomeResult<HomeFeaturedGame[]>> {
  try {
    const { data, error } = await supabase
      .from('jogos')
      .select('id, titulo, capa_url, generos, data_lancamento')
      .order('id', { ascending: false })
      .limit(limit)

    if (error) {
      return {
        data: [],
        error: normalizeHomeError(error, 'Nao foi possivel carregar jogos em destaque.'),
      }
    }

    return {
      data: ((data || []) as ReleaseGameRow[]).map(game => ({
        ...normalizeReleaseGame(game),
        recentReviewCount: 0,
        totalReviewCount: 0,
        averageRating: null,
        latestReviewAt: null,
      })),
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeHomeError(error, 'Erro inesperado ao carregar jogos em destaque.'),
    }
  }
}

export async function getHomeSiteStats(): Promise<HomeResult<HomeSiteStats>> {
  try {
    const [gameCountResponse, reviewCountResponse] = await Promise.all([
      supabase.from('jogos').select('id', { count: 'exact', head: true }),
      supabase.from('avaliacoes').select('id', { count: 'exact', head: true }),
    ])

    return {
      data: {
        games: gameCountResponse.count || 0,
        reviews: reviewCountResponse.count || 0,
      },
      error: gameCountResponse.error || reviewCountResponse.error
        ? normalizeHomeError(
            gameCountResponse.error || reviewCountResponse.error,
            'Nao foi possivel carregar os numeros da plataforma.'
          )
        : null,
    }
  } catch (error) {
    return {
      data: {
        games: 0,
        reviews: 0,
      },
      error: normalizeHomeError(error, 'Erro inesperado ao carregar os numeros da plataforma.'),
    }
  }
}

export async function getHomeFollowingActivities(
  limit = 8,
  currentUserId?: string | null
): Promise<HomeResult<HomeFollowingActivity[]>> {
  if (!currentUserId) {
    return {
      data: [],
      error: null,
    }
  }

  try {
    const { data, error } = await supabase.rpc('get_home_following_activities', {
      activity_limit: limit,
    })

    if (error) {
      return {
        data: [],
        error: normalizeHomeError(error, 'Nao foi possivel carregar atividades de quem voce segue.'),
      }
    }

    return {
      data: ((data || []) as FollowingActivityRow[]).map(normalizeFollowingActivity),
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeHomeError(
        error,
        'Erro inesperado ao carregar atividades de quem voce segue.'
      ),
    }
  }
}

export async function getHomeTrendingReviews({
  minLikes = 20,
  limit = 6,
  excludedReviewIds = [],
}: {
  minLikes?: number
  limit?: number
  excludedReviewIds?: string[]
} = {}): Promise<HomeResult<HomeTrendingReview[]>> {
  try {
    const { data, error } = await supabase.rpc('get_home_trending_reviews', {
      min_likes: minLikes,
      review_limit: limit,
      excluded_review_ids: excludedReviewIds,
    })

    if (error) {
      return {
        data: [],
        error: normalizeHomeError(error, 'Nao foi possivel carregar reviews em alta.'),
      }
    }

    return {
      data: ((data || []) as TrendingReviewRow[]).map(normalizeTrendingReview),
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeHomeError(error, 'Erro inesperado ao carregar reviews em alta.'),
    }
  }
}

export async function getHomeFeaturedRecentReviewedGames({
  daysWindow = 30,
  limit = 4,
}: {
  daysWindow?: number
  limit?: number
} = {}): Promise<HomeResult<HomeFeaturedGame[]>> {
  try {
    const { data, error } = await supabase.rpc('get_home_featured_recent_reviewed_games', {
      days_window: daysWindow,
      games_limit: limit,
    })

    if (error) {
      console.error('Erro ao carregar jogos por reviews recentes:', error)
      return getFallbackFeaturedGames(limit)
    }

    return {
      data: ((data || []) as FeaturedGameRow[]).map(normalizeFeaturedGame),
      error: null,
    }
  } catch (error) {
    console.error('Erro inesperado ao carregar jogos por reviews recentes:', error)
    return getFallbackFeaturedGames(limit)
  }
}

export async function getHomeNewReleases(limit = 36): Promise<HomeResult<HomeGameSummary[]>> {
  try {
    const { data, error } = await supabase
      .from('jogos')
      .select('id, titulo, capa_url, generos, data_lancamento')
      .not('data_lancamento', 'is', null)
      .lte('data_lancamento', getLocalTodayIsoDate())
      .order('data_lancamento', { ascending: false })
      .limit(limit)

    if (error) {
      return {
        data: [],
        error: normalizeHomeError(error, 'Nao foi possivel carregar os lancamentos.'),
      }
    }

    return {
      data: ((data || []) as ReleaseGameRow[]).map(normalizeReleaseGame),
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeHomeError(error, 'Erro inesperado ao carregar os lancamentos.'),
    }
  }
}
