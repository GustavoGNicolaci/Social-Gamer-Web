import type { User } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserProfile } from '../domain/types'

const supabaseMocks = vi.hoisted(() => {
  const maybeSingle = vi.fn()
  const rpc = vi.fn(() => ({ maybeSingle }))
  const from = vi.fn()

  return {
    from,
    maybeSingle,
    rpc,
  }
})

vi.mock('../../../supabase-client', () => ({
  supabase: {
    from: supabaseMocks.from,
    rpc: supabaseMocks.rpc,
  },
}))

import { fetchOrCreateProfile } from './profileRepository'

const user = {
  id: 'user-1',
  email: 'player@example.com',
  user_metadata: {
    username: 'player-one',
    nome_completo: '  Player   One  ',
  },
} as unknown as User

const profile: UserProfile = {
  id: user.id,
  username: 'player-one',
  nome_completo: 'Player One',
  avatar_path: null,
  avatar_url: null,
  bio: null,
  data_cadastro: '2026-01-01T00:00:00.000Z',
  configuracoes_privacidade: {},
}

beforeEach(() => {
  supabaseMocks.from.mockReset()
  supabaseMocks.maybeSingle.mockReset()
  supabaseMocks.rpc.mockReset()
  supabaseMocks.rpc.mockImplementation(() => ({
    maybeSingle: supabaseMocks.maybeSingle,
  }))
})

describe('profileRepository', () => {
  it('retorna o perfil existente sem tentar cria-lo novamente', async () => {
    supabaseMocks.maybeSingle.mockResolvedValue({ data: profile, error: null })

    const result = await fetchOrCreateProfile(user)

    expect(result).toEqual(profile)
    expect(supabaseMocks.rpc).toHaveBeenCalledOnce()
    expect(supabaseMocks.rpc).toHaveBeenCalledWith('get_my_profile')
    expect(supabaseMocks.from).not.toHaveBeenCalled()
  })

  it('trata a corrida 23505 buscando o perfil criado pela outra requisicao', async () => {
    const insert = vi.fn().mockResolvedValue({
      error: { code: '23505', message: 'duplicate key' },
    })
    supabaseMocks.from.mockReturnValue({ insert })
    supabaseMocks.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: profile, error: null })

    const result = await fetchOrCreateProfile(user)

    expect(supabaseMocks.from).toHaveBeenCalledWith('usuarios')
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      id: user.id,
      username: 'player-one',
      nome_completo: 'Player One',
      avatar_path: null,
      avatar_url: null,
      bio: null,
      configuracoes_privacidade: {},
    }))
    expect(supabaseMocks.rpc).toHaveBeenCalledTimes(2)
    expect(result).toEqual(profile)
  })

  it('repara username e nome legados e recarrega pela RPC segura', async () => {
    const legacyProfile: UserProfile = {
      ...profile,
      username: 'player',
      nome_completo: 'player@example.com',
    }
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq }))
    supabaseMocks.from.mockReturnValue({ update })
    supabaseMocks.maybeSingle
      .mockResolvedValueOnce({ data: legacyProfile, error: null })
      .mockResolvedValueOnce({ data: profile, error: null })

    const result = await fetchOrCreateProfile(user)

    expect(supabaseMocks.from).toHaveBeenCalledWith('usuarios')
    expect(update).toHaveBeenCalledWith({
      username: 'player-one',
      nome_completo: 'Player One',
    })
    expect(eq).toHaveBeenCalledWith('id', user.id)
    expect(supabaseMocks.rpc).toHaveBeenCalledTimes(2)
    expect(result).toEqual(profile)
  })
})
