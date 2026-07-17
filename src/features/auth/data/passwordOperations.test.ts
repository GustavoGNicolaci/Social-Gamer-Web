import type { User } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  logClientError: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  temporarySignIn: vi.fn(),
  temporarySignOut: vi.fn(),
  updateUser: vi.fn(),
}))

vi.mock('../../../i18n', () => ({
  translate: (key: string) => key,
}))

vi.mock('../../../utils/authErrorMessages', () => ({
  isValidEmailAddress: (email: string) => email.includes('@'),
  logUnexpectedAuthError: vi.fn(),
  mapFriendlyAuthError: (error: { code?: string; message?: string }) => ({
    message: error.message || 'mapped error',
    reason: error.code === 'invalid_credentials' ? 'invalid_credentials' : 'unknown',
    shouldLog: false,
  }),
}))

vi.mock('../../../utils/clientLogging', () => ({
  logClientError: mocks.logClientError,
}))

vi.mock('../../../utils/passwordValidation', () => ({
  getPasswordValidationError: () => null,
}))

vi.mock('../../../supabase-client', () => ({
  createStatelessSupabaseClient: () => ({
    auth: {
      signInWithPassword: mocks.temporarySignIn,
      signOut: mocks.temporarySignOut,
    },
  }),
  supabase: {
    auth: {
      resetPasswordForEmail: mocks.resetPasswordForEmail,
      updateUser: mocks.updateUser,
    },
  },
}))

import {
  requestAuthenticatedPasswordReset,
  requestPasswordReset,
  updatePassword,
} from './passwordOperations'

const user = {
  id: 'user-1',
  email: 'PLAYER@EXAMPLE.COM',
} as User

beforeEach(() => {
  vi.clearAllMocks()
  mocks.resetPasswordForEmail.mockResolvedValue({ error: null })
  mocks.temporarySignIn.mockResolvedValue({ error: null })
  mocks.temporarySignOut.mockResolvedValue({ error: null })
  mocks.updateUser.mockResolvedValue({ error: null })
})

describe('passwordOperations', () => {
  it('solicita reset com email normalizado e preserva erros do servico', async () => {
    const success = await requestPasswordReset(' PLAYER@EXAMPLE.COM ')

    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith('player@example.com', {
      redirectTo: `${window.location.origin}/resetar-senha`,
    })
    expect(success).toEqual({ error: null })

    mocks.resetPasswordForEmail.mockResolvedValueOnce({
      error: { code: 'service_error', message: 'reset failed' },
    })
    const failure = await requestPasswordReset('player@example.com')
    expect(failure).toEqual({ error: 'reset failed' })
  })

  it('encerra o cliente temporario depois do reset autenticado bem-sucedido', async () => {
    const result = await requestAuthenticatedPasswordReset(user, 'current-password')

    expect(mocks.temporarySignIn).toHaveBeenCalledWith({
      email: 'player@example.com',
      password: 'current-password',
    })
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledOnce()
    expect(mocks.temporarySignOut).toHaveBeenCalledOnce()
    expect(result).toEqual({ error: null })
  })

  it('nao mascara o erro original quando o cleanup temporario falha', async () => {
    const cleanupError = new Error('cleanup failed')
    mocks.temporarySignIn.mockResolvedValue({
      error: { code: 'invalid_credentials', message: 'invalid credentials' },
    })
    mocks.temporarySignOut.mockResolvedValue({ error: cleanupError })

    const result = await requestAuthenticatedPasswordReset(user, 'wrong-password')

    expect(result).toEqual({ error: 'auth.currentPasswordInvalid' })
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled()
    expect(mocks.temporarySignOut).toHaveBeenCalledOnce()
    expect(mocks.logClientError).toHaveBeenCalledWith(
      'auth.requestAuthenticatedPasswordReset.validationSignOut',
      cleanupError
    )
  })

  it('preserva sucesso e erro na troca de senha', async () => {
    expect(await updatePassword('new-password')).toEqual({ error: null })
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'new-password' })

    mocks.updateUser.mockResolvedValueOnce({
      error: { code: 'update_error', message: 'update failed' },
    })
    expect(await updatePassword('other-password')).toEqual({ error: 'update failed' })
  })
})
