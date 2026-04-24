export type PasswordRequirementId = 'letterAndNumber' | 'minLength' | 'uppercase' | 'symbol'

export type PasswordRequirementStatus = 'pending' | 'invalid' | 'valid'

interface PasswordRequirementDefinition {
  id: PasswordRequirementId
  label: string
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

export const PASSWORD_REQUIREMENTS_TITLE = 'Sua senha precisa ter:'
export const PASSWORD_REQUIRED_MESSAGE = 'Senha e obrigatoria.'
export const PASSWORD_INVALID_MESSAGE =
  'Use pelo menos 8 caracteres, com letra, numero, letra maiuscula e simbolo.'

const PASSWORD_REQUIREMENT_DEFINITIONS: PasswordRequirementDefinition[] = [
  {
    id: 'letterAndNumber',
    label: 'Letra e numero',
    validate: (password) => LETTER_REGEX.test(password) && NUMBER_REGEX.test(password),
  },
  {
    id: 'minLength',
    label: 'Minimo de 8 caracteres',
    validate: (password) => password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: 'uppercase',
    label: 'Uma letra maiuscula',
    validate: (password) => UPPERCASE_REGEX.test(password),
  },
  {
    id: 'symbol',
    label: 'Um simbolo',
    validate: (password) => SYMBOL_REGEX.test(password),
  },
]

export const PASSWORD_REQUIREMENTS = PASSWORD_REQUIREMENT_DEFINITIONS.map(({ id, label }) => ({
  id,
  label,
}))

export const getPasswordRequirementStates = (
  password: string,
  shouldValidate = false
): PasswordRequirementState[] => {
  const isNeutralState = !shouldValidate

  return PASSWORD_REQUIREMENT_DEFINITIONS.map(({ id, label, validate }) => {
    const isMet = validate(password)

    return {
      id,
      label,
      isMet,
      status: isNeutralState ? 'pending' : isMet ? 'valid' : 'invalid',
    }
  })
}

export const isPasswordValid = (password: string) =>
  PASSWORD_REQUIREMENT_DEFINITIONS.every(({ validate }) => validate(password))

export const getPasswordValidationError = (password: string) => {
  if (!password) {
    return PASSWORD_REQUIRED_MESSAGE
  }

  if (isPasswordValid(password)) {
    return null
  }

  return PASSWORD_INVALID_MESSAGE
}
