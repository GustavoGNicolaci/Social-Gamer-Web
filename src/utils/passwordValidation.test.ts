import { describe, expect, it, vi } from 'vitest'
import {
  getPasswordRequirementStates,
  getPasswordValidationError,
} from './passwordValidation'

describe('password validation', () => {
  it('translates requirement labels with the translator provided for the current render', () => {
    const portugueseTranslator = vi.fn((key: string) => `pt:${key}`)
    const englishTranslator = vi.fn((key: string) => `en:${key}`)

    const portugueseStates = getPasswordRequirementStates('Abc123!', portugueseTranslator, true)
    const englishStates = getPasswordRequirementStates('Abc123!', englishTranslator, true)

    expect(portugueseStates[0].label).toBe('pt:auth.passwordRequirement.letterAndNumber')
    expect(englishStates[0].label).toBe('en:auth.passwordRequirement.letterAndNumber')
    expect(portugueseTranslator).toHaveBeenCalledTimes(5)
    expect(englishTranslator).toHaveBeenCalledTimes(5)
  })

  it('returns localized validation errors without evaluating messages at module load', () => {
    const translator = vi.fn((key: string) => `translated:${key}`)

    expect(getPasswordValidationError('', translator)).toBe('translated:auth.passwordRequired')
    expect(getPasswordValidationError('weak', translator)).toBe('translated:auth.passwordInvalid')
    expect(getPasswordValidationError('Strong123!', translator)).toBeNull()
  })
})
