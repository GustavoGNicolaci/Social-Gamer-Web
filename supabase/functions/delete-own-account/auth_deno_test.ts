import {
  extractBearerToken,
  revokeGlobalSessions,
  validateWithTemporarySession,
} from './auth.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

Deno.test('extractBearerToken accepts one valid Bearer credential only', () => {
  assert(
    extractBearerToken('Bearer access.token.value') === 'access.token.value',
    'expected a valid Bearer token to be extracted',
  )
  assert(
    extractBearerToken('Bearer token another-token') === null,
    'expected an ambiguous authorization header to be rejected',
  )
})

Deno.test('validateWithTemporarySession always closes a created session', async () => {
  let signOutCalls = 0

  const isValid = await validateWithTemporarySession({
    signIn: () => Promise.resolve({ data: { session: {} }, error: null }),
    signOut: () => {
      signOutCalls += 1
      return Promise.resolve({ error: null })
    },
  })

  assert(isValid, 'expected the temporary validation session to be accepted')
  assert(signOutCalls === 1, 'expected the temporary session to be closed once')
})

Deno.test('revokeGlobalSessions requests global revocation for the access token', async () => {
  let receivedToken = ''
  let receivedScope = ''

  const result = await revokeGlobalSessions(
    'authenticated-token',
    (accessToken, scope) => {
      receivedToken = accessToken
      receivedScope = scope
      return Promise.resolve({ error: null })
    },
  )

  assert(result.ok, 'expected global session revocation to succeed')
  assert(receivedToken === 'authenticated-token', 'expected the access token to be forwarded')
  assert(receivedScope === 'global', 'expected the global revocation scope')
})
