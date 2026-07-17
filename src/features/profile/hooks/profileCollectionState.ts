export interface ProfilePageState {
  totalCount: number | null
  hasMore: boolean
  nextPage: number | null
  loaded: boolean
}

export interface CachedCollection<T> extends ProfilePageState {
  items: T[]
}

export interface LoadProfilePageOptions {
  page?: number
  append?: boolean
  force?: boolean
}

export const createEmptyProfilePageState = (): ProfilePageState => ({
  totalCount: null,
  hasMore: false,
  nextPage: null,
  loaded: false,
})

export const createCachedCollection = <T,>(
  items: T[],
  pageState: ProfilePageState
): CachedCollection<T> => ({
  items,
  ...pageState,
})

export const createLoadedPageState = (
  totalCount: number | null,
  hasMore: boolean,
  nextPage: number | null
): ProfilePageState => ({
  totalCount,
  hasMore,
  nextPage,
  loaded: true,
})

export function mergeProfileCollectionsById<T extends { id: string }>(
  currentItems: T[],
  nextItems: T[]
) {
  const mergedItems = new Map<string, T>()

  currentItems.forEach(item => mergedItems.set(item.id, item))
  nextItems.forEach(item => mergedItems.set(item.id, item))

  return Array.from(mergedItems.values())
}
