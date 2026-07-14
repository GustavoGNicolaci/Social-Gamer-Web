import { beforeEach, describe, expect, it, vi } from 'vitest'

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
  logPerformanceTiming: vi.fn(),
}))

vi.mock('../supabase-client', () => ({
  supabase: {
    from: supabaseMocks.from,
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

describe('game status service', () => {
  beforeEach(() => {
    supabaseMocks.from.mockReset()
    supabaseMocks.logPerformanceTiming.mockReset()
  })

  it('sorts the complete authorized set by title before slicing the requested page', async () => {
    const query = createAwaitableQuery({ data: statusRows, error: null, count: 3 })
    supabaseMocks.from.mockReturnValue(query)

    const result = await getGameStatusesPageByUserId('user-1', {
      page: 1,
      pageSize: 1,
      sort: 'title',
    })

    expect(query.eq).toHaveBeenCalledWith('usuario_id', 'user-1')
    expect(query.range).not.toHaveBeenCalled()
    expect(result.data.map(item => item.jogo?.titulo)).toEqual(['Beta'])
    expect(result).toMatchObject({
      error: null,
      totalCount: 3,
      hasMore: true,
      nextPage: 2,
    })
  })

  it('keeps database pagination for recent ordering', async () => {
    const query = createAwaitableQuery({ data: [statusRows[0]], error: null, count: 3 })
    supabaseMocks.from.mockReturnValue(query)

    const result = await getGameStatusesPageByUserId('user-1', {
      page: 1,
      pageSize: 1,
      sort: 'recent',
    })

    expect(query.order).toHaveBeenCalledWith('created_at', {
      ascending: false,
      nullsFirst: false,
    })
    expect(query.range).toHaveBeenCalledWith(1, 1)
    expect(result.data).toHaveLength(1)
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
