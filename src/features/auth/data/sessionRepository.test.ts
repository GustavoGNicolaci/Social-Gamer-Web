import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn(),
}))

vi.mock('../../../supabase-client', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
    },
  },
}))

import { getCurrentSession, subscribeToAuthSession } from './sessionRepository'

const session = {
  access_token: 'access-token',
  user: { id: 'user-1' },
} as Session

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getSession.mockResolvedValue({
    data: { session },
    error: null,
  })
})

describe('sessionRepository', () => {
  it('le a sessao atual, encaminha mudancas e devolve o unsubscribe', async () => {
    let authCallback: ((event: AuthChangeEvent, session: Session | null) => void) | undefined
    mocks.onAuthStateChange.mockImplementation(callback => {
      authCallback = callback
      return {
        data: {
          subscription: { unsubscribe: mocks.unsubscribe },
        },
      }
    })
    const onSessionChange = vi.fn()

    expect(await getCurrentSession()).toBe(session)
    const unsubscribe = subscribeToAuthSession(onSessionChange)
    authCallback?.('SIGNED_IN', session)

    expect(onSessionChange).toHaveBeenCalledWith(session)
    unsubscribe()
    expect(mocks.unsubscribe).toHaveBeenCalledOnce()
  })
})
