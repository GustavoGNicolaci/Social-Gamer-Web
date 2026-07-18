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
  normalizeGameStatusPageOptions,
  sortStatusItemsByDisplayOrder,
  type GameStatusItem,
} from '../features/profile/domain/gameStatus'
import {
  deleteGameStatus,
  getGameStatusEntry,
  saveGameStatus,
} from './gameStatusService'

const statusItem = {
  id: 'status-1',
  usuario_id: 'user-1',
  jogo_id: 1,
  status: 'jogando' as const,
  created_at: '2026-07-01T00:00:00.000Z',
  favorito: false,
}

describe('game status domain and mutation edge cases', () => {
  beforeEach(() => {
    supabaseMocks.from.mockReset()
    supabaseMocks.rpc.mockReset()
  })

  it('clamps pagination and removes duplicate or invalid status filters', () => {
    expect(
      normalizeGameStatusPageOptions({
        page: -3,
        pageSize: 200,
        statuses: ['jogando', 'jogando', 'zerado'],
      })
    ).toEqual({
      page: 0,
      pageSize: 48,
      from: 0,
      to: 47,
      sort: 'recent',
      statuses: ['jogando', 'zerado'],
    })
  })

  it('sorts the complete authorized collection by title before callers slice it', () => {
    const items: GameStatusItem[] = [
      { ...statusItem, id: 'status-z', jogo_id: 3, jogo: { id: 3, titulo: 'Zulu' } as GameStatusItem['jogo'] },
      { ...statusItem, id: 'status-a', jogo_id: 1, jogo: { id: 1, titulo: 'Alpha' } as GameStatusItem['jogo'] },
      { ...statusItem, id: 'status-b', jogo_id: 2, jogo: { id: 2, titulo: 'Beta' } as GameStatusItem['jogo'] },
    ]

    expect(
      sortStatusItemsByDisplayOrder(items, 'title').map(item => item.jogo?.titulo)
    ).toEqual(['Alpha', 'Beta', 'Zulu'])
  })

  it('rejects invalid save input before reaching Supabase', async () => {
    const result = await saveGameStatus({
      userId: '',
      gameId: 0,
      status: 'jogando',
      favorito: false,
    })

    expect(result.data).toBeNull()
    expect(result.error).not.toBeNull()
    expect(supabaseMocks.from).not.toHaveBeenCalled()
  })

  it('recovers from an insert race by updating the now-existing row', async () => {
    const lookup = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    lookup.select.mockReturnValue(lookup)
    lookup.eq.mockReturnValue(lookup)

    const insert = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '23505', message: 'duplicate' },
      }),
    }
    insert.insert.mockReturnValue(insert)
    insert.select.mockReturnValue(insert)

    const update = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({
        data: { ...statusItem, status: 'zerado', favorito: true },
        error: null,
      }),
    }
    update.update.mockReturnValue(update)
    update.eq.mockReturnValue(update)
    update.select.mockReturnValue(update)

    supabaseMocks.from
      .mockReturnValueOnce(lookup)
      .mockReturnValueOnce(insert)
      .mockReturnValueOnce(update)

    const result = await saveGameStatus({
      userId: 'user-1',
      gameId: 1,
      status: 'zerado',
      favorito: true,
    })

    expect(update.eq).toHaveBeenNthCalledWith(1, 'usuario_id', 'user-1')
    expect(update.eq).toHaveBeenNthCalledWith(2, 'jogo_id', 1)
    expect(result).toMatchObject({
      data: { status: 'zerado', favorito: true },
      error: null,
    })
  })

  it('returns an empty entry without treating it as a query error', async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    supabaseMocks.from.mockReturnValue(query)

    await expect(getGameStatusEntry('user-1', 1)).resolves.toEqual({
      data: null,
      error: null,
    })
  })

  it('reports when a scoped delete does not remove any row', async () => {
    const query = {
      delete: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    query.delete.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    query.select.mockReturnValue(query)
    supabaseMocks.from.mockReturnValue(query)

    const result = await deleteGameStatus({
      userId: 'user-1',
      statusId: 'status-1',
    })

    expect(query.eq).toHaveBeenNthCalledWith(1, 'id', 'status-1')
    expect(query.eq).toHaveBeenNthCalledWith(2, 'usuario_id', 'user-1')
    expect(result.error?.message).toContain('Nenhum status foi removido')
  })
})
