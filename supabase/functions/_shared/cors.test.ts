import { describe, expect, it } from 'vitest'
import { resolveCors } from './cors'

function requestFrom(origin?: string) {
  return new Request('https://project.supabase.co/functions/v1/example', {
    method: 'POST',
    headers: origin ? { Origin: origin } : undefined,
  })
}

function env(values: Record<string, string | undefined>) {
  return (name: string) => values[name]
}

describe('resolveCors', () => {
  it('echoes an explicitly allowed origin instead of using a wildcard', () => {
    const result = resolveCors(
      requestFrom('https://social-gamer.example'),
      env({ CORS_ALLOWED_ORIGINS: 'https://social-gamer.example, https://admin.example/' })
    )

    expect(result.allowed).toBe(true)
    expect(result.headers['Access-Control-Allow-Origin']).toBe('https://social-gamer.example')
    expect(result.headers['Access-Control-Allow-Origin']).not.toBe('*')
  })

  it('rejects a browser origin that was not configured', () => {
    const result = resolveCors(
      requestFrom('https://untrusted.example'),
      env({ CORS_ALLOWED_ORIGINS: 'https://social-gamer.example' })
    )

    expect(result.allowed).toBe(false)
    expect(result.headers['Access-Control-Allow-Origin']).toBeUndefined()
  })

  it('allows loopback origins automatically only for a local Supabase runtime', () => {
    const localResult = resolveCors(
      requestFrom('http://localhost:5173'),
      env({ SUPABASE_URL: 'http://127.0.0.1:54321' })
    )
    const hostedResult = resolveCors(
      requestFrom('http://localhost:5173'),
      env({ SUPABASE_URL: 'https://project.supabase.co' })
    )

    expect(localResult.allowed).toBe(true)
    expect(hostedResult.allowed).toBe(false)
  })

  it('supports an explicit localhost opt-in for hosted development projects', () => {
    const result = resolveCors(
      requestFrom('http://127.0.0.1:4173'),
      env({
        SUPABASE_URL: 'https://project.supabase.co',
        CORS_ALLOW_LOCALHOST: 'true',
      })
    )

    expect(result.allowed).toBe(true)
    expect(result.headers['Access-Control-Allow-Origin']).toBe('http://127.0.0.1:4173')
  })

  it('keeps server-to-server requests without Origin available', () => {
    const result = resolveCors(requestFrom(), env({}))

    expect(result.allowed).toBe(true)
    expect(result.headers['Access-Control-Allow-Origin']).toBeUndefined()
  })
})
