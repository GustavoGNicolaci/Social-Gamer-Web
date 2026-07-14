export const MIN_CATALOG_QUERY_LENGTH = 2
export const MAX_CATALOG_IMPORT_RESULTS = 10

export interface CatalogFacetRow {
  category: string
  value: string | null
}

export interface CatalogFacetValues {
  genres: string[]
  platforms: string[]
  developers: string[]
}

export function normalizeCatalogQuery(query: string | null | undefined) {
  return (query || '').trim().replace(/\s+/g, ' ')
}

export function isImportableCatalogQuery(query: string) {
  return normalizeCatalogQuery(query).length >= MIN_CATALOG_QUERY_LENGTH
}

export function normalizeCatalogFilters(values: string[] | undefined) {
  return Array.from(new Set((values || []).map(value => value.trim()).filter(Boolean)))
}

export function normalizeCatalogFacets(rows: CatalogFacetRow[]): CatalogFacetValues {
  const facets: CatalogFacetValues = {
    genres: [],
    platforms: [],
    developers: [],
  }

  const seenValues = {
    genre: new Set<string>(),
    platform: new Set<string>(),
    developer: new Set<string>(),
  }

  rows.forEach(row => {
    const value = row.value?.trim()
    if (!value) return

    if (row.category === 'genre' && !seenValues.genre.has(value)) {
      seenValues.genre.add(value)
      facets.genres.push(value)
    } else if (row.category === 'platform' && !seenValues.platform.has(value)) {
      seenValues.platform.add(value)
      facets.platforms.push(value)
    } else if (row.category === 'developer' && !seenValues.developer.has(value)) {
      seenValues.developer.add(value)
      facets.developers.push(value)
    }
  })

  return facets
}
