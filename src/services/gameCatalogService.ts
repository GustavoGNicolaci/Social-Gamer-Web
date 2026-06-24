import { supabase } from '../supabase-client'

export interface GameCatalogError {
  code?: string
  message: string
  details?: string | null
  hint?: string | null
}

export interface CatalogGamePreview {
  id: number
  titulo: string
  capa_url: string | null
  desenvolvedora: string[] | string | null
  generos: string[] | string | null
  data_lancamento: string | null
  plataformas: string[] | string | null
  averageRating?: number | null
  reviewCount?: number | null
}

interface CatalogResult<T> {
  data: T
  error: GameCatalogError | null
}

export type CatalogSortOption = 'release-desc' | 'release-asc' | 'rating-desc' | 'rating-asc'

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

interface CatalogGameRpcRow {
  id: number
  titulo: string
  capa_url: string | null
  desenvolvedora: string | null
  generos: string[] | null
  data_lancamento: string | null
  plataformas: string[] | null
  average_rating: number | string | null
  review_count: number | string | null
  total_count: number | string | null
}

interface CatalogFacetRpcRow {
  category: 'genre' | 'platform' | 'developer' | string
  value: string | null
  result_count: number | string | null
}

interface ImportGamesResponse {
  games?: CatalogGamePreview[]
}

const DEFAULT_SEARCH_LIMIT = 8
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100
const CATALOG_GAME_SELECT =
  'id, titulo, capa_url, desenvolvedora, generos, data_lancamento, plataformas'

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

function normalizePositiveInteger(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(1, Math.min(Math.trunc(value), max))
}

function normalizeStringFilters(values: string[] | undefined) {
  return Array.from(new Set((values || []).map(value => value.trim()).filter(Boolean)))
}

function normalizeCatalogGame(row: CatalogGameRpcRow | CatalogGamePreview): CatalogGamePreview {
  if ('average_rating' in row || 'review_count' in row) {
    const rpcRow = row as CatalogGameRpcRow

    return {
      id: rpcRow.id,
      titulo: rpcRow.titulo,
      capa_url: rpcRow.capa_url,
      desenvolvedora: rpcRow.desenvolvedora,
      generos: rpcRow.generos,
      data_lancamento: rpcRow.data_lancamento,
      plataformas: rpcRow.plataformas,
      averageRating: normalizeNumber(rpcRow.average_rating),
      reviewCount: normalizeInteger(rpcRow.review_count),
    }
  }

  return row
}

async function invokeSearchImport(query: string, limit: number) {
  try {
    const { data, error } = await supabase.functions.invoke<ImportGamesResponse>(
      'search-import-games',
      {
        body: {
          query,
          limit,
        },
      }
    )

    if (error || !Array.isArray(data?.games)) {
      return null
    }

    return data.games.map(game => normalizeCatalogGame(game))
  } catch {
    return null
  }
}

async function fetchCatalogGamesByTitle(
  query: string,
  limit: number
): Promise<CatalogResult<CatalogGamePreview[]>> {
  const { data, error } = await supabase.rpc('search_catalog_games', {
    p_query: query,
    p_genres: [],
    p_platforms: [],
    p_developers: [],
    p_sort: 'release-desc',
    p_limit: limit,
    p_offset: 0,
  })

  if (error) {
    return {
      data: [],
      error: normalizeCatalogError(error, 'Nao foi possivel buscar jogos no catalogo.'),
    }
  }

  return {
    data: ((data || []) as CatalogGameRpcRow[]).map(normalizeCatalogGame),
    error: null,
  }
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

  try {
    const localResult = await fetchCatalogGamesByTitle(normalizedQuery, limit)

    if (
      !localResult.error &&
      localResult.data.length < limit &&
      options.importIfMissing !== false
    ) {
      const importedGames = await invokeSearchImport(normalizedQuery, limit)

      if (importedGames && importedGames.length > localResult.data.length) {
        return {
          data: importedGames,
          error: null,
        }
      }

      if (importedGames) {
        return await fetchCatalogGamesByTitle(normalizedQuery, limit)
      }
    }

    return localResult
  } catch (error) {
    return {
      data: [],
      error: normalizeCatalogError(error, 'Erro inesperado ao buscar jogos no catalogo.'),
    }
  }
}

