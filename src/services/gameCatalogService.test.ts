import { beforeEach, describe, expect, it, vi } from 'vitest'

const supabaseMocks = vi.hoisted(() => {
  const externalIdsIn = vi.fn()
  const externalIdsEq = vi.fn(() => ({ in: externalIdsIn }))
  const externalIdsSelect = vi.fn(() => ({ eq: externalIdsEq }))

  return {
    rpc: vi.fn(),
    invoke: vi.fn(),
    getSession: vi.fn(),
    from: vi.fn(() => ({ select: externalIdsSelect })),
    externalIdsIn,
  }
})

vi.mock('../supabase-client', () => ({
  supabase: {
    rpc: supabaseMocks.rpc,
    functions: { invoke: supabaseMocks.invoke },
    auth: { getSession: supabaseMocks.getSession },
    from: supabaseMocks.from,
  },
}))

import {
  getCatalogFacetOptions,
  getCatalogGamesPage,
  searchCatalogGamesByTitle,
} from './gameCatalogService'

const localGameRow = {
  id: 7,
  titulo: 'Hades',
  capa_url: 'cover.jpg',
  desenvolvedora: 'Supergiant Games',
  generos: ['Action'],
  data_lancamento: '2020-09-17',
  plataformas: ['PC'],
  average_rating: 9.2,
  review_count: 12,
  total_count: 1,
}

describe('game catalog service local-first flow', () => {
  beforeEach(() => {
    supabaseMocks.rpc.mockReset()
    supabaseMocks.invoke.mockReset()
    supabaseMocks.getSession.mockReset()
    supabaseMocks.from.mockClear()
    supabaseMocks.externalIdsIn.mockReset()
    supabaseMocks.externalIdsIn.mockResolvedValue({ data: [], error: null })
  })

  it('returns a local RPC match without checking auth or importing', async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: [localGameRow], error: null })

    const result = await searchCatalogGamesByTitle('  hades  ')

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('search_catalog_games', expect.objectContaining({
      p_query: 'hades',
      p_limit: 8,
      p_offset: 0,
    }))
    expect(supabaseMocks.getSession).not.toHaveBeenCalled()
    expect(supabaseMocks.invoke).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      error: null,
      data: [{ id: 7, title: 'Hades', averageRating: 9.2, reviewCount: 12 }],
    })
  })

  it('does not import when importIfMissing is false', async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: [], error: null })

    const result = await searchCatalogGamesByTitle('missing game', { importIfMissing: false })

    expect(result).toEqual({ data: [], error: null })
    expect(supabaseMocks.getSession).not.toHaveBeenCalled()
    expect(supabaseMocks.invoke).not.toHaveBeenCalled()
  })

  it('does not import for an anonymous session', async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: [], error: null })
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })

    const result = await searchCatalogGamesByTitle('missing game')

    expect(result).toEqual({ data: [], error: null })
    expect(supabaseMocks.invoke).not.toHaveBeenCalled()
  })

  it('only imports an empty local search for an authenticated user and caps the limit', async () => {
    supabaseMocks.rpc
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'refresh failed' } })
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    })
    supabaseMocks.invoke.mockResolvedValue({
      data: { games: [localGameRow], importedCount: 1 },
      error: null,
    })

    const result = await searchCatalogGamesByTitle('  final   fantasy  ', { limit: 50 })

    expect(supabaseMocks.invoke).toHaveBeenCalledWith('search-import-games', {
      body: { query: 'final fantasy', limit: 10 },
    })
    expect(result).toMatchObject({
      error: null,
      data: [{ id: 7, title: 'Hades' }],
    })
  })

  it('keeps paginated catalog reads local even when no row is found', async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: [], error: null })

    const result = await getCatalogGamesPage({ page: 2, pageSize: 20, query: 'missing' })

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('search_catalog_games', expect.objectContaining({
      p_query: 'missing',
      p_limit: 20,
      p_offset: 20,
    }))
    expect(supabaseMocks.getSession).not.toHaveBeenCalled()
    expect(supabaseMocks.invoke).not.toHaveBeenCalled()
    expect(result.data).toMatchObject({ items: [], page: 2, pageSize: 20 })
  })

  it('loads and groups facets through the local RPC', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: [
        { category: 'genre', value: 'Action', result_count: 4 },
        { category: 'platform', value: 'PC', result_count: 3 },
        { category: 'developer', value: 'Supergiant Games', result_count: 1 },
      ],
      error: null,
    })

    const result = await getCatalogFacetOptions(' hades ')

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('get_catalog_facets', { p_query: 'hades' })
    expect(result).toEqual({
      data: {
        genres: ['Action'],
        platforms: ['PC'],
        developers: ['Supergiant Games'],
      },
      error: null,
    })
  })
})
