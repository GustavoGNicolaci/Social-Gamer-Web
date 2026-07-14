const CATALOG_PAGINATION_WINDOW_SIZE = 4

export function getCatalogPaginationPages(currentPage: number, totalPages: number) {
  const normalizedTotalPages = Math.max(Math.trunc(totalPages), 0)
  if (normalizedTotalPages === 0) return []

  const safeCurrentPage = Math.min(
    Math.max(Math.trunc(currentPage), 1),
    normalizedTotalPages
  )
  const firstVisiblePage = safeCurrentPage
  const visiblePageCount = Math.min(
    CATALOG_PAGINATION_WINDOW_SIZE,
    normalizedTotalPages - firstVisiblePage + 1
  )

  return Array.from({ length: visiblePageCount }, (_, index) => firstVisiblePage + index)
}
