import { describe, expect, it, vi } from 'vitest'
import {
  extractBearerToken,
  revokeGlobalSessions,
  validateWithTemporarySession,
} from './auth'

describe('delete-own-account auth helpers', () => {
  describe('extractBearerToken', () => {
    it('extracts one bearer credential case-insensitively', () => {
      expect(extractBearerToken('Bearer access.token.value')).toBe('access.token.value')
      expect(extractBearerToken('bearer\taccess-token')).toBe('access-token')
    })

    it.each([
      null,
      '',
      'Basic access-token',
      'Bearer',
      'Bearer token another-token',
      'Bearer token\nInjected: value',
    ])('rejects a missing or malformed authorization header: %s', header => {
      expect(extractBearerToken(header)).toBeNull()
    })
  })

  describe('validateWithTemporarySession', () => {
    it('always closes a successfully created temporary session locally', async () => {
      const signOut = vi.fn().mockResolvedValue({ error: null })

      const result = await validateWithTemporarySession({
        signIn: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
        signOut,
      })

      expect(result).toBe(true)
      expect(signOut).toHaveBeenCalledOnce()
    })

    it('does not mask a valid password when temporary-session cleanup fails', async () => {
      const cleanupError = new Error('cleanup failed')
      const onCleanupError = vi.fn()

      const result = await validateWithTemporarySession({
        signIn: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
        signOut: vi.fn().mockRejectedValue(cleanupError),
        onCleanupError,
      })

      expect(result).toBe(true)
      expect(onCleanupError).toHaveBeenCalledWith(cleanupError)
    })

    it('does not sign out when authentication did not create a session', async () => {
      const signOut = vi.fn()

      const result = await validateWithTemporarySession({
        signIn: vi.fn().mockResolvedValue({
          data: { session: null },
          error: new Error('invalid credentials'),
        }),
        signOut,
      })

      expect(result).toBe(false)
      expect(signOut).not.toHaveBeenCalled()
    })
  })

  describe('revokeGlobalSessions', () => {
    it('passes the authenticated access token with global scope', async () => {
      const signOut = vi.fn().mockResolvedValue({ error: null })

      const result = await revokeGlobalSessions('authenticated-token', signOut)

      expect(result).toEqual({ ok: true, error: null })
      expect(signOut).toHaveBeenCalledWith('authenticated-token', 'global')
    })

    it('turns returned and thrown revocation failures into a failed result', async () => {
      const returnedError = new Error('returned failure')
      const thrownError = new Error('thrown failure')

      await expect(revokeGlobalSessions(
        'authenticated-token',
        vi.fn().mockResolvedValue({ error: returnedError })
      )).resolves.toEqual({ ok: false, error: returnedError })
      await expect(revokeGlobalSessions(
        'authenticated-token',
        vi.fn().mockRejectedValue(thrownError)
      )).resolves.toEqual({ ok: false, error: thrownError })
    })
  })
})
