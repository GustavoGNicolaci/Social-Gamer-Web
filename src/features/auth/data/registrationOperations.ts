import type { Session, User } from '@supabase/supabase-js'
import { translate } from '../../../i18n'
import { supabase } from '../../../supabase-client'
import {
  isValidEmailAddress,
  logUnexpectedAuthError,
  mapFriendlyAuthError,
} from '../../../utils/authErrorMessages'
import { logClientError } from '../../../utils/clientLogging'
import { getPasswordValidationError } from '../../../utils/passwordValidation'
import type {
  RegisterFieldErrors,
  RegisterInput,
  RegisterResult,
  UserProfile,
} from '../domain/types'
import { fetchOrCreateProfile } from './profileRepository'

interface NormalizedRegisterInput {
  username: string
  name: string | null
  email: string
  password: string
}

type AuthenticatedRegisterResult = Extract<RegisterResult, { status: 'authenticated' }>
type NonAuthenticatedRegisterResult = Exclude<RegisterResult, { status: 'authenticated' }>

export type RegistrationOperationResult =
  | {
      result: AuthenticatedRegisterResult
      session: Session
      user: User
      profile: UserProfile
      shouldClearAuthState?: false
    }
  | {
      result: NonAuthenticatedRegisterResult
      shouldClearAuthState?: boolean
    }

const normalizeWhitespace = (value: string) => value.trim().replace(/\s+/g, ' ')

const normalizeOptionalName = (value?: string | null) => {
  const normalizedValue = typeof value === 'string' ? normalizeWhitespace(value) : ''
  return normalizedValue || null
}

const normalizeRegisterInput = (input: RegisterInput): NormalizedRegisterInput => ({
  username: input.username.trim(),
  name: normalizeOptionalName(input.name),
  email: input.email.trim().toLowerCase(),
  password: input.password,
})

const buildValidationErrorResult = (fieldErrors: RegisterFieldErrors): RegistrationOperationResult => ({
  result: {
    status: 'validation_error',
    fieldErrors,
  },
})

function getRegisterAuthErrorResult(error: unknown): RegistrationOperationResult {
  const friendlyError = mapFriendlyAuthError(error, 'register')

  if (friendlyError.shouldLog) {
    logUnexpectedAuthError('register', error)
  }

  if (
    friendlyError.reason === 'invalid_email' ||
    friendlyError.reason === 'email_already_registered'
  ) {
    return buildValidationErrorResult({
      email: friendlyError.message,
    })
  }

  if (friendlyError.reason === 'weak_password') {
    return buildValidationErrorResult({
      password: friendlyError.message,
    })
  }

  return {
    result: {
      status: 'system_error',
      message: friendlyError.message,
    },
  }
}

function isEmailConfirmationPending(user: User | null, session: Session | null) {
  if (!user || session) {
    return false
  }

  if (!user.confirmation_sent_at) {
    return false
  }

  if (Array.isArray(user.identities) && user.identities.length === 0) {
    return false
  }

  return true
}

export async function registerAccount(input: RegisterInput): Promise<RegistrationOperationResult> {
  const normalizedInput = normalizeRegisterInput(input)

  if (!normalizedInput.username) {
    return buildValidationErrorResult({
      username: translate('auth.usernameRequired'),
    })
  }

  if (!normalizedInput.email) {
    return buildValidationErrorResult({
      email: translate('auth.emailRequired'),
    })
  }

  if (!isValidEmailAddress(normalizedInput.email)) {
    return buildValidationErrorResult({
      email: translate('auth.invalidEmail'),
    })
  }

  const passwordError = getPasswordValidationError(normalizedInput.password, translate)

  if (passwordError) {
    return buildValidationErrorResult({
      password: passwordError,
    })
  }

  try {
    const { data: usernameRows, error: usernameLookupError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('username', normalizedInput.username)
      .limit(1)

    if (usernameLookupError) {
      logClientError('auth.register.usernameLookup', usernameLookupError)
      return {
        result: {
          status: 'system_error',
          message: translate('auth.registerGenericError'),
        },
      }
    }

    if (usernameRows && usernameRows.length > 0) {
      return buildValidationErrorResult({
        username: translate('auth.usernameTaken'),
      })
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedInput.email,
      password: normalizedInput.password,
      options: {
        data: {
          username: normalizedInput.username,
          ...(normalizedInput.name ? { nome_completo: normalizedInput.name } : {}),
        },
      },
    })

    if (error) {
      return getRegisterAuthErrorResult(error)
    }

    const nextUser = data.user

    if (!nextUser) {
      logClientError('auth.register.missingUser', null, {
        hasEmail: Boolean(normalizedInput.email),
      })

      return {
        result: {
          status: 'system_error',
          message: translate('auth.registerGenericError'),
        },
      }
    }

    if (data.session) {
      const nextProfile = await fetchOrCreateProfile(nextUser)

      if (!nextProfile) {
        await supabase.auth.signOut()

        return {
          result: {
            status: 'system_error',
            message: translate('auth.registerGenericError'),
          },
          shouldClearAuthState: true,
        }
      }

      return {
        result: { status: 'authenticated' },
        session: data.session,
        user: nextUser,
        profile: nextProfile,
      }
    }

    if (isEmailConfirmationPending(nextUser, data.session)) {
      return {
        result: { status: 'email_confirmation_required' },
      }
    }

    return {
      result: {
        status: 'system_error',
        message: translate('auth.registerGenericError'),
      },
    }
  } catch (error) {
    logClientError('auth.register.unexpected', error)

    return {
      result: {
        status: 'system_error',
        message: translate('auth.registerGenericError'),
      },
    }
  }
}
