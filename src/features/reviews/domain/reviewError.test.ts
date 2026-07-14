import { describe, expect, it } from 'vitest'
import { normalizeReviewError } from './reviewError'

describe('normalizeReviewError', () => {
  it('preserves the supported fields from a Supabase-style error', () => {
    expect(
      normalizeReviewError(
        {
          code: '23505',
          message: 'Duplicate review',
          details: 'The review already exists.',
          hint: 'Update the existing review instead.',
        },
        'Fallback message'
      )
    ).toEqual({
      code: '23505',
      message: 'Duplicate review',
      details: 'The review already exists.',
      hint: 'Update the existing review instead.',
    })
  })

  it('uses the fallback while normalizing unsupported fields', () => {
    expect(
      normalizeReviewError(
        { code: 500, message: null, details: false, hint: undefined },
        'Fallback message'
      )
    ).toEqual({
      code: undefined,
      message: 'Fallback message',
      details: null,
      hint: null,
    })
  })

  it('uses the fallback for non-object errors', () => {
    expect(normalizeReviewError('network failure', 'Fallback message')).toEqual({
      message: 'Fallback message',
    })
  })
})
