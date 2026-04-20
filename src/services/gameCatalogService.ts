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
}

interface CatalogResult<T> {
  data: T
  error: GameCatalogError | null
}

interface SearchCatalogGamesOptions {
  limit?: number
}

const DEFAULT_SEARCH_LIMIT = 8

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

  try {
    const { data, error } = await supabase
      .from('jogos')
      .select('id, titulo, capa_url, desenvolvedora, generos, data_lancamento, plataformas')
      .ilike('titulo', `%${normalizedQuery}%`)
      .order('titulo', { ascending: true })
      .limit(options.limit ?? DEFAULT_SEARCH_LIMIT)

    if (error) {
      return {
        data: [],
        error: normalizeCatalogError(error, 'Nao foi possivel buscar jogos no catalogo.'),
      }
    }

    return {
      data: (data || []) as CatalogGamePreview[],
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeCatalogError(error, 'Erro inesperado ao buscar jogos no catalogo.'),
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
      .select('id, titulo, capa_url, desenvolvedora, generos, data_lancamento, plataformas')
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
