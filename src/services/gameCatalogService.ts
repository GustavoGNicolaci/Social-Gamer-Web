import { getRuntimeLocale } from '../i18n'
import { supabase } from '../supabase-client'
import {
  normalizeGameDetails,
  normalizeGamePreview,
  type GameDetails,
  type GameDetailsSourceRow,
  type GamePreview,
  type GamePreviewSourceRow,
} from './gameAdapter'

export interface GameCatalogError {
  code?: string
  message: string
  details?: string | null
  hint?: string | null
}

export type CatalogGamePreview = GamePreview
export type CatalogGameDetails = GameDetails
export type CatalogSortOption = 'release-desc' | 'release-asc' | 'rating-desc' | 'rating-asc'

interface CatalogResult<T> {
  data: T
  error: GameCatalogError | null
}

interface SearchCatalogGamesOptions {
  limit?: number
  importIfMissing?: boolean
}

export interface CatalogGamesPageOptions {
  page?: number
  pageSize?: number
  query?: string
  genres?: string[]
  platforms?: string[]
  developers?: string[]
  sort?: CatalogSortOption
}

export interface CatalogGamesPage {
  items: CatalogGamePreview[]
  totalCount: number
  totalPages: number
  page: number
  pageSize: number
}

export interface CatalogFacetOptions {
  genres: string[]
  platforms: string[]
  developers: string[]
}

interface GameCatalogFunctionBody {
  action: 'catalog' | 'search' | 'details' | 'facets'
  locale?: string
  page?: number
  pageSize?: number
  query?: string
  sort?: CatalogSortOption
  filters?: {
    genres: string[]
    platforms: string[]
    developers: string[]
  }
  gameId?: number
  igdbId?: number
}

interface GameCatalogFunctionListResponse {
  items?: GamePreviewSourceRow[]
  page?: number | string
  pageSize?: number | string
  hasNextPage?: boolean
  totalCount?: number | string | null
  error?: string
}

interface GameCatalogFunctionFacetsResponse {
  genres?: string[]
  platforms?: string[]
  developers?: string[]
  error?: string
}

interface GameCatalogFunctionDetailsResponse {
  game?: GameDetailsSourceRow
  error?: string
}

interface GameExternalIdRow {
  jogo_id: number | string | null
  external_id: string | null
}

const DEFAULT_SEARCH_LIMIT = 8
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100
const CATALOG_GAME_SELECT =
  'id, titulo, capa_url, desenvolvedora, generos, data_lancamento, plataformas, source_primary, status_importacao'

function normalizeCatalogError(error: unknown, fallbackMessage: string): GameCatalogError {
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

function normalizeNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsedValue = Number(value)
    return Number.isFinite(parsedValue) ? parsedValue : null
  }

  return null
}

function normalizeInteger(value: unknown) {
  const normalizedValue = normalizeNumber(value)
  return normalizedValue === null ? 0 : Math.max(0, Math.trunc(normalizedValue))
}

function normalizeNullableInteger(value: unknown) {
  const normalizedValue = normalizeNumber(value)
  return normalizedValue === null ? null : Math.max(0, Math.trunc(normalizedValue))
}

function normalizePositiveInteger(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(1, Math.min(Math.trunc(value), max))
}

function normalizeStringFilters(values: string[] | undefined) {
  return Array.from(new Set((values || []).map(value => value.trim()).filter(Boolean)))
}

function mapFunctionErrorCode(code: string | undefined) {
  if (code === 'server_misconfigured') {
    return 'A fonte externa de jogos nao esta configurada no backend.'
  }

  if (code === 'game_not_identified') {
    return 'Nao foi possivel identificar o jogo.'
  }

  return null
}

async function invokeGameCatalog<T>(
  body: GameCatalogFunctionBody,
  fallbackMessage: string
): Promise<CatalogResult<T | null>> {
  try {
    const { data, error } = await supabase.functions.invoke<T & { error?: string }>('game-catalog', {
      body: {
        locale: getRuntimeLocale(),
        ...body,
      },
    })

    if (error) {
      return {
        data: null,
        error: normalizeCatalogError(error, fallbackMessage),
      }
    }

    if (data?.error) {
      return {
        data: null,
        error: {
          code: data.error,
          message: mapFunctionErrorCode(data.error) || fallbackMessage,
        },
      }
    }

    return {
      data: data || null,
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: normalizeCatalogError(error, fallbackMessage),
    }
  }
}

function getEstimatedCatalogTotals({
  page,
  pageSize,
  itemCount,
  hasNextPage,
  totalCount,
}: {
  page: number
  pageSize: number
  itemCount: number
  hasNextPage: boolean
  totalCount: number | null
}) {
  if (totalCount !== null) {
    return {
      totalCount,
      totalPages: totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize),
    }
  }

  if (itemCount === 0) {
    return {
      totalCount: 0,
      totalPages: 0,
    }
  }

  const knownCount = (page - 1) * pageSize + itemCount
  const estimatedCount = hasNextPage ? knownCount + pageSize : knownCount

  return {
    totalCount: estimatedCount,
    totalPages: hasNextPage ? page + 1 : page,
  }
}

async function getIgdbIdsByGameId(gameIds: number[]) {
  const normalizedIds = Array.from(
    new Set(gameIds.filter(gameId => Number.isInteger(gameId) && gameId > 0))
  )

  if (normalizedIds.length === 0) {
    return new Map<number, string>()
  }

  const { data, error } = await supabase
    .from('game_external_ids')
    .select('jogo_id, external_id')
    .eq('provider', 'igdb')
    .in('jogo_id', normalizedIds)

  if (error) {
    return new Map<number, string>()
  }

  const externalIdsByGameId = new Map<number, string>()

  ;((data || []) as GameExternalIdRow[]).forEach(row => {
    const gameId = normalizeInteger(row.jogo_id)
    const externalId = row.external_id?.trim()
    if (gameId > 0 && externalId) externalIdsByGameId.set(gameId, externalId)
  })

  return externalIdsByGameId
}

