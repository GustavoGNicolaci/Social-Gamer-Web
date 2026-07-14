import { beforeEach, describe, expect, it, vi } from 'vitest'

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  logPerformanceTiming: vi.fn(),
}))

vi.mock('../supabase-client', () => ({
  supabase: {
    from: supabaseMocks.from,
    rpc: supabaseMocks.rpc,
  },
}))

vi.mock('../utils/performanceDiagnostics', () => ({
  getPerformanceNow: vi.fn(() => 1),
  logPerformanceTiming: supabaseMocks.logPerformanceTiming,
}))

import {
  addGameToWishlist,
  deleteWishlistEntry,
  getWishlistEntry,
  getWishlistGamesPageByUserId,
  updateWishlistPriorities,
  type WishlistGameItem,
} from './wishlistService'

function createWishlistLookup(data: unknown, error: unknown = null) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  }

  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  return query
}

function createWishlistPageQuery(response: { data: unknown; error: unknown; count: number | null }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    range: vi.fn().mockResolvedValue(response),
  }

  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.order.mockReturnValue(query)
  return query
}

const firstWishlistItem: WishlistGameItem = {
  id: 'wishlist-1',
  usuario_id: 'user-1',
  jogo_id: 1,
  adicionado_em: '2026-07-01T00:00:00.000Z',
  prioridade: 1,
  jogo: {
    id: 1,
    titulo: 'Alpha',
    capa_url: null,
    desenvolvedora: null,
    generos: null,
    data_lancamento: null,
    plataformas: null,
  },
}

const secondWishlistItem: WishlistGameItem = {
  id: 'wishlist-2',
  usuario_id: 'user-1',
  jogo_id: 2,
  adicionado_em: '2026-07-02T00:00:00.000Z',
  prioridade: 2,
  jogo: {
    id: 2,
    titulo: 'Beta',
    capa_url: null,
    desenvolvedora: null,
    generos: null,
    data_lancamento: null,
    plataformas: null,
  },
}

describe('wishlist service', () => {
  beforeEach(() => {
    supabaseMocks.from.mockReset()
    supabaseMocks.rpc.mockReset()
    supabaseMocks.logPerformanceTiming.mockReset()
  })

  it('reads a page in priority order and normalizes an embedded game array', async () => {
    const pageQuery = createWishlistPageQuery({
      data: [
        { ...secondWishlistItem, jogo: [secondWishlistItem.jogo] },
        firstWishlistItem,
      ],
      error: null,
      count: 3,
    })
    supabaseMocks.from.mockReturnValue(pageQuery)

    const result = await getWishlistGamesPageByUserId('user-1', { page: 0, pageSize: 2 })

    expect(pageQuery.eq).toHaveBeenCalledWith('usuario_id', 'user-1')
    expect(pageQuery.order).toHaveBeenNthCalledWith(1, 'prioridade', {
      ascending: true,
      nullsFirst: false,
    })
    expect(pageQuery.order).toHaveBeenNthCalledWith(2, 'adicionado_em', { ascending: false })
    expect(pageQuery.range).toHaveBeenCalledWith(0, 1)
    expect(result.data.map(item => item.id)).toEqual(['wishlist-1', 'wishlist-2'])
    expect(result.data[1]?.jogo?.titulo).toBe('Beta')
    expect(result).toMatchObject({
      error: null,
      totalCount: 3,
      hasMore: true,
      nextPage: 1,
    })
  })

  it('reads an existing entry without changing it', async () => {
    const existingEntry = {
      id: 'wishlist-1',
      usuario_id: 'user-1',
      jogo_id: 1,
      adicionado_em: '2026-07-01T00:00:00.000Z',
      prioridade: 1,
    }
    supabaseMocks.from.mockReturnValue(createWishlistLookup(existingEntry))

    const result = await getWishlistEntry('user-1', 1)

    expect(result).toEqual({ data: existingEntry, error: null })
  })

  it('returns duplicate from the atomic add RPC', async () => {
    const existingEntry = {
      id: 'wishlist-1',
      usuario_id: 'user-1',
      jogo_id: 1,
      adicionado_em: '2026-07-01T00:00:00.000Z',
      prioridade: 1,
    }
    supabaseMocks.rpc.mockResolvedValue({
      data: [{ ...existingEntry, inserted: false }],
      error: null,
    })

    const result = await addGameToWishlist({ userId: 'user-1', gameId: 1 })

    expect(supabaseMocks.from).not.toHaveBeenCalled()
    expect(supabaseMocks.rpc).toHaveBeenCalledWith('add_own_wishlist_item', {
      p_game_id: 1,
    })
    expect(result).toEqual({
      status: 'duplicate',
      data: existingEntry,
      error: null,
    })
  })

  it('uses the server-assigned priority from the atomic add RPC', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: [{
          id: 'wishlist-3',
          usuario_id: 'user-1',
          jogo_id: 3,
          adicionado_em: '2026-07-13T00:00:00.000Z',
          prioridade: 4,
          inserted: true,
      }],
      error: null,
    })

    const result = await addGameToWishlist({ userId: 'user-1', gameId: 3 })

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('add_own_wishlist_item', {
      p_game_id: 3,
    })
    expect(result).toMatchObject({
      status: 'added',
      data: { id: 'wishlist-3', prioridade: 4 },
      error: null,
    })
  })

  it('persists the complete order with one atomic RPC', async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: [], error: null })

    const result = await updateWishlistPriorities('user-1', [
      firstWishlistItem,
      secondWishlistItem,
    ])

    expect(supabaseMocks.rpc).toHaveBeenCalledOnce()
    expect(supabaseMocks.rpc).toHaveBeenCalledWith('reorder_own_wishlist', {
      p_item_ids: ['wishlist-1', 'wishlist-2'],
    })
    expect(result).toEqual({
      data: [firstWishlistItem, secondWishlistItem],
      error: null,
    })
  })

  it('keeps the previous order when the atomic reorder fails', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'denied' },
    })

    const previousOrder = [secondWishlistItem, firstWishlistItem]
    const result = await updateWishlistPriorities('user-1', previousOrder)

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('reorder_own_wishlist', {
      p_item_ids: ['wishlist-2', 'wishlist-1'],
    })
    expect(result.data).toBe(previousOrder)
    expect(result.error).toMatchObject({ code: '42501', message: 'denied' })
  })

  it('requires a matching user-owned row when deleting an entry', async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: false, error: null })

    const result = await deleteWishlistEntry({
      userId: 'user-1',
      wishlistEntryId: 'wishlist-1',
    })

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('remove_own_wishlist_item', {
      p_item_id: 'wishlist-1',
    })
    expect(result.data).toBeNull()
    expect(result.error?.message).toContain('Nenhum item foi removido')
  })
})
