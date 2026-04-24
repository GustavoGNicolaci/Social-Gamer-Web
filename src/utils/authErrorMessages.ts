import { PASSWORD_INVALID_MESSAGE } from './passwordValidation'

export type AuthErrorFlow = 'login' | 'register' | 'password_reset_request' | 'password_update'

export type FriendlyAuthErrorReason =
  | 'invalid_email'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'email_already_registered'
  | 'weak_password'
  | 'connection'
  | 'too_many_requests'
  | 'invalid_reset_link'
  | 'unexpected'

export interface FriendlyAuthError {
  reason: FriendlyAuthErrorReason
  message: string
  shouldLog: boolean
}

export const GENERIC_AUTH_ACTION_MESSAGE =
  'Nao foi possivel concluir a acao agora. Tente novamente em alguns instantes.'
export const REQUIRED_EMAIL_MESSAGE = 'Email e obrigatorio.'
export const INVALID_EMAIL_MESSAGE = 'Digite um email valido.'
export const REQUIRED_LOGIN_PASSWORD_MESSAGE = 'Informe sua senha.'
export const EMAIL_ALREADY_REGISTERED_MESSAGE = 'Este email ja esta cadastrado.'
export const INVALID_LOGIN_CREDENTIALS_MESSAGE = 'Email ou senha incorretos.'
export const EMAIL_NOT_CONFIRMED_MESSAGE = 'Confirme seu email antes de entrar.'
export const CONNECTION_ERROR_MESSAGE =
  'Nao foi possivel conectar agora. Verifique sua internet e tente novamente.'
export const TOO_MANY_REQUESTS_MESSAGE =
  'Muitas tentativas agora. Aguarde um pouco e tente novamente.'
export const REGISTER_GENERIC_ERROR_MESSAGE =
  'Nao foi possivel concluir o cadastro agora. Tente novamente em alguns instantes.'
export const PASSWORD_RESET_REQUEST_ERROR_MESSAGE =
  'Nao foi possivel enviar o link de redefinicao agora. Tente novamente.'
export const PASSWORD_UPDATE_ERROR_MESSAGE =
  'Nao foi possivel atualizar sua senha agora. Tente novamente.'
export const INVALID_RESET_LINK_MESSAGE =
  'Seu link para redefinir a senha e invalido ou expirou. Solicite um novo link.'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const includesAny = (message: string, patterns: string[]) =>
  patterns.some((pattern) => message.includes(pattern))

const normalizeAuthError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return {
      message: '',
      code: '',
      status: undefined as number | undefined,
    }
  }

  const message =
    'message' in error && typeof error.message === 'string' ? error.message.toLowerCase() : ''
  const code = 'code' in error && typeof error.code === 'string' ? error.code.toLowerCase() : ''
  const status = 'status' in error && typeof error.status === 'number' ? error.status : undefined

  return { message, code, status }
}

const isConnectionError = (message: string, status?: number) =>
  status === 0 ||
  includesAny(message, [
    'failed to fetch',
    'fetch failed',
    'network',
    'network request failed',
    'load failed',
    'offline',
    'timed out',
  ])

const isTooManyRequestsError = (message: string, status?: number) =>
  status === 429 ||
  includesAny(message, ['too many requests', 'rate limit', 'over_request_rate_limit'])

const isInvalidEmailError = (message: string, code: string) =>
  code === 'email_address_invalid' || (message.includes('invalid') && message.includes('email'))

const isEmailAlreadyRegisteredError = (message: string) =>
  includesAny(message, ['already registered', 'already exists', 'already been registered'])

const isWeakPasswordError = (message: string) =>
  message.includes('password') &&
  includesAny(message, ['weak', 'least', 'short', '6', 'strength'])

const isInvalidCredentialsError = (message: string, code: string) =>
  code === 'invalid_credentials' ||
  includesAny(message, [
    'invalid login credentials',
    'invalid credentials',
    'user not found',
    'invalid password',
    'email or password',
  ])

const isEmailNotConfirmedError = (message: string) =>
  includesAny(message, ['email not confirmed', 'confirm your email', 'email_not_confirmed'])

const isInvalidResetLinkError = (message: string) =>
  includesAny(message, [
    'auth session missing',
    'session missing',
    'expired',
    'invalid jwt',
    'invalid token',
    'jwt',
    'token has expired',
    'refresh token',
  ])

export const isValidEmailAddress = (email: string) => EMAIL_REGEX.test(email)

export const mapFriendlyAuthError = (
  error: unknown,
  flow: AuthErrorFlow
): FriendlyAuthError => {
  const { message, code, status } = normalizeAuthError(error)

  if (isConnectionError(message, status)) {
    return {
      reason: 'connection',
      message: CONNECTION_ERROR_MESSAGE,
      shouldLog: false,
    }
  }

  if (isTooManyRequestsError(message, status)) {
    return {
      reason: 'too_many_requests',
      message: TOO_MANY_REQUESTS_MESSAGE,
      shouldLog: false,
    }
  }

  if (isInvalidEmailError(message, code)) {
    return {
      reason: 'invalid_email',
      message: INVALID_EMAIL_MESSAGE,
      shouldLog: false,
    }
  }

  if (isWeakPasswordError(message)) {
    return {
      reason: 'weak_password',
      message: PASSWORD_INVALID_MESSAGE,
      shouldLog: false,
    }
  }

  if (flow === 'register' && isEmailAlreadyRegisteredError(message)) {
    return {
      reason: 'email_already_registered',
      message: EMAIL_ALREADY_REGISTERED_MESSAGE,
      shouldLog: false,
    }
  }

  if (flow === 'login' && isEmailNotConfirmedError(message)) {
    return {
      reason: 'email_not_confirmed',
      message: EMAIL_NOT_CONFIRMED_MESSAGE,
      shouldLog: false,
    }
  }

  if (flow === 'login' && isInvalidCredentialsError(message, code)) {
    return {
      reason: 'invalid_credentials',
      message: INVALID_LOGIN_CREDENTIALS_MESSAGE,
      shouldLog: false,
    }
  }

  if (flow === 'password_update' && isInvalidResetLinkError(message)) {
    return {
      reason: 'invalid_reset_link',
      message: INVALID_RESET_LINK_MESSAGE,
      shouldLog: false,
    }
  }

  if (flow === 'register') {
    return {
      reason: 'unexpected',
      message: REGISTER_GENERIC_ERROR_MESSAGE,
      shouldLog: true,
    }
  }

  if (flow === 'password_reset_request') {
    return {
      reason: 'unexpected',
      message: PASSWORD_RESET_REQUEST_ERROR_MESSAGE,
      shouldLog: true,
    }
  }

  if (flow === 'password_update') {
    return {
      reason: 'unexpected',
      message: PASSWORD_UPDATE_ERROR_MESSAGE,
      shouldLog: true,
    }
  }

  return {
    reason: 'unexpected',
    message: GENERIC_AUTH_ACTION_MESSAGE,
    shouldLog: true,
  }
}

export const logUnexpectedAuthError = (flow: AuthErrorFlow, error: unknown) => {
  console.error(`Auth error [${flow}]`, error)
}
