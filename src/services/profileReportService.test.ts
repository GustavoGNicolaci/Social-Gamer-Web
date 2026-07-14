import { beforeEach, describe, expect, it, vi } from 'vitest'

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('../supabase-client', () => ({
  supabase: {
    from: supabaseMocks.from,
  },
}))

import { submitProfileReport } from './profileReportService'

describe('profile report service', () => {
  beforeEach(() => {
    supabaseMocks.from.mockReset()
  })

  it('lets the database assign the reported name, status and timestamp', async () => {
    const query = {
      insert: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    query.insert.mockReturnValue(query)
    query.select.mockReturnValue(query)
    supabaseMocks.from.mockReturnValue(query)

    const result = await submitProfileReport({
      reporterId: 'reporter-1',
      reportedUserId: 'reported-1',
      reason: 'spam',
      description: '  Perfil repetitivo  ',
    })

    expect(query.insert).toHaveBeenCalledWith({
      denunciante_id: 'reporter-1',
      usuario_denunciado_id: 'reported-1',
      motivo: 'spam',
      descricao: 'Perfil repetitivo',
    })
    expect(result).toEqual({ status: 'created', data: null, error: null })
  })
})
