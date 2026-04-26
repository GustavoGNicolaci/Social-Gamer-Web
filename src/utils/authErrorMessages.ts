import { translate } from '../i18n'

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
  translate('auth.genericActionError')
export const REQUIRED_EMAIL_MESSAGE = translate('auth.emailRequired')
export const INVALID_EMAIL_MESSAGE = translate('auth.invalidEmail')
export const REQUIRED_LOGIN_PASSWORD_MESSAGE = translate('auth.loginPasswordRequired')
export const EMAIL_ALREADY_REGISTERED_MESSAGE = translate('auth.emailAlreadyRegistered')
export const INVALID_LOGIN_CREDENTIALS_MESSAGE = translate('auth.invalidCredentials')
export const EMAIL_NOT_CONFIRMED_MESSAGE = translate('auth.emailNotConfirmed')
export const CONNECTION_ERROR_MESSAGE = translate('auth.connectionError')
export const TOO_MANY_REQUESTS_MESSAGE = translate('auth.tooManyRequests')
export const REGISTER_GENERIC_ERROR_MESSAGE = translate('auth.registerGenericError')
export const PASSWORD_RESET_REQUEST_ERROR_MESSAGE = translate('auth.passwordResetRequestError')
export const PASSWORD_UPDATE_ERROR_MESSAGE = translate('auth.passwordUpdateError')
export const INVALID_RESET_LINK_MESSAGE = translate('auth.invalidResetLink')

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
      message: translate('auth.connectionError'),
      shouldLog: false,
    }
  }

  if (isTooManyRequestsError(message, status)) {
    return {
      reason: 'too_many_requests',
      message: translate('auth.tooManyRequests'),
      shouldLog: false,
    }
  }

  if (isInvalidEmailError(message, code)) {
    return {
      reason: 'invalid_email',
      message: translate('auth.invalidEmail'),
      shouldLog: false,
    }
  }

  if (isWeakPasswordError(message)) {
    return {
      reason: 'weak_password',
      message: translate('auth.passwordInvalid'),
      shouldLog: false,
    }
  }

  if (flow === 'register' && isEmailAlreadyRegisteredError(message)) {
    return {
      reason: 'email_already_registered',
      message: translate('auth.emailAlreadyRegistered'),
      shouldLog: false,
    }
  }

  if (flow === 'login' && isEmailNotConfirmedError(message)) {
    return {
      reason: 'email_not_confirmed',
      message: translate('auth.emailNotConfirmed'),
      shouldLog: false,
    }
  }

  if (flow === 'login' && isInvalidCredentialsError(message, code)) {
    return {
      reason: 'invalid_credentials',
      message: translate('auth.invalidCredentials'),
      shouldLog: false,
    }
  }

  if (flow === 'password_update' && isInvalidResetLinkError(message)) {
    return {
      reason: 'invalid_reset_link',
      message: translate('auth.invalidResetLink'),
      shouldLog: false,
    }
  }

  if (flow === 'register') {
    return {
      reason: 'unexpected',
      message: translate('auth.registerGenericError'),
      shouldLog: true,
    }
  }

  if (flow === 'password_reset_request') {
    return {
      reason: 'unexpected',
      message: translate('auth.passwordResetRequestError'),
      shouldLog: true,
    }
  }

  if (flow === 'password_update') {
    return {
      reason: 'unexpected',
      message: translate('auth.passwordUpdateError'),
      shouldLog: true,
    }
  }

  return {
    reason: 'unexpected',
    message: translate('auth.genericActionError'),
    shouldLog: true,
  }
}

export const logUnexpectedAuthError = (flow: AuthErrorFlow, error: unknown) => {
  console.error(`Auth error [${flow}]`, error)
}
