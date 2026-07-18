import { beforeEach, describe, expect, it, vi } from 'vitest'

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('../supabase-client', () => ({
  supabase: {
    from: supabaseMocks.from,
    rpc: supabaseMocks.rpc,
  },
}))

vi.mock('../utils/performanceDiagnostics', () => ({
  getPerformanceNow: vi.fn(() => 1),
  logPerformanceTiming: vi.fn(),
}))

import {
  normalizeWishlistPageOptions,
  sortWishlistItemsByDisplayOrder,
} from '../features/profile/domain/wishlist'
import {
  addGameToWishlist,
  deleteWishlistEntry,
  updateWishlistPriorities,
  type WishlistGameItem,
} from './wishlistService'

const baseItem: WishlistGameItem = {
  id: 'wishlist-base',
  usuario_id: 'user-1',
  jogo_id: 1,
  adicionado_em: '2026-07-01T00:00:00.000Z',
  prioridade: 1,
  jogo: null,
}

describe('wishlist domain and mutation edge cases', () => {
  beforeEach(() => {
    supabaseMocks.from.mockReset()
    supabaseMocks.rpc.mockReset()
  })

  it('clamps page options to the supported range', () => {
    expect(normalizeWishlistPageOptions({ page: -2, pageSize: 1000 })).toEqual({
      page: 0,
      pageSize: 48,
      from: 0,
      to: 47,
    })
  })

  it('places null priorities after explicit priorities with stable tie breakers', () => {
    const items = [
      {
        ...baseItem,
        id: 'unprioritized-old',
        prioridade: null,
        adicionado_em: '2026-06-01T00:00:00.000Z',
      },
      {
        ...baseItem,
        id: 'priority-two',
        prioridade: 2,
        adicionado_em: '2026-07-01T00:00:00.000Z',
      },
      {
        ...baseItem,
        id: 'priority-one',
        prioridade: 1,
        adicionado_em: '2026-05-01T00:00:00.000Z',
      },
      {
        ...baseItem,
        id: 'unprioritized-new',
        prioridade: null,
        adicionado_em: '2026-07-02T00:00:00.000Z',
      },
    ]

    expect(sortWishlistItemsByDisplayOrder(items).map(item => item.id)).toEqual([
      'priority-one',
      'priority-two',
      'unprioritized-new',
      'unprioritized-old',
    ])
  })

  it('rejects invalid additions without invoking the atomic RPC', async () => {
    const result = await addGameToWishlist({ userId: '', gameId: 0 })

    expect(result.status).toBe('error')
    expect(supabaseMocks.rpc).not.toHaveBeenCalled()
  })

  it('preserves the exact previous collection when user validation fails', async () => {
    const previousOrder = [
      { ...baseItem, id: 'wishlist-2' },
      { ...baseItem, id: 'wishlist-1' },
    ]

    const result = await updateWishlistPriorities('', previousOrder)

    expect(result.data).toBe(previousOrder)
    expect(result.error).not.toBeNull()
    expect(supabaseMocks.rpc).not.toHaveBeenCalled()
  })

  it('rejects an invalid deletion before reaching Supabase', async () => {
    const result = await deleteWishlistEntry({
      userId: 'user-1',
      wishlistEntryId: '',
    })

    expect(result.error).not.toBeNull()
    expect(supabaseMocks.rpc).not.toHaveBeenCalled()
  })
})
