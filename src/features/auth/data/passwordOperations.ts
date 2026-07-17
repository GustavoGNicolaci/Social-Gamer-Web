import type { User } from '@supabase/supabase-js'
import { translate } from '../../../i18n'
import { createStatelessSupabaseClient, supabase } from '../../../supabase-client'
import {
  isValidEmailAddress,
  logUnexpectedAuthError,
  mapFriendlyAuthError,
} from '../../../utils/authErrorMessages'
import { logClientError } from '../../../utils/clientLogging'
import { getPasswordValidationError } from '../../../utils/passwordValidation'

const getCurrentPasswordRequiredMessage = () => translate('auth.currentPasswordRequired')
const getCurrentPasswordInvalidMessage = () => translate('auth.currentPasswordInvalid')

export async function requestPasswordReset(email: string) {
  const normalizedEmail = email.trim().toLowerCase()

  if (!normalizedEmail) {
    return {
      error: translate('auth.emailRequired'),
    }
  }

  if (!isValidEmailAddress(normalizedEmail)) {
    return {
      error: translate('auth.invalidEmail'),
    }
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/resetar-senha`,
    })

    if (error) {
      const friendlyError = mapFriendlyAuthError(error, 'password_reset_request')

      if (friendlyError.shouldLog) {
        logUnexpectedAuthError('password_reset_request', error)
      }

      return {
        error: friendlyError.message,
      }
    }

    return { error: null }
  } catch (error) {
    const friendlyError = mapFriendlyAuthError(error, 'password_reset_request')

    if (friendlyError.shouldLog) {
      logUnexpectedAuthError('password_reset_request', error)
    }

    return {
      error: friendlyError.message,
    }
  }
}

export async function requestAuthenticatedPasswordReset(
  user: User | null,
  currentPassword: string
) {
  if (!user?.email) {
    return {
      error: translate('auth.passwordChangeLoginRequired'),
    }
  }

  if (!currentPassword) {
    return {
      error: getCurrentPasswordRequiredMessage(),
    }
  }

  const validationClient = createStatelessSupabaseClient()

  try {
    const { error: validationError } = await validationClient.auth.signInWithPassword({
      email: user.email.trim().toLowerCase(),
      password: currentPassword,
    })

    if (validationError) {
      const friendlyError = mapFriendlyAuthError(validationError, 'login')

      if (friendlyError.shouldLog) {
        logUnexpectedAuthError('login', validationError)
      }

      return {
        error:
          friendlyError.reason === 'invalid_credentials'
            ? getCurrentPasswordInvalidMessage()
            : friendlyError.message,
      }
    }

    return await requestPasswordReset(user.email)
  } catch (error) {
    const friendlyError = mapFriendlyAuthError(error, 'login')

    if (friendlyError.shouldLog) {
      logUnexpectedAuthError('login', error)
    }

    return {
      error: friendlyError.message,
    }
  } finally {
    try {
      const { error: cleanupError } = await validationClient.auth.signOut()

      if (cleanupError) {
        logClientError(
          'auth.requestAuthenticatedPasswordReset.validationSignOut',
          cleanupError
        )
      }
    } catch (cleanupError) {
      logClientError('auth.requestAuthenticatedPasswordReset.validationSignOut', cleanupError)
    }
  }
}

export async function updatePassword(password: string) {
  const passwordError = getPasswordValidationError(password, translate)

  if (passwordError) {
    return {
      error: passwordError,
    }
  }

  try {
    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      const friendlyError = mapFriendlyAuthError(error, 'password_update')

      return {
        error: friendlyError.message,
      }
    }

    return { error: null }
  } catch (error) {
    const friendlyError = mapFriendlyAuthError(error, 'password_update')

    if (friendlyError.shouldLog) {
      logUnexpectedAuthError('password_update', error)
    }

    return {
      error: friendlyError.message,
    }
  }
}
