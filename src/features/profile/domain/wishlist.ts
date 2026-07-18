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

export type WishlistGameRelation = WishlistGame | WishlistGame[] | null

export interface WishlistGameRow extends WishlistEntry {
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

export interface WishlistServiceResult<T> {
  data: T
  error: WishlistError | null
}

export interface WishlistPaginatedResult<T> extends WishlistServiceResult<T> {
  totalCount: number | null
  hasMore: boolean
  nextPage: number | null
  timings: WishlistQueryTimings
}

export interface AddWishlistParams {
  userId: string
  gameId: number
}

export interface DeleteWishlistEntryParams {
  userId: string
  wishlistEntryId: string
}

export interface AddWishlistResult extends WishlistServiceResult<WishlistEntry | null> {
  status: 'added' | 'duplicate' | 'error'
}

export interface AddOwnWishlistRow extends WishlistEntry {
  inserted: boolean
}

interface WishlistSortable {
  id: string
  prioridade: number | null
  adicionado_em: string | null
}

const DEFAULT_WISHLIST_PAGE_SIZE = 12

function getComparableTimestamp(value: string | null) {
  if (!value) return 0
  const parsedDate = new Date(value)
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime()
}

export function sortWishlistItemsByDisplayOrder<T extends WishlistSortable>(items: T[]) {
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

  prioritizedItems.forEach(item => effectivePriority.set(item.id, item.prioridade || 0))
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

export function normalizeWishlistPageOptions(options: WishlistPageOptions = {}) {
  const page = Math.max(0, options.page || 0)
  const pageSize = Math.min(Math.max(1, options.pageSize || DEFAULT_WISHLIST_PAGE_SIZE), 48)
  const from = page * pageSize

  return { page, pageSize, from, to: from + pageSize - 1 }
}

export function buildWishlistPageMetadata(
  totalCount: number | null,
  page: number,
  pageSize: number,
  itemCount: number
) {
  const loadedCount = page * pageSize + itemCount
  const hasMore = totalCount === null ? itemCount === pageSize : loadedCount < totalCount

  return { totalCount, hasMore, nextPage: hasMore ? page + 1 : null }
}
