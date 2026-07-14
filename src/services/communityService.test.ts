import { beforeEach, describe, expect, it, vi } from 'vitest'

const supabaseMocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}))

vi.mock('../supabase-client', () => ({
  supabase: {
    rpc: supabaseMocks.rpc,
  },
}))

vi.mock('./storageService', () => ({
  deleteStorageFiles: vi.fn(),
  resolveCommunityPostImageUrls: vi.fn(),
}))

import { getCommunityMembers } from './communityService'

describe('community member pagination', () => {
  beforeEach(() => {
    supabaseMocks.rpc.mockReset()
  })

  it('filters and paginates on the server and maps the safe profile projection', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: [{
        comunidade_id: 'community-1',
        usuario_id: 'user-1',
        cargo: 'admin',
        entrou_em: '2026-07-01T00:00:00.000Z',
        atualizado_em: '2026-07-02T00:00:00.000Z',
        user_id: 'user-1',
        username: 'joao',
        nome_completo: 'Joao Silva',
        avatar_path: 'avatars/user-1.webp',
        total_count: 17,
      }],
      error: null,
    })

    const result = await getCommunityMembers('community-1', {
      search: '  João  ',
      limit: 20,
      offset: 40,
    })

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('get_community_members_page', {
      p_community_id: 'community-1',
      p_search: 'joao',
      p_limit: 20,
      p_offset: 40,
    })
    expect(result).toEqual({
      data: [{
        comunidade_id: 'community-1',
        usuario_id: 'user-1',
        cargo: 'admin',
        entrou_em: '2026-07-01T00:00:00.000Z',
        atualizado_em: '2026-07-02T00:00:00.000Z',
        usuario: {
          id: 'user-1',
          username: 'joao',
          nome_completo: 'Joao Silva',
          avatar_path: 'avatars/user-1.webp',
        },
      }],
      error: null,
      totalCount: 17,
    })
  })

  it('keeps an unauthorized private community empty without surfacing a UI error', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    })

    const result = await getCommunityMembers('private-community')

    expect(result).toEqual({ data: [], error: null, totalCount: null })
  })
})
