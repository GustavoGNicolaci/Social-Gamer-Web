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
  getGameStatusesPageByUserId,
  saveGameStatus,
} from './gameStatusService'

interface QueryResponse {
  data: unknown
  error: unknown
  count?: number | null
}

function createAwaitableQuery(response: QueryResponse) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    then: vi.fn(),
  }

  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.in.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.range.mockResolvedValue(response)
  query.then.mockImplementation((onFulfilled, onRejected) =>
    Promise.resolve(response).then(onFulfilled, onRejected)
  )

  return query
}

const statusRows = [
  {
    id: 'status-gamma',
    usuario_id: 'user-1',
    jogo_id: 3,
    status: 'jogando',
    created_at: '2026-07-03T00:00:00.000Z',
    favorito: false,
    jogo: {
      id: 3,
      titulo: 'Gamma',
      capa_url: null,
      desenvolvedora: null,
      generos: null,
      data_lancamento: null,
      plataformas: null,
    },
  },
  {
    id: 'status-alpha',
    usuario_id: 'user-1',
    jogo_id: 1,
    status: 'zerado',
    created_at: '2026-07-01T00:00:00.000Z',
    favorito: true,
    jogo: [{
      id: 1,
      titulo: 'Alpha',
      capa_url: null,
      desenvolvedora: null,
      generos: null,
      data_lancamento: null,
      plataformas: null,
    }],
  },
  {
    id: 'status-beta',
    usuario_id: 'user-1',
    jogo_id: 2,
    status: 'planejando',
    created_at: '2026-07-02T00:00:00.000Z',
    favorito: false,
    jogo: {
      id: 2,
      titulo: 'Beta',
      capa_url: null,
      desenvolvedora: null,
      generos: null,
      data_lancamento: null,
      plataformas: null,
    },
  },
]

const statusRpcRows = statusRows.map(row => {
  const game = Array.isArray(row.jogo) ? row.jogo[0] : row.jogo

  return {
    id: row.id,
    usuario_id: row.usuario_id,
    jogo_id: row.jogo_id,
    status: row.status,
    created_at: row.created_at,
    favorito: row.favorito,
    game_title: game.titulo,
    game_cover_url: game.capa_url,
    game_developer: game.desenvolvedora,
    game_genres: game.generos,
    game_release_date: game.data_lancamento,
    game_platforms: game.plataformas,
    total_count: 3,
  }
})

