import { supabase } from '../supabase-client'
import { getPerformanceNow, logPerformanceTiming } from '../utils/performanceDiagnostics'

export interface WishlistError {
  code?: string
  message: string
  details?: string | null
  hint?: string | null
}

export interface WishlistEntry {
  id: string
  usuario_id: string
  jogo_id: number
  adicionado_em: string | null
  prioridade: number | null
}

export interface WishlistGame {
  id: number
  titulo: string
  capa_url: string | null
  desenvolvedora: string[] | string | null
  generos: string[] | string | null
  data_lancamento: string | null
  plataformas: string[] | string | null
}

type WishlistGameRelation = WishlistGame | WishlistGame[] | null

interface WishlistGameRow extends WishlistEntry {
  jogo: WishlistGameRelation
}

export interface WishlistGameItem extends WishlistEntry {
  jogo: WishlistGame | null
}

export interface WishlistPageOptions {
  page?: number
  pageSize?: number
}

export interface WishlistQueryTimings {
  totalMs: number
  queryMs: number
  normalizeMs: number
  requestCount: number
}

interface ServiceResult<T> {
  data: T
  error: WishlistError | null
}

interface PaginatedServiceResult<T> extends ServiceResult<T> {
  totalCount: number | null
  hasMore: boolean
  nextPage: number | null
  timings: WishlistQueryTimings
}

interface AddWishlistParams {
  userId: string
  gameId: number
}

interface DeleteWishlistEntryParams {
  userId: string
  wishlistEntryId: string
}

interface AddWishlistResult extends ServiceResult<WishlistEntry | null> {
  status: 'added' | 'duplicate' | 'error'
}

interface AddOwnWishlistRow extends WishlistEntry {
  inserted: boolean
}

interface WishlistSortable {
  id: string
  prioridade: number | null
  adicionado_em: string | null
}

const DEFAULT_WISHLIST_PAGE_SIZE = 12
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

function normalizeWishlistError(error: unknown, fallbackMessage: string): WishlistError {
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

function resolveWishlistGame(game: WishlistGameRelation) {
  if (Array.isArray(game)) return game[0] || null
  return game
}

function getComparableTimestamp(value: string | null) {
  if (!value) return 0

  const parsedDate = new Date(value)
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime()
}

function sortWishlistItemsByDisplayOrder<T extends WishlistSortable>(items: T[]) {
  const prioritizedItems = items
    .filter(item => item.prioridade !== null)
    .sort((leftItem, rightItem) => {
      const priorityDelta = (leftItem.prioridade || 0) - (rightItem.prioridade || 0)
      if (priorityDelta !== 0) return priorityDelta

      const addedAtDelta =
        getComparableTimestamp(rightItem.adicionado_em) -
        getComparableTimestamp(leftItem.adicionado_em)
      if (addedAtDelta !== 0) return addedAtDelta

      return leftItem.id.localeCompare(rightItem.id)
    })

  const unprioritizedItems = items
    .filter(item => item.prioridade === null)
    .sort((leftItem, rightItem) => {
      const addedAtDelta =
        getComparableTimestamp(rightItem.adicionado_em) -
        getComparableTimestamp(leftItem.adicionado_em)
      if (addedAtDelta !== 0) return addedAtDelta

      return leftItem.id.localeCompare(rightItem.id)
    })

  const maxPriority = prioritizedItems.reduce(
    (currentMax, item) => Math.max(currentMax, item.prioridade || 0),
    0
  )

  const effectivePriority = new Map<string, number>()

  prioritizedItems.forEach(item => {
    effectivePriority.set(item.id, item.prioridade || 0)
  })

  unprioritizedItems.forEach((item, index) => {
    effectivePriority.set(item.id, maxPriority + index + 1)
  })

  return [...items].sort((leftItem, rightItem) => {
    const priorityDelta =
      (effectivePriority.get(leftItem.id) || 0) - (effectivePriority.get(rightItem.id) || 0)
    if (priorityDelta !== 0) return priorityDelta

    const addedAtDelta =
      getComparableTimestamp(rightItem.adicionado_em) -
      getComparableTimestamp(leftItem.adicionado_em)
    if (addedAtDelta !== 0) return addedAtDelta

    return leftItem.id.localeCompare(rightItem.id)
  })
}

function normalizeWishlistPageOptions(options: WishlistPageOptions = {}) {
  const page = Math.max(0, options.page || 0)
  const pageSize = Math.min(Math.max(1, options.pageSize || DEFAULT_WISHLIST_PAGE_SIZE), 48)
  const from = page * pageSize
  const to = from + pageSize - 1

  return {
    page,
    pageSize,
    from,
    to,
  }
}

function buildWishlistPageMetadata(
  totalCount: number | null,
  page: number,
  pageSize: number,
  itemCount: number
) {
  const loadedCount = page * pageSize + itemCount
  const hasMore = totalCount === null ? itemCount === pageSize : loadedCount < totalCount

  return {
    totalCount,
    hasMore,
    nextPage: hasMore ? page + 1 : null,
  }
}

export async function getWishlistEntry(
  userId: string,
  gameId: number
): Promise<ServiceResult<WishlistEntry | null>> {
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

    return {
      data: (data as WishlistEntry | null) || null,
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: normalizeWishlistError(error, 'Erro inesperado ao verificar a lista de desejos.'),
    }
  }
}

