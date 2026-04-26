import { translate } from '../i18n'

export type PasswordRequirementId = 'letterAndNumber' | 'minLength' | 'uppercase' | 'symbol'

export type PasswordRequirementStatus = 'pending' | 'invalid' | 'valid'

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
const UPPERCASE_REGEX = /[A-Z]/
const SYMBOL_REGEX = /[^A-Za-z0-9\s]/

export const PASSWORD_REQUIREMENTS_TITLE = translate('auth.passwordRequirementsTitle')
export const PASSWORD_REQUIRED_MESSAGE = translate('auth.passwordRequired')
export const PASSWORD_INVALID_MESSAGE = translate('auth.passwordInvalid')

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

export const PASSWORD_REQUIREMENTS = PASSWORD_REQUIREMENT_DEFINITIONS.map(({ id, labelKey }) => ({
  id,
  label: translate(labelKey),
}))

export const getPasswordRequirementStates = (
  password: string,
  shouldValidate = false
): PasswordRequirementState[] => {
  const isNeutralState = !shouldValidate

  return PASSWORD_REQUIREMENT_DEFINITIONS.map(({ id, labelKey, validate }) => {
    const isMet = validate(password)

    return {
      id,
      label: translate(labelKey),
      isMet,
      status: isNeutralState ? 'pending' : isMet ? 'valid' : 'invalid',
    }
  })
}

export const isPasswordValid = (password: string) =>
  PASSWORD_REQUIREMENT_DEFINITIONS.every(({ validate }) => validate(password))

export const getPasswordValidationError = (password: string) => {
  if (!password) {
    return translate('auth.passwordRequired')
  }

  if (isPasswordValid(password)) {
    return null
  }

  return translate('auth.passwordInvalid')
}
