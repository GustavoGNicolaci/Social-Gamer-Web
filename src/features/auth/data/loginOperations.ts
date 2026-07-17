import { translate } from '../../../i18n'
import { supabase } from '../../../supabase-client'
import {
  isValidEmailAddress,
  logUnexpectedAuthError,
  mapFriendlyAuthError,
} from '../../../utils/authErrorMessages'

export async function loginWithPassword(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase()

  if (!normalizedEmail) {
    return { error: translate('auth.emailRequired') }
  }

  if (!isValidEmailAddress(normalizedEmail)) {
    return { error: translate('auth.invalidEmail') }
  }

  if (!password) {
    return { error: translate('auth.loginPasswordRequired') }
  }

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    if (error) {
      const friendlyError = mapFriendlyAuthError(error, 'login')

      if (friendlyError.shouldLog) {
        logUnexpectedAuthError('login', error)
      }

      return { error: friendlyError.message }
    }

    return { error: null }
  } catch (error) {
    const friendlyError = mapFriendlyAuthError(error, 'login')

    if (friendlyError.shouldLog) {
      logUnexpectedAuthError('login', error)
    }

    return { error: friendlyError.message }
  }
}
