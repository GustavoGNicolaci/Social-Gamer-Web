import { supabase } from '../../../supabase-client'
import type { Database } from '../../../types/supabase'
import type {
  GameDetailsSourceRow,
  GamePreviewSourceRow,
} from '../../../services/gameAdapter'
import type { CatalogSortOption } from '../domain/catalogTypes'

export interface GameCatalogFunctionBody {
  action: 'details'
  locale?: string
  gameId?: number
  igdbId?: number
}

export interface SearchImportGamesResponse {
  games?: GamePreviewSourceRow[]
  importedCount?: number
  error?: string
}

export interface GameCatalogFunctionDetailsResponse {
  game?: GameDetailsSourceRow
  error?: string
}

export interface GameExternalIdRow {
  jogo_id: number | string | null
  external_id: string | null
}

export type CatalogSearchRow =
  Database['public']['Functions']['search_catalog_games']['Returns'][number]
export type CatalogFacetRow =
  Database['public']['Functions']['get_catalog_facets']['Returns'][number]

const CATALOG_GAME_SELECT =
  'id, titulo, capa_url, desenvolvedora, generos, data_lancamento, plataformas, source_primary, status_importacao'

export function searchCatalogGamesGateway({
  query,
  genres,
  platforms,
  developers,
  sort,
  limit,
  offset,
}: {
  query?: string
  genres: string[]
  platforms: string[]
  developers: string[]
  sort: CatalogSortOption
  limit: number
  offset: number
}) {
  return supabase.rpc('search_catalog_games', {
    p_query: query || null,
    p_genres: genres,
    p_platforms: platforms,
    p_developers: developers,
    p_sort: sort,
    p_limit: limit,
    p_offset: offset,
  })
}

export function getCatalogFacetsGateway(query: string) {
  return supabase.rpc('get_catalog_facets', {
    p_query: query || null,
  })
}

export function getCatalogSessionGateway() {
  return supabase.auth.getSession()
}

export function importCatalogGamesGateway(query: string, limit: number) {
  return supabase.functions.invoke<SearchImportGamesResponse>('search-import-games', {
    body: { query, limit },
  })
}

export function invokeGameCatalogGateway<T extends { error?: string }>(
  body: GameCatalogFunctionBody
) {
  return supabase.functions.invoke<T>('game-catalog', { body })
}

export function getGameExternalIdsGateway(gameIds: number[]) {
  return supabase
    .from('game_external_ids')
    .select('jogo_id, external_id')
    .eq('provider', 'igdb')
    .in('jogo_id', gameIds)
}

export function getCatalogGamesByIdsGateway(gameIds: number[]) {
  return supabase
    .from('jogos')
    .select(CATALOG_GAME_SELECT)
    .in('id', gameIds)
}