describe('game status service', () => {
  beforeEach(() => {
    supabaseMocks.from.mockReset()
    supabaseMocks.rpc.mockReset()
    supabaseMocks.logPerformanceTiming.mockReset()
  })

  it('uses the paginated RPC and maps its game fields to the existing item shape', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: [statusRpcRows[2]],
      error: null,
    })

    const result = await getGameStatusesPageByUserId('user-1', {
      page: 1,
      pageSize: 1,
      sort: 'title',
    })

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('get_profile_game_status_page', {
      p_user_id: 'user-1',
      p_statuses: null,
      p_sort: 'title',
      p_limit: 1,
      p_offset: 1,
    })
    expect(supabaseMocks.from).not.toHaveBeenCalled()
    expect(result.data.map(item => item.jogo?.titulo)).toEqual(['Beta'])
    expect(result.data[0]?.jogo).toMatchObject({
      id: 2,
      title: 'Beta',
      titulo: 'Beta',
      coverUrl: null,
      capa_url: null,
      developer: [],
      genres: [],
      platforms: [],
    })
    expect(result).toMatchObject({
      error: null,
      totalCount: 3,
      hasMore: true,
      nextPage: 2,
      timings: { requestCount: 1 },
    })
  })

  it('passes filters and zero-based pagination to the RPC', async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: [statusRpcRows[0]], error: null })

    const result = await getGameStatusesPageByUserId('user-1', {
      page: 1,
      pageSize: 1,
      sort: 'recent',
      statuses: ['jogando'],
    })

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('get_profile_game_status_page', {
      p_user_id: 'user-1',
      p_statuses: ['jogando'],
      p_sort: 'recent',
      p_limit: 1,
      p_offset: 1,
    })
    expect(result.data).toHaveLength(1)
  })

  it.each(['PGRST202', '42883'])(
    'falls back to the legacy query only when the RPC is unavailable (%s)',
    async code => {
      const query = createAwaitableQuery({ data: [statusRows[0]], error: null, count: 3 })
      supabaseMocks.rpc.mockResolvedValue({
        data: null,
        error: { code, message: 'RPC unavailable' },
      })
      supabaseMocks.from.mockReturnValue(query)

      const result = await getGameStatusesPageByUserId('user-1', {
        page: 1,
        pageSize: 1,
        sort: 'recent',
      })

      expect(supabaseMocks.from).toHaveBeenCalledWith('status_jogo')
      expect(query.range).toHaveBeenCalledWith(1, 1)
      expect(result).toMatchObject({
        error: null,
        totalCount: 3,
        timings: { requestCount: 2, fallbackUsed: true },
      })
    }
  )

  it('returns non-missing RPC errors without querying the legacy tables', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: null,
      error: {
        code: '42501',
        message: 'permission denied',
        details: 'RLS rejected the request',
      },
    })

    const result = await getGameStatusesPageByUserId('user-1')

    expect(supabaseMocks.from).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      data: [],
      error: {
        code: '42501',
        message: 'permission denied',
        details: 'RLS rejected the request',
      },
      totalCount: null,
      timings: { requestCount: 1 },
    })
    expect(supabaseMocks.logPerformanceTiming).toHaveBeenCalledWith(
      'profile.status.page',
      expect.any(Number),
      expect.objectContaining({ fallbackUsed: false, hasError: true })
    )
  })

  it('updates an existing status scoped to both user and status id', async () => {
    const existingQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: statusRows[0],
        error: null,
      }),
    }
    existingQuery.select.mockReturnValue(existingQuery)
    existingQuery.eq.mockReturnValue(existingQuery)

    const updateQuery = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({
        data: {
          ...statusRows[0],
          status: 'zerado',
          favorito: true,
        },
        error: null,
      }),
    }
    updateQuery.update.mockReturnValue(updateQuery)
    updateQuery.eq.mockReturnValue(updateQuery)
    updateQuery.select.mockReturnValue(updateQuery)

    supabaseMocks.from
      .mockReturnValueOnce(existingQuery)
      .mockReturnValueOnce(updateQuery)

    const result = await saveGameStatus({
      userId: 'user-1',
      gameId: 3,
      status: 'zerado',
      favorito: true,
    })

    expect(updateQuery.update).toHaveBeenCalledWith({ status: 'zerado', favorito: true })
    expect(updateQuery.eq).toHaveBeenNthCalledWith(1, 'usuario_id', 'user-1')
    expect(updateQuery.eq).toHaveBeenNthCalledWith(2, 'id', 'status-gamma')
    expect(result).toMatchObject({
      data: { id: 'status-gamma', status: 'zerado', favorito: true },
      error: null,
    })
  })

  it('lets the database assign the creation timestamp for a new status', async () => {
    const existingQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    existingQuery.select.mockReturnValue(existingQuery)
    existingQuery.eq.mockReturnValue(existingQuery)

    const insertQuery = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({
        data: statusRows[0],
        error: null,
      }),
    }
    insertQuery.insert.mockReturnValue(insertQuery)
    insertQuery.select.mockReturnValue(insertQuery)

    supabaseMocks.from
      .mockReturnValueOnce(existingQuery)
      .mockReturnValueOnce(insertQuery)

    const result = await saveGameStatus({
      userId: 'user-1',
      gameId: 3,
      status: 'jogando',
      favorito: false,
    })

    expect(insertQuery.insert).toHaveBeenCalledWith({
      usuario_id: 'user-1',
      jogo_id: 3,
      status: 'jogando',
      favorito: false,
    })
    expect(result.error).toBeNull()
  })
})