export async function addGameToWishlist({
  userId,
  gameId,
}: AddWishlistParams): Promise<AddWishlistResult> {
  if (!userId.trim() || !Number.isInteger(gameId) || gameId <= 0) {
    return {
      status: 'error',
      data: null,
      error: { message: 'Nao foi possivel identificar o usuario ou o jogo da wishlist.' },
    }
  }

  try {
    const { data, error } = await supabase.rpc('add_own_wishlist_item', {
      p_game_id: gameId,
    })

    if (error) {
      return {
        status: 'error',
        data: null,
        error: normalizeWishlistError(error, 'Nao foi possivel salvar o jogo na lista de desejos.'),
      }
    }

    const row = (Array.isArray(data) ? data[0] : data) as AddOwnWishlistRow | null

    if (!row) {
      return {
        status: 'error',
        data: null,
        error: { message: 'O Supabase nao retornou o item salvo na lista de desejos.' },
      }
    }

    const { inserted, ...entry } = row

    return {
      status: inserted ? 'added' : 'duplicate',
      data: entry,
      error: null,
    }
  } catch (error) {
    return {
      status: 'error',
      data: null,
      error: normalizeWishlistError(
        error,
        'Erro inesperado ao salvar o jogo na lista de desejos.'
      ),
    }
  }
}

export async function getWishlistGamesPageByUserId(
  userId: string,
  pageOptions: WishlistPageOptions = {}
): Promise<PaginatedServiceResult<WishlistGameItem[]>> {
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
    const normalizedItems = sortWishlistItemsByDisplayOrder(
      ((data || []) as WishlistGameRow[]).map(item => ({
        ...item,
        jogo: resolveWishlistGame(item.jogo),
      }))
    )
    timings.normalizeMs += getPerformanceNow() - normalizeStartedAt
    timings.totalMs = getPerformanceNow() - startedAt

    const result: PaginatedServiceResult<WishlistGameItem[]> = {
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
): Promise<ServiceResult<WishlistGameItem[]>> {
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

    const normalizedItems = sortWishlistItemsByDisplayOrder(
      ((data || []) as WishlistGameRow[]).map(item => ({
        ...item,
        jogo: resolveWishlistGame(item.jogo),
      }))
    )

    return {
      data: normalizedItems,
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeWishlistError(error, 'Erro inesperado ao carregar a lista de desejos.'),
    }
  }
}

export async function updateWishlistPriorities(
  userId: string,
  orderedItems: WishlistGameItem[]
): Promise<ServiceResult<WishlistGameItem[]>> {
  const itemsWithNextPriority = orderedItems.map((item, index) => ({
    ...item,
    prioridade: index + 1,
  }))

  if (!userId.trim()) {
    return {
      data: orderedItems,
      error: { message: 'Nao foi possivel identificar o usuario da lista de desejos.' },
    }
  }

  try {
    const { error } = await supabase.rpc('reorder_own_wishlist', {
      p_item_ids: itemsWithNextPriority.map(item => item.id),
    })

    if (error) {
      return {
        data: orderedItems,
        error: normalizeWishlistError(
          error,
          'Nao foi possivel salvar a nova ordem da lista de desejos.'
        ),
      }
    }

    return {
      data: itemsWithNextPriority,
      error: null,
    }
  } catch (error) {
    return {
      data: orderedItems,
      error: normalizeWishlistError(
        error,
        'Erro inesperado ao salvar a nova ordem da lista de desejos.'
      ),
    }
  }
}

export async function deleteWishlistEntry({
  userId,
  wishlistEntryId,
}: DeleteWishlistEntryParams): Promise<ServiceResult<null>> {
  if (!userId.trim() || !wishlistEntryId.trim()) {
    return {
      data: null,
      error: { message: 'Nao foi possivel identificar o item da wishlist.' },
    }
  }

  try {
    const { data, error } = await supabase.rpc('remove_own_wishlist_item', {
      p_item_id: wishlistEntryId,
    })

    if (error) {
      return {
        data: null,
        error: normalizeWishlistError(error, 'Nao foi possivel remover o jogo da wishlist.'),
      }
    }

    if (data !== true) {
      return {
        data: null,
        error: {
          message: 'Nenhum item foi removido da wishlist deste usuario.',
        },
      }
    }

    return {
      data: null,
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: normalizeWishlistError(error, 'Erro inesperado ao remover o jogo da wishlist.'),
    }
  }
}
