import type { CatalogGamePreview } from '../../catalog/domain/catalogTypes'

export type GameStatusValue =
  | 'jogando'
  | 'zerado'
  | 'dropado'
  | 'planejando'
  | 'pausado'

export type GameStatusSortValue = 'recent' | 'oldest' | 'favorites' | 'title'

export interface GameStatusError {
  code?: string
  message: string
  details?: string | null
  hint?: string | null
}

export interface GameStatusEntry {
  id: string
  usuario_id: string
  jogo_id: number
  status: GameStatusValue
  created_at: string | null
  favorito: boolean
}

export type StatusGame = CatalogGamePreview

export interface GameStatusItem extends GameStatusEntry {
  jogo: StatusGame | null
}

export interface GameStatusPageOptions {
  page?: number
  pageSize?: number
  sort?: GameStatusSortValue
  statuses?: GameStatusValue[]
}

export interface ProfileQueryTimings {
  totalMs: number
  queryMs: number
  normalizeMs: number
  requestCount: number
  fallbackUsed?: boolean
}

export interface ServiceResult<T> {
  data: T
  error: GameStatusError | null
}

export interface PaginatedServiceResult<T> extends ServiceResult<T> {
  totalCount: number | null
  hasMore: boolean
  nextPage: number | null
  timings: ProfileQueryTimings
}

export interface SaveGameStatusParams {
  userId: string
  gameId: number
  status: GameStatusValue
  favorito: boolean
}

export interface DeleteGameStatusParams {
  userId: string
  statusId: string
}

export interface NormalizedGameStatusPageOptions {
  page: number
  pageSize: number
  from: number
  to: number
  sort: GameStatusSortValue
  statuses: GameStatusValue[]
}

export const STATUS_VALUES: GameStatusValue[] = [
  'jogando',
  'zerado',
  'dropado',
  'planejando',
  'pausado',
]

const DEFAULT_STATUS_PAGE_SIZE = 12

export function normalizeStatusValue(value: string | null | undefined): GameStatusValue {
  const normalizedValue = value?.trim().toLowerCase() || ''

  if (STATUS_VALUES.includes(normalizedValue as GameStatusValue)) {
    return normalizedValue as GameStatusValue
  }

  return 'jogando'
}

export function normalizeGameStatusPageOptions(
  options: GameStatusPageOptions = {}
): NormalizedGameStatusPageOptions {
  const page = Math.max(0, options.page || 0)
  const pageSize = Math.min(Math.max(1, options.pageSize || DEFAULT_STATUS_PAGE_SIZE), 48)
  const from = page * pageSize
  const to = from + pageSize - 1
  const statuses = Array.from(
    new Set(
      (options.statuses || []).filter((status): status is GameStatusValue =>
        STATUS_VALUES.includes(status)
      )
    )
  )

  return {
    page,
    pageSize,
    from,
    to,
    sort: options.sort || 'recent',
    statuses,
  }
}

export function sortStatusItemsByDisplayOrder(
  items: GameStatusItem[],
  sort: GameStatusSortValue
) {
  return [...items].sort((leftItem, rightItem) => {
    const leftTitle = leftItem.jogo?.titulo || ''
    const rightTitle = rightItem.jogo?.titulo || ''
    const leftTimestamp = leftItem.created_at ? new Date(leftItem.created_at).getTime() || 0 : 0
    const rightTimestamp = rightItem.created_at ? new Date(rightItem.created_at).getTime() || 0 : 0

    if (sort === 'title') {
      const titleDelta = leftTitle.localeCompare(rightTitle, 'pt-BR')
      if (titleDelta !== 0) return titleDelta
    }

    if (sort === 'favorites') {
      if (leftItem.favorito !== rightItem.favorito) return leftItem.favorito ? -1 : 1
      return rightTimestamp - leftTimestamp
    }

    if (sort === 'oldest') {
      return leftTimestamp - rightTimestamp
    }

    return rightTimestamp - leftTimestamp
  })
}

export function buildGameStatusPageMetadata(
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

export function createEmptyGameStatusPageResult(
  timings: ProfileQueryTimings,
  error: GameStatusError | null = null
): PaginatedServiceResult<GameStatusItem[]> {
  return {
    data: [],
    error,
    totalCount: error ? null : 0,
    hasMore: false,
    nextPage: null,
    timings: {
      ...timings,
      totalMs: timings.totalMs || 0,
    },
  }
}