export async function getCatalogGamesPage(
  pageOptions: CatalogGamesPageOptions = {}
): Promise<CatalogResult<CatalogGamesPage>> {
  const page = normalizePositiveInteger(pageOptions.page, 1)
  const pageSize = normalizePositiveInteger(pageOptions.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
  const query = pageOptions.query?.trim() || ''
  const offset = (page - 1) * pageSize
  const sort = pageOptions.sort || 'release-desc'

  async function fetchPage(): Promise<CatalogResult<CatalogGamesPage>> {
    const { data, error } = await supabase.rpc('search_catalog_games', {
      p_query: query || null,
      p_genres: normalizeStringFilters(pageOptions.genres),
      p_platforms: normalizeStringFilters(pageOptions.platforms),
      p_developers: normalizeStringFilters(pageOptions.developers),
      p_sort: sort,
      p_limit: pageSize,
      p_offset: offset,
    })

    if (error) {
      return {
        data: {
          items: [],
          totalCount: 0,
          totalPages: 0,
          page,
          pageSize,
        },
        error: normalizeCatalogError(error, 'Nao foi possivel carregar o catalogo de jogos.'),
      }
    }

    const rows = ((data || []) as CatalogGameRpcRow[]).map(normalizeCatalogGame)
    const totalCount = data && data.length > 0
      ? normalizeInteger((data[0] as CatalogGameRpcRow).total_count)
      : 0

    return {
      data: {
        items: rows,
        totalCount,
        totalPages: totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize),
        page,
        pageSize,
      },
      error: null,
    }
  }

  try {
    const localResult = await fetchPage()

    if (
      !localResult.error &&
      query.length >= 2 &&
      page === 1 &&
      localResult.data.totalCount === 0
    ) {
      const importedGames = await invokeSearchImport(query, pageSize)

      if (importedGames) {
        return await fetchPage()
      }
    }

    return localResult
  } catch (error) {
    return {
      data: {
        items: [],
        totalCount: 0,
        totalPages: 0,
        page,
        pageSize,
      },
      error: normalizeCatalogError(error, 'Erro inesperado ao carregar o catalogo de jogos.'),
    }
  }
}

export async function getCatalogFacetOptions(
  query?: string
): Promise<CatalogResult<CatalogFacetOptions>> {
  try {
    const { data, error } = await supabase.rpc('get_catalog_facets', {
      p_query: query?.trim() || null,
    })

    if (error) {
      return {
        data: {
          genres: [],
          platforms: [],
          developers: [],
        },
        error: normalizeCatalogError(error, 'Nao foi possivel carregar os filtros do catalogo.'),
      }
    }

    const facets: CatalogFacetOptions = {
      genres: [],
      platforms: [],
      developers: [],
    }

    ;((data || []) as CatalogFacetRpcRow[]).forEach(row => {
      const value = row.value?.trim()
      if (!value) return

      if (row.category === 'genre') {
        facets.genres.push(value)
      } else if (row.category === 'platform') {
        facets.platforms.push(value)
      } else if (row.category === 'developer') {
        facets.developers.push(value)
      }
    })

    return {
      data: facets,
      error: null,
    }
  } catch (error) {
    return {
      data: {
        genres: [],
        platforms: [],
        developers: [],
      },
      error: normalizeCatalogError(error, 'Erro inesperado ao carregar os filtros do catalogo.'),
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

    return {
      data: (data || []) as CatalogGamePreview[],
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeCatalogError(error, 'Erro inesperado ao carregar os jogos selecionados.'),
    }
  }
}
