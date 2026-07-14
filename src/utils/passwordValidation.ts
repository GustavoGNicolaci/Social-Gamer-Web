export type PasswordRequirementId =
  | 'letterAndNumber'
  | 'minLength'
  | 'lowercase'
  | 'uppercase'
  | 'symbol'

export type PasswordRequirementStatus = 'pending' | 'invalid' | 'valid'
export type PasswordTranslator = (key: string) => string

interface PasswordRequirementDefinition {
  id: PasswordRequirementId
  labelKey: string
  validate: (password: string) => boolean
}

export interface PasswordRequirementState {
  id: PasswordRequirementId
  label: string
  isMet: boolean
  status: PasswordRequirementStatus
}

const PASSWORD_MIN_LENGTH = 8
const LETTER_REGEX = /[A-Za-z]/
const NUMBER_REGEX = /\d/
const LOWERCASE_REGEX = /[a-z]/
const UPPERCASE_REGEX = /[A-Z]/
const SYMBOL_REGEX = /[^A-Za-z0-9\s]/

const PASSWORD_REQUIREMENT_DEFINITIONS: PasswordRequirementDefinition[] = [
  {
    id: 'letterAndNumber',
    labelKey: 'auth.passwordRequirement.letterAndNumber',
    validate: (password) => LETTER_REGEX.test(password) && NUMBER_REGEX.test(password),
  },
  {
    id: 'minLength',
    labelKey: 'auth.passwordRequirement.minLength',
    validate: (password) => password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: 'lowercase',
    labelKey: 'auth.passwordRequirement.lowercase',
    validate: (password) => LOWERCASE_REGEX.test(password),
  },
  {
    id: 'uppercase',
    labelKey: 'auth.passwordRequirement.uppercase',
    validate: (password) => UPPERCASE_REGEX.test(password),
  },
  {
    id: 'symbol',
    labelKey: 'auth.passwordRequirement.symbol',
    validate: (password) => SYMBOL_REGEX.test(password),
  },
]

export const getPasswordRequirementStates = (
  password: string,
  translator: PasswordTranslator,
  shouldValidate = false
): PasswordRequirementState[] => {
  const isNeutralState = !shouldValidate

  return PASSWORD_REQUIREMENT_DEFINITIONS.map(({ id, labelKey, validate }) => {
    const isMet = validate(password)

    return {
      id,
      label: translator(labelKey),
      isMet,
      status: isNeutralState ? 'pending' : isMet ? 'valid' : 'invalid',
    }
  })
}

export const isPasswordValid = (password: string) =>
  PASSWORD_REQUIREMENT_DEFINITIONS.every(({ validate }) => validate(password))

export const getPasswordValidationError = (
  password: string,
  translator: PasswordTranslator
) => {
  if (!password) {
    return translator('auth.passwordRequired')
  }

  if (isPasswordValid(password)) {
    return null
  }

  return translator('auth.passwordInvalid')
}
