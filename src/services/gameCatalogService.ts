import {
  MAX_CATALOG_IMPORT_RESULTS,
  isImportableCatalogQuery,
  normalizeCatalogFacets,
  normalizeCatalogFilters,
  normalizeCatalogQuery,
  type CatalogFacetValues,
} from '../features/catalog/domain/catalogLocal'
import { getRuntimeLocale, translate } from '../i18n'
import { supabase } from '../supabase-client'
import type { Database } from '../types/supabase'
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

export type CatalogFacetOptions = CatalogFacetValues

interface GameCatalogFunctionBody {
  action: 'details'
  locale?: string
  gameId?: number
  igdbId?: number
}

interface SearchImportGamesResponse {
  games?: GamePreviewSourceRow[]
  importedCount?: number
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

type CatalogSearchRow =
  Database['public']['Functions']['search_catalog_games']['Returns'][number]
type CatalogFacetRow = Database['public']['Functions']['get_catalog_facets']['Returns'][number]

const DEFAULT_SEARCH_LIMIT = 8
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100
const CATALOG_QUERY_ERROR_CODE = 'catalog_query_failed'
const CATALOG_FACETS_ERROR_CODE = 'catalog_facets_failed'
const CATALOG_IMPORT_ERROR_CODE = 'catalog_import_failed'
const CATALOG_GAME_SELECT =
  'id, titulo, capa_url, desenvolvedora, generos, data_lancamento, plataformas, source_primary, status_importacao'

function normalizeCatalogError(
  error: unknown,
  fallbackMessage: string,
  fallbackCode?: string
): GameCatalogError {
  if (error && typeof error === 'object') {
    const message =
      'message' in error && typeof error.message === 'string' ? error.message : fallbackMessage
    const code =
      'code' in error && typeof error.code === 'string' ? error.code : fallbackCode
    const details =
      'details' in error && typeof error.details === 'string' ? error.details : null
    const hint = 'hint' in error && typeof error.hint === 'string' ? error.hint : null

    return { code, message, details, hint }
  }

  return { code: fallbackCode, message: fallbackMessage }
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

function normalizePositiveInteger(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(1, Math.min(Math.trunc(value), max))
}

function mapFunctionErrorCode(code: string | undefined) {
  if (code === 'server_misconfigured') {
    return 'A fonte externa de jogos nao esta configurada no backend.'
  }

  if (code === 'game_not_identified') {
    return 'Nao foi possivel identificar o jogo.'
  }

  if (code === 'not_authenticated' || code === 'query_too_short') {
    return translate('error.genericSearchGames')
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

async function searchLocalCatalogGames({
  query,
  genres = [],
  platforms = [],
  developers = [],
  sort = 'release-desc',
  limit,
  offset = 0,
}: {
  query?: string
  genres?: string[]
  platforms?: string[]
  developers?: string[]
  sort?: CatalogSortOption
  limit: number
  offset?: number
}): Promise<CatalogResult<CatalogSearchRow[]>> {
  const fallbackMessage = translate('error.genericSearchGames')

  try {
    const { data, error } = await supabase.rpc('search_catalog_games', {
      p_query: query || null,
      p_genres: genres,
      p_platforms: platforms,
      p_developers: developers,
      p_sort: sort,
      p_limit: limit,
      p_offset: offset,
    })

    if (error) {
      return {
        data: [],
        error: normalizeCatalogError(error, fallbackMessage, CATALOG_QUERY_ERROR_CODE),
      }
    }

    return {
      data: data || [],
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeCatalogError(error, fallbackMessage, CATALOG_QUERY_ERROR_CODE),
    }
  }
}

async function hasAuthenticatedCatalogUser() {
  try {
    const { data, error } = await supabase.auth.getSession()
    return !error && Boolean(data.session?.user)
  } catch {
    return false
  }
}

async function importCatalogGames(
  query: string,
  limit: number
): Promise<CatalogResult<GamePreviewSourceRow[]>> {
  const fallbackMessage = translate('error.genericSearchGames')

  try {
    const { data, error } = await supabase.functions.invoke<SearchImportGamesResponse>(
      'search-import-games',
      {
        body: {
          query,
          limit: Math.min(limit, MAX_CATALOG_IMPORT_RESULTS),
        },
      }
    )

    if (error) {
      return {
        data: [],
        error: normalizeCatalogError(error, fallbackMessage, CATALOG_IMPORT_ERROR_CODE),
      }
    }

    if (data?.error) {
      return {
        data: [],
        error: {
          code: data.error,
          message: mapFunctionErrorCode(data.error) || fallbackMessage,
        },
      }
    }

    return {
      data: data?.games || [],
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeCatalogError(error, fallbackMessage, CATALOG_IMPORT_ERROR_CODE),
    }
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

async function normalizeCatalogPreviews(rows: GamePreviewSourceRow[]) {
  return attachIgdbIdsToGames(rows.map(row => normalizeGamePreview(row)))
}

export async function searchCatalogGamesByTitle(
  query: string,
  options: SearchCatalogGamesOptions = {}
): Promise<CatalogResult<CatalogGamePreview[]>> {
  const normalizedQuery = normalizeCatalogQuery(query)

  if (!isImportableCatalogQuery(normalizedQuery)) {
    return {
      data: [],
      error: null,
    }
  }

  const limit = normalizePositiveInteger(options.limit, DEFAULT_SEARCH_LIMIT, MAX_PAGE_SIZE)
  const localResult = await searchLocalCatalogGames({
    query: normalizedQuery,
    limit,
  })

  if (localResult.error) {
    return {
      data: [],
      error: localResult.error,
    }
  }

  const localGames = await normalizeCatalogPreviews(localResult.data)
  if (localGames.length > 0 || options.importIfMissing === false) {
    return {
      data: localGames,
      error: null,
    }
  }

  if (!(await hasAuthenticatedCatalogUser())) {
    return {
      data: [],
      error: null,
    }
  }

  const importResult = await importCatalogGames(normalizedQuery, limit)
  if (importResult.error) {
    return {
      data: [],
      error: importResult.error,
    }
  }

  const refreshedResult = await searchLocalCatalogGames({
    query: normalizedQuery,
    limit,
  })
  if (!refreshedResult.error && refreshedResult.data.length > 0) {
    return {
      data: await normalizeCatalogPreviews(refreshedResult.data),
      error: null,
    }
  }

  return {
    data: await normalizeCatalogPreviews(importResult.data),
    error: null,
  }
}

export async function getCatalogGamesPage(
  pageOptions: CatalogGamesPageOptions = {}
): Promise<CatalogResult<CatalogGamesPage>> {
  const page = normalizePositiveInteger(pageOptions.page, 1)
  const pageSize = normalizePositiveInteger(pageOptions.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
  const normalizedQuery = normalizeCatalogQuery(pageOptions.query)
  const query = isImportableCatalogQuery(normalizedQuery) ? normalizedQuery : undefined
  const result = await searchLocalCatalogGames({
    query,
    genres: normalizeCatalogFilters(pageOptions.genres),
    platforms: normalizeCatalogFilters(pageOptions.platforms),
    developers: normalizeCatalogFilters(pageOptions.developers),
    sort: pageOptions.sort || 'release-desc',
    limit: pageSize,
    offset: (page - 1) * pageSize,
  })

  if (result.error) {
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

  const items = await normalizeCatalogPreviews(result.data)
  const totalCount = normalizeInteger(result.data[0]?.total_count)
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize)

  return {
    data: {
      items,
      totalCount,
      totalPages,
      page,
      pageSize,
    },
    error: null,
  }
}

export async function getCatalogFacetOptions(
  query?: string
): Promise<CatalogResult<CatalogFacetOptions>> {
  const normalizedQuery = normalizeCatalogQuery(query)
  const fallbackMessage = translate('error.genericSearchGames')

  try {
    const { data, error } = await supabase.rpc('get_catalog_facets', {
      p_query: normalizedQuery || null,
    })

    if (error) {
      return {
        data: normalizeCatalogFacets([]),
        error: normalizeCatalogError(error, fallbackMessage, CATALOG_FACETS_ERROR_CODE),
      }
    }

    return {
      data: normalizeCatalogFacets((data || []) as CatalogFacetRow[]),
      error: null,
    }
  } catch (error) {
    return {
      data: normalizeCatalogFacets([]),
      error: normalizeCatalogError(error, fallbackMessage, CATALOG_FACETS_ERROR_CODE),
    }
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