async function attachIgdbIdsToGames<T extends CatalogGamePreview>(games: T[]): Promise<T[]> {
  if (games.length === 0) return games

  const igdbIdsByGameId = await getIgdbIdsByGameId(games.map(game => game.id))

  return games.map(game => ({
    ...game,
    igdbId: igdbIdsByGameId.get(game.id) || game.igdbId || null,
  }))
}

export async function searchCatalogGamesByTitle(
  query: string,
  options: SearchCatalogGamesOptions = {}
): Promise<CatalogResult<CatalogGamePreview[]>> {
  const normalizedQuery = query.trim()

  if (!normalizedQuery || normalizedQuery.length < 2) {
    return {
      data: [],
      error: null,
    }
  }

  const limit = normalizePositiveInteger(options.limit, DEFAULT_SEARCH_LIMIT, MAX_PAGE_SIZE)
  const result = await invokeGameCatalog<GameCatalogFunctionListResponse>(
    {
      action: 'search',
      query: normalizedQuery,
      page: 1,
      pageSize: limit,
    },
    'Nao foi possivel buscar jogos no catalogo externo.'
  )

  if (result.error || !result.data) {
    return {
      data: [],
      error: result.error,
    }
  }

  return {
    data: (result.data.items || []).map(row => normalizeGamePreview(row)),
    error: null,
  }
}

export async function getCatalogGamesPage(
  pageOptions: CatalogGamesPageOptions = {}
): Promise<CatalogResult<CatalogGamesPage>> {
  const page = normalizePositiveInteger(pageOptions.page, 1)
  const pageSize = normalizePositiveInteger(pageOptions.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
  const query = pageOptions.query?.trim() || ''
  const action = query.length >= 2 ? 'search' : 'catalog'
  const result = await invokeGameCatalog<GameCatalogFunctionListResponse>(
    {
      action,
      page,
      pageSize,
      query: action === 'search' ? query : undefined,
      sort: pageOptions.sort || 'release-desc',
      filters: {
        genres: normalizeStringFilters(pageOptions.genres),
        platforms: normalizeStringFilters(pageOptions.platforms),
        developers: normalizeStringFilters(pageOptions.developers),
      },
    },
    'Nao foi possivel carregar o catalogo de jogos externo.'
  )

  if (result.error || !result.data) {
    return {
      data: {
        items: [],
        totalCount: 0,
        totalPages: 0,
        page,
        pageSize,
      },
      error: result.error,
    }
  }

  const items = (result.data.items || []).map(row => normalizeGamePreview(row))
  const hasNextPage = Boolean(result.data.hasNextPage)
  const totals = getEstimatedCatalogTotals({
    page,
    pageSize,
    itemCount: items.length,
    hasNextPage,
    totalCount: normalizeNullableInteger(result.data.totalCount),
  })

  return {
    data: {
      items,
      ...totals,
      page,
      pageSize,
    },
    error: null,
  }
}

export async function getCatalogFacetOptions(
  query?: string
): Promise<CatalogResult<CatalogFacetOptions>> {
  const result = await invokeGameCatalog<GameCatalogFunctionFacetsResponse>(
    {
      action: 'facets',
      query: query?.trim() || undefined,
    },
    'Nao foi possivel carregar os filtros do catalogo externo.'
  )

  if (result.error || !result.data) {
    return {
      data: {
        genres: [],
        platforms: [],
        developers: [],
      },
      error: result.error,
    }
  }

  return {
    data: {
      genres: result.data.genres || [],
      platforms: result.data.platforms || [],
      developers: result.data.developers || [],
    },
    error: null,
  }
}

export async function getCatalogGamesByIds(
  gameIds: number[]
): Promise<CatalogResult<CatalogGamePreview[]>> {
  const normalizedIds = Array.from(
    new Set(gameIds.filter(gameId => Number.isInteger(gameId) && gameId > 0))
  )

  if (normalizedIds.length === 0) {
    return {
      data: [],
      error: null,
    }
  }

  try {
    const { data, error } = await supabase
      .from('jogos')
      .select(CATALOG_GAME_SELECT)
      .in('id', normalizedIds)

    if (error) {
      return {
        data: [],
        error: normalizeCatalogError(error, 'Nao foi possivel carregar os jogos selecionados.'),
      }
    }

    const games = ((data || []) as GamePreviewSourceRow[]).map(row => normalizeGamePreview(row))

    return {
      data: await attachIgdbIdsToGames(games),
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeCatalogError(error, 'Erro inesperado ao carregar os jogos selecionados.'),
    }
  }
}

export async function getCatalogGameDetailsById(
  gameId: number
): Promise<CatalogResult<CatalogGameDetails | null>> {
  if (!Number.isInteger(gameId) || gameId <= 0) {
    return {
      data: null,
      error: { message: 'Nao foi possivel identificar o jogo.' },
    }
  }

  const result = await invokeGameCatalog<GameCatalogFunctionDetailsResponse>(
    {
      action: 'details',
      gameId,
    },
    'Nao foi possivel carregar este jogo pelo catalogo externo.'
  )

  if (result.error || !result.data?.game) {
    return {
      data: null,
      error: result.error || { message: 'Nao foi possivel carregar este jogo.' },
    }
  }

  return {
    data: normalizeGameDetails(result.data.game),
    error: null,
  }
}
