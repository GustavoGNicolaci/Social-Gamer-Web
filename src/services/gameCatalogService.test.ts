import { beforeEach, describe, expect, it, vi } from 'vitest'

const supabaseMocks = vi.hoisted(() => {
  const externalIdsIn = vi.fn()
  const externalIdsEq = vi.fn(() => ({ in: externalIdsIn }))
  const externalIdsSelect = vi.fn(() => ({ eq: externalIdsEq }))
  const gamesIn = vi.fn()
  const gamesSelect = vi.fn(() => ({ in: gamesIn }))

  return {
    rpc: vi.fn(),
    invoke: vi.fn(),
    getSession: vi.fn(),
    from: vi.fn((table: string) => ({
      select: table === 'game_external_ids' ? externalIdsSelect : gamesSelect,
    })),
    externalIdsIn,
    gamesIn,
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
  getCatalogGameDetailsById,
  getCatalogGamesByIds,
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
    supabaseMocks.gamesIn.mockReset()
    supabaseMocks.gamesIn.mockResolvedValue({ data: [], error: null })
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

  it('does not query the catalog for a title shorter than the import threshold', async () => {
    const result = await searchCatalogGamesByTitle(' a ')

    expect(result).toEqual({ data: [], error: null })
    expect(supabaseMocks.rpc).not.toHaveBeenCalled()
    expect(supabaseMocks.getSession).not.toHaveBeenCalled()
    expect(supabaseMocks.invoke).not.toHaveBeenCalled()
  })

  it('normalizes page inputs, filters, totals, and the maximum page size', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: [{ ...localGameRow, total_count: '201' }],
      error: null,
    })

    const result = await getCatalogGamesPage({
      page: 3.9,
      pageSize: 999,
      query: '  final   fantasy ',
      genres: [' Action ', 'Action', ''],
      platforms: [' PC ', 'PC'],
      developers: [' Square Enix '],
      sort: 'rating-asc',
    })

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('search_catalog_games', {
      p_query: 'final fantasy',
      p_genres: ['Action'],
      p_platforms: ['PC'],
      p_developers: ['Square Enix'],
      p_sort: 'rating-asc',
      p_limit: 100,
      p_offset: 200,
    })
    expect(result).toMatchObject({
      error: null,
      data: {
        items: [{ id: 7, title: 'Hades' }],
        totalCount: 201,
        totalPages: 3,
        page: 3,
        pageSize: 100,
      },
    })
  })

  it('returns the stable empty page shape and normalized query error', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: null,
      error: {
        message: 'database unavailable',
        details: 'connection refused',
        hint: 'retry',
      },
    })

    const result = await getCatalogGamesPage({ page: 2, pageSize: 12 })

    expect(result).toEqual({
      data: {
        items: [],
        totalCount: 0,
        totalPages: 0,
        page: 2,
        pageSize: 12,
      },
      error: {
        code: 'catalog_query_failed',
        message: 'database unavailable',
        details: 'connection refused',
        hint: 'retry',
      },
    })
  })

  it('returns empty facets with the catalog facet error code', async () => {
    supabaseMocks.rpc.mockRejectedValue(new Error('facet network failure'))

    const result = await getCatalogFacetOptions()

    expect(result).toEqual({
      data: {
        genres: [],
        platforms: [],
        developers: [],
      },
      error: {
        code: 'catalog_facets_failed',
        message: 'facet network failure',
        details: null,
        hint: null,
      },
    })
  })

  it('deduplicates ids, loads local games, and attaches IGDB ids', async () => {
    supabaseMocks.gamesIn.mockResolvedValue({
      data: [localGameRow],
      error: null,
    })
    supabaseMocks.externalIdsIn.mockResolvedValue({
      data: [{ jogo_id: '7', external_id: ' 1234 ' }],
      error: null,
    })

    const result = await getCatalogGamesByIds([7, 7, 0, -1, 2.5])

    expect(supabaseMocks.from).toHaveBeenNthCalledWith(1, 'jogos')
    expect(supabaseMocks.gamesIn).toHaveBeenCalledWith('id', [7])
    expect(supabaseMocks.from).toHaveBeenNthCalledWith(2, 'game_external_ids')
    expect(supabaseMocks.externalIdsIn).toHaveBeenCalledWith('jogo_id', [7])
    expect(result).toMatchObject({
      error: null,
      data: [{ id: 7, title: 'Hades', igdbId: '1234' }],
    })
  })

  it('short-circuits an empty id list without hitting Supabase', async () => {
    const result = await getCatalogGamesByIds([0, -1, 1.5])

    expect(result).toEqual({ data: [], error: null })
    expect(supabaseMocks.from).not.toHaveBeenCalled()
  })

  it('rejects invalid detail ids without invoking the edge function', async () => {
    const result = await getCatalogGameDetailsById(Number.NaN)

    expect(result).toEqual({
      data: null,
      error: { message: 'Nao foi possivel identificar o jogo.' },
    })
    expect(supabaseMocks.invoke).not.toHaveBeenCalled()
  })

  it('loads and normalizes game details through the catalog function', async () => {
    supabaseMocks.invoke.mockResolvedValue({
      data: {
        game: {
          ...localGameRow,
          descricao: 'Escape from the Underworld.',
          slug: 'hades',
          media: [],
        },
      },
      error: null,
    })

    const result = await getCatalogGameDetailsById(7)

    expect(supabaseMocks.invoke).toHaveBeenCalledWith('game-catalog', {
      body: {
        action: 'details',
        gameId: 7,
        locale: expect.any(String),
      },
    })
    expect(result).toMatchObject({
      error: null,
      data: {
        id: 7,
        title: 'Hades',
        slug: 'hades',
        description: 'Escape from the Underworld.',
      },
    })
  })

  it('maps known catalog function error codes to stable messages', async () => {
    supabaseMocks.invoke.mockResolvedValue({
      data: { error: 'game_not_identified' },
      error: null,
    })

    const result = await getCatalogGameDetailsById(7)

    expect(result).toEqual({
      data: null,
      error: {
        code: 'game_not_identified',
        message: 'Nao foi possivel identificar o jogo.',
      },
    })
  })
})
