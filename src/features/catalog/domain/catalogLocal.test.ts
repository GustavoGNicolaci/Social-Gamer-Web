import { describe, expect, it } from 'vitest'
import {
  isImportableCatalogQuery,
  normalizeCatalogFacets,
  normalizeCatalogFilters,
  normalizeCatalogQuery,
} from './catalogLocal'

describe('local catalog helpers', () => {
  it('stabilizes whitespace before deciding whether a query can import', () => {
    expect(normalizeCatalogQuery('  final   fantasy  ')).toBe('final fantasy')
    expect(isImportableCatalogQuery(' a ')).toBe(false)
    expect(isImportableCatalogQuery('  ff  ')).toBe(true)
  })

  it('normalizes filters without changing their first-seen order', () => {
    expect(normalizeCatalogFilters([' RPG ', '', 'Action', 'RPG'])).toEqual(['RPG', 'Action'])
  })

  it('groups RPC facet rows and ignores unsupported or empty values', () => {
    expect(normalizeCatalogFacets([
      { category: 'developer', value: ' Supergiant Games ' },
      { category: 'genre', value: 'Action' },
      { category: 'genre', value: 'Action' },
      { category: 'platform', value: 'PC' },
      { category: 'unknown', value: 'Ignored' },
      { category: 'genre', value: ' ' },
    ])).toEqual({
      genres: ['Action'],
      platforms: ['PC'],
      developers: ['Supergiant Games'],
    })
  })
})
