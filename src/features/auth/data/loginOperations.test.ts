import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
}))

vi.mock('../../../supabase-client', () => ({
  supabase: {
    auth: {
      signInWithPassword: mocks.signInWithPassword,
    },
  },
}))

import { loginWithPassword } from './loginOperations'

beforeEach(() => {
  mocks.signInWithPassword.mockReset()
})

describe('loginWithPassword', () => {
  it('normaliza as credenciais e retorna sucesso', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: null })

    const result = await loginWithPassword(' PLAYER@EXAMPLE.COM ', 'password')

    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'player@example.com',
      password: 'password',
    })
    expect(result).toEqual({ error: null })
  })

  it('preserva a mensagem amigavel em falha de login', async () => {
    mocks.signInWithPassword.mockResolvedValue({
      error: {
        code: 'invalid_credentials',
        message: 'Invalid login credentials',
        status: 400,
      },
    })

    const result = await loginWithPassword('player@example.com', 'wrong-password')

    expect(result.error).toBeTruthy()
  })
})
