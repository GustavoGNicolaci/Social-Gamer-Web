import { describe, expect, it } from 'vitest'
import { getCatalogPaginationPages } from './catalogPagination'

describe('catalog pagination window', () => {
  it('shows the current page and the next three pages', () => {
    expect(getCatalogPaginationPages(1, 48)).toEqual([1, 2, 3, 4])
    expect(getCatalogPaginationPages(2, 48)).toEqual([2, 3, 4, 5])
    expect(getCatalogPaginationPages(3, 48)).toEqual([3, 4, 5, 6])
  })

  it('advances the window by one whenever the current page advances', () => {
    expect(getCatalogPaginationPages(4, 48)).toEqual([4, 5, 6, 7])
    expect(getCatalogPaginationPages(5, 48)).toEqual([5, 6, 7, 8])
  })

  it('shows only the remaining pages in the last group', () => {
    expect(getCatalogPaginationPages(9, 10)).toEqual([9, 10])
    expect(getCatalogPaginationPages(10, 10)).toEqual([10])
  })

  it('clamps an invalid current page to the available range', () => {
    expect(getCatalogPaginationPages(99, 48)).toEqual([48])
    expect(getCatalogPaginationPages(0, 48)).toEqual([1, 2, 3, 4])
  })
})
