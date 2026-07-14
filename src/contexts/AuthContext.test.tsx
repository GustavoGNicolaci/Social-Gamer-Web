import { act, renderHook, waitFor } from '@testing-library/react'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import type { PropsWithChildren } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const supabaseMocks = vi.hoisted(() => {
  const profileMaybeSingle = vi.fn()
  const rpc = vi.fn(() => ({ maybeSingle: profileMaybeSingle }))

  return {
    from: vi.fn(),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    profileMaybeSingle,
    rpc,
    signOut: vi.fn(),
    unsubscribe: vi.fn(),
  }
})

vi.mock('../supabase-client', () => ({
  createStatelessSupabaseClient: vi.fn(),
  supabase: {
    auth: {
      getSession: supabaseMocks.getSession,
      onAuthStateChange: supabaseMocks.onAuthStateChange,
      signOut: supabaseMocks.signOut,
    },
    from: supabaseMocks.from,
    rpc: supabaseMocks.rpc,
  },
}))

import { AuthProvider, useAuth, type UserProfile } from './AuthContext'

type AuthStateChangeCallback = (
  event: AuthChangeEvent,
  session: Session | null
) => void

const user = {
  id: 'user-1',
  email: 'player@example.com',
  user_metadata: {},
} as User

const session = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user,
} as Session

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

function AuthWrapper({ children }: PropsWithChildren) {
  return <AuthProvider>{children}</AuthProvider>
}

function getRegisteredAuthCallback() {
  const callback = supabaseMocks.onAuthStateChange.mock.calls[0]?.[0] as
    | AuthStateChangeCallback
    | undefined

  if (!callback) {
    throw new Error('Auth state listener was not registered')
  }

  return callback
}

describe('AuthProvider', () => {
  beforeEach(() => {
    supabaseMocks.from.mockReset()
    supabaseMocks.profileMaybeSingle.mockReset()
    supabaseMocks.rpc.mockClear()
    supabaseMocks.getSession.mockResolvedValue({
      data: { session },
      error: null,
    })
    supabaseMocks.profileMaybeSingle.mockResolvedValue({ data: profile, error: null })
    supabaseMocks.onAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: supabaseMocks.unsubscribe,
        },
      },
    })
  })

  it('inicializa sessão, usuário e perfil a partir da sessão persistida', async () => {
    const { result, unmount } = renderHook(() => useAuth(), { wrapper: AuthWrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(supabaseMocks.getSession).toHaveBeenCalledOnce()
    expect(supabaseMocks.rpc).toHaveBeenCalledWith('get_my_profile')
    expect(supabaseMocks.from).not.toHaveBeenCalled()
    expect(result.current.session).toBe(session)
    expect(result.current.user).toBe(user)
    expect(result.current.profile).toEqual(profile)

    unmount()
    expect(supabaseMocks.unsubscribe).toHaveBeenCalledOnce()
  })

  it('limpa os dados autenticados ao receber o evento de logout', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthWrapper })

    await waitFor(() => expect(result.current.profile).toEqual(profile))

    const authStateChangeCallback = getRegisteredAuthCallback()

    await act(async () => {
      authStateChangeCallback('SIGNED_OUT', null)
      await Promise.resolve()
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.session).toBeNull()
    expect(result.current.user).toBeNull()
    expect(result.current.profile).toBeNull()
  })

  it('atualiza sem retornar colunas sensíveis da tabela e recarrega pela RPC própria', async () => {
    const updatedProfile = { ...profile, bio: 'Updated bio' }
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq: updateEq }))
    supabaseMocks.from.mockReturnValue({ update })
    supabaseMocks.profileMaybeSingle
      .mockResolvedValueOnce({ data: profile, error: null })
      .mockResolvedValueOnce({ data: updatedProfile, error: null })

    const { result } = renderHook(() => useAuth(), { wrapper: AuthWrapper })

    await waitFor(() => expect(result.current.profile).toEqual(profile))

    let updateResult: Awaited<ReturnType<typeof result.current.updateOwnProfile>> | undefined
    await act(async () => {
      updateResult = await result.current.updateOwnProfile({ bio: 'Updated bio' })
    })

    expect(supabaseMocks.from).toHaveBeenCalledWith('usuarios')
    expect(update).toHaveBeenCalledWith({ bio: 'Updated bio' })
    expect(updateEq).toHaveBeenCalledWith('id', user.id)
    expect(supabaseMocks.rpc).toHaveBeenLastCalledWith('get_my_profile')
    expect(updateResult).toEqual({ data: updatedProfile, error: null })
    expect(result.current.profile).toEqual(updatedProfile)
  })
})

describe('useAuth', () => {
  it('falha de forma explícita quando usado fora do AuthProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within AuthProvider'
    )

    consoleError.mockRestore()
  })
})
