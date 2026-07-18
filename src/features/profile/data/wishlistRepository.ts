import { supabase } from '../../../supabase-client'
import { getPerformanceNow, logPerformanceTiming } from '../../../utils/performanceDiagnostics'
import {
  buildWishlistPageMetadata,
  normalizeWishlistPageOptions,
  sortWishlistItemsByDisplayOrder,
  type WishlistEntry,
  type WishlistGame,
  type WishlistGameItem,
  type WishlistGameRelation,
  type WishlistGameRow,
  type WishlistPageOptions,
  type WishlistPaginatedResult,
  type WishlistQueryTimings,
  type WishlistServiceResult,
} from '../domain/wishlist'

const WISHLIST_GAME_SELECT = `
  id,
  usuario_id,
  jogo_id,
  adicionado_em,
  prioridade,
  jogo:jogos (
    id,
    titulo,
    capa_url,
    desenvolvedora,
    generos,
    data_lancamento,
    plataformas
  )
`

export function normalizeWishlistError(error: unknown, fallbackMessage: string) {
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

function resolveWishlistGame(game: WishlistGameRelation): WishlistGame | null {
  if (Array.isArray(game)) return game[0] || null
  return game
}

function normalizeWishlistRows(rows: WishlistGameRow[]) {
  return sortWishlistItemsByDisplayOrder(
    rows.map(item => ({ ...item, jogo: resolveWishlistGame(item.jogo) }))
  )
}

export async function getWishlistEntry(
  userId: string,
  gameId: number
): Promise<WishlistServiceResult<WishlistEntry | null>> {
  try {
    const { data, error } = await supabase
      .from('lista_desejos')
      .select('id, usuario_id, jogo_id, adicionado_em, prioridade')
      .eq('usuario_id', userId)
      .eq('jogo_id', gameId)
      .maybeSingle()

    if (error) {
      return {
        data: null,
        error: normalizeWishlistError(error, 'Nao foi possivel verificar a lista de desejos.'),
      }
    }

    return { data: (data as WishlistEntry | null) || null, error: null }
  } catch (error) {
    return {
      data: null,
      error: normalizeWishlistError(error, 'Erro inesperado ao verificar a lista de desejos.'),
    }
  }
}

export async function getWishlistGamesPageByUserId(
  userId: string,
  pageOptions: WishlistPageOptions = {}
): Promise<WishlistPaginatedResult<WishlistGameItem[]>> {
  const options = normalizeWishlistPageOptions(pageOptions)
  const startedAt = getPerformanceNow()
  const timings: WishlistQueryTimings = {
    totalMs: 0,
    queryMs: 0,
    normalizeMs: 0,
    requestCount: 0,
  }

  try {
    const queryStartedAt = getPerformanceNow()
    const { data, error, count } = await supabase
      .from('lista_desejos')
      .select(WISHLIST_GAME_SELECT, { count: 'exact' })
      .eq('usuario_id', userId)
      .order('prioridade', { ascending: true, nullsFirst: false })
      .order('adicionado_em', { ascending: false })
      .range(options.from, options.to)

    timings.requestCount += 1
    timings.queryMs += getPerformanceNow() - queryStartedAt

    if (error) {
      timings.totalMs = getPerformanceNow() - startedAt
      logPerformanceTiming('profile.wishlist.page', timings.totalMs, {
        userId,
        page: options.page,
        pageSize: options.pageSize,
        requestCount: timings.requestCount,
        hasError: true,
      })

      return {
        data: [],
        error: normalizeWishlistError(error, 'Nao foi possivel carregar a lista de desejos.'),
        totalCount: null,
        hasMore: false,
        nextPage: null,
        timings,
      }
    }

    const normalizeStartedAt = getPerformanceNow()
    const normalizedItems = normalizeWishlistRows((data || []) as WishlistGameRow[])
    timings.normalizeMs += getPerformanceNow() - normalizeStartedAt
    timings.totalMs = getPerformanceNow() - startedAt

    const result: WishlistPaginatedResult<WishlistGameItem[]> = {
      data: normalizedItems,
      error: null,
      ...buildWishlistPageMetadata(count, options.page, options.pageSize, normalizedItems.length),
      timings,
    }

    logPerformanceTiming('profile.wishlist.page', timings.totalMs, {
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
    logPerformanceTiming('profile.wishlist.page', timings.totalMs, {
      userId,
      page: options.page,
      pageSize: options.pageSize,
      requestCount: timings.requestCount,
      hasError: true,
    })

    return {
      data: [],
      error: normalizeWishlistError(error, 'Erro inesperado ao carregar a lista de desejos.'),
      totalCount: null,
      hasMore: false,
      nextPage: null,
      timings,
    }
  }
}

export async function getWishlistGamesByUserId(
  userId: string
): Promise<WishlistServiceResult<WishlistGameItem[]>> {
  try {
    const { data, error } = await supabase
      .from('lista_desejos')
      .select(WISHLIST_GAME_SELECT)
      .eq('usuario_id', userId)
      .order('prioridade', { ascending: true, nullsFirst: false })
      .order('adicionado_em', { ascending: false })

    if (error) {
      return {
        data: [],
        error: normalizeWishlistError(error, 'Nao foi possivel carregar a lista de desejos.'),
      }
    }

    return {
      data: normalizeWishlistRows((data || []) as WishlistGameRow[]),
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeWishlistError(error, 'Erro inesperado ao carregar a lista de desejos.'),
    }
  }
}
