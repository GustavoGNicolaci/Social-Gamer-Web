import type { User } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  eq: vi.fn(),
  fetchOrCreateProfile: vi.fn(),
  from: vi.fn(),
  limit: vi.fn(),
  select: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
}))

vi.mock('../../../supabase-client', () => ({
  supabase: {
    auth: {
      signOut: mocks.signOut,
      signUp: mocks.signUp,
    },
    from: mocks.from,
  },
}))

vi.mock('./profileRepository', () => ({
  fetchOrCreateProfile: mocks.fetchOrCreateProfile,
}))

import { registerAccount } from './registrationOperations'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.limit.mockResolvedValue({ data: [], error: null })
  mocks.eq.mockReturnValue({ limit: mocks.limit })
  mocks.select.mockReturnValue({ eq: mocks.eq })
  mocks.from.mockReturnValue({ select: mocks.select })
})

describe('registerAccount', () => {
  it('preserva o fluxo que exige confirmacao por email', async () => {
    const pendingUser = {
      id: 'user-confirmation',
      email: 'player@example.com',
      confirmation_sent_at: '2026-01-01T00:00:00.000Z',
      identities: [{ id: 'identity-1' }],
      user_metadata: {
        username: 'player-one',
        nome_completo: 'Player One',
      },
    } as unknown as User
    mocks.signUp.mockResolvedValue({
      data: { user: pendingUser, session: null },
      error: null,
    })

    const result = await registerAccount({
      username: ' player-one ',
      name: '  Player   One ',
      email: ' PLAYER@EXAMPLE.COM ',
      password: 'StrongPassword123!',
    })

    expect(mocks.from).toHaveBeenCalledWith('usuarios')
    expect(mocks.eq).toHaveBeenCalledWith('username', 'player-one')
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: 'player@example.com',
      password: 'StrongPassword123!',
      options: {
        data: {
          username: 'player-one',
          nome_completo: 'Player One',
        },
      },
    })
    expect(result).toEqual({
      result: { status: 'email_confirmation_required' },
    })
    expect(mocks.fetchOrCreateProfile).not.toHaveBeenCalled()
    expect(mocks.signOut).not.toHaveBeenCalled()
  })
})
