import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { createStatelessSupabaseClient, supabase } from '../supabase-client'
import {
  fetchOrCreateProfile,
  fetchOwnProfile,
  updateOwnProfileRecord,
} from '../features/auth/data/profileRepository'
import { loginWithPassword } from '../features/auth/data/loginOperations'
import {
  requestAuthenticatedPasswordReset as requestAuthenticatedPasswordResetOperation,
  requestPasswordReset as requestPasswordResetOperation,
  updatePassword as updatePasswordOperation,
} from '../features/auth/data/passwordOperations'
import { registerAccount } from '../features/auth/data/registrationOperations'
import {
  getCurrentSession,
  subscribeToAuthSession,
} from '../features/auth/data/sessionRepository'
import type {
  AuthContextValue,
  DeleteOwnAccountInput,
  ProfileUpdateError,
  RegisterInput,
  RegisterResult,
  UserProfile,
  UserProfileUpdates,
} from '../features/auth/domain/types'
import {
  logUnexpectedAuthError,
  mapFriendlyAuthError,
} from '../utils/authErrorMessages'
import { logClientError } from '../utils/clientLogging'
import { translate } from '../i18n'

const getCurrentPasswordRequiredMessage = () => translate('auth.currentPasswordRequired')
const getCurrentPasswordInvalidMessage = () => translate('auth.currentPasswordInvalid')
const getDeleteAccountErrorMessageFallback = () => translate('auth.deleteAccountError')
interface FunctionErrorPayload {
  error?: string
}

export type {
  DeleteOwnAccountInput,
  ProfileUpdateError,
  RegisterFieldErrors,
  RegisterInput,
  RegisterResult,
  UserProfile,
  UserProfileUpdates,
} from '../features/auth/domain/types'

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const normalizeProfileUpdateError = (
  error: unknown,
  fallbackMessage: string
): ProfileUpdateError => {
  if (error && typeof error === 'object') {
    const message =
      'message' in error && typeof error.message === 'string' ? error.message : fallbackMessage
    const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined
    const details = 'details' in error && typeof error.details === 'string' ? error.details : null
    const hint = 'hint' in error && typeof error.hint === 'string' ? error.hint : null

    return { code, message, details, hint }
  }

  return { message: fallbackMessage }
}

async function getFunctionErrorPayload(error: unknown): Promise<FunctionErrorPayload | null> {
  if (!error || typeof error !== 'object' || !('context' in error)) {
    return null
  }

  const context = error.context

  if (!context || typeof context !== 'object' || !('clone' in context)) {
    return null
  }

  const clone = context.clone

  if (typeof clone !== 'function') {
    return null
  }

  try {
    const response = clone.call(context) as Response
    const payload = await response.json()

    return payload && typeof payload === 'object' ? payload as FunctionErrorPayload : null
  } catch {
    return null
  }
}

function getDeleteAccountErrorMessage(errorCode: string | null | undefined) {
  switch (errorCode) {
    case 'invalid_password':
      return getCurrentPasswordInvalidMessage()
    case 'username_mismatch':
      return translate('auth.deleteUsernameMismatch')
    case 'not_authenticated':
      return translate('auth.deleteSessionExpired')
    case 'missing_confirmation':
      return translate('auth.deleteMissingConfirmation')
    case 'storage_cleanup_failed':
      return translate('auth.deleteStorageCleanupFailed')
    case 'data_cleanup_failed':
      return translate('auth.deleteDataCleanupFailed')
    case 'community_leadership_transfer_required':
      return translate('auth.deleteCommunityLeadershipTransferRequired')
    case 'auth_delete_failed':
      return translate('auth.deleteAuthCleanupFailed')
    default:
      return getDeleteAccountErrorMessageFallback()
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const clearAuthState = useCallback(() => {
    setSession(null)
    setUser(null)
    setProfile(null)
  }, [])

  const loadProfile = useCallback(
    async (targetUser: User | null) => {
      if (!targetUser) {
        setProfile(null)
        return null
      }

      const nextProfile = await fetchOrCreateProfile(targetUser)
      setProfile(nextProfile)
      return nextProfile
    },
    []
  )

  const syncAuthState = useCallback(
    async (nextSession: Session | null) => {
      setLoading(true)
      setSession(nextSession)

      const nextUser = nextSession?.user ?? null
      setUser(nextUser)

      try {
        await loadProfile(nextUser)
      } finally {
        setLoading(false)
      }
    },
    [loadProfile]
  )

  const refreshProfile = useCallback(async () => {
    return await loadProfile(user)
  }, [loadProfile, user])

  const register = useCallback(
    async (input: RegisterInput): Promise<RegisterResult> => {
      const operation = await registerAccount(input)

      if ('session' in operation) {
        setSession(operation.session)
        setUser(operation.user)
        setProfile(operation.profile)
      } else if (operation.shouldClearAuthState) {
        clearAuthState()
      }

      return operation.result
    },
    [clearAuthState]
  )

  const updateOwnProfile = useCallback(
    async (updates: UserProfileUpdates) => {
      if (!user) {
        return {
          data: null,
          error: { message: translate('profile.error.notAuthenticated') },
        }
      }

      try {
        const { error } = await updateOwnProfileRecord(user.id, updates)

        if (error) {
          const normalizedError = normalizeProfileUpdateError(
            error,
            translate('profile.error.updateFailed')
          )

          logClientError('auth.updateOwnProfile', normalizedError, { hasUser: true })

          return { data: null, error: normalizedError }
        }

        const nextProfile = await fetchOwnProfile(user.id)

        if (!nextProfile) {
          const normalizedError = normalizeProfileUpdateError(
            null,
            translate('profile.error.noRecordReturned')
          )

          logClientError('auth.updateOwnProfile.noRecordReturned', null, { hasUser: true })

          return { data: null, error: normalizedError }
        }

        setProfile(nextProfile)
        return { data: nextProfile, error: null }
      } catch (error) {
        const normalizedError = normalizeProfileUpdateError(
          error,
          translate('profile.error.unexpectedUpdate')
        )

        logClientError('auth.updateOwnProfile.unexpected', error, { hasUser: true })

        return { data: null, error: normalizedError }
      }
    },
    [user]
  )

  useEffect(() => {
    let isMounted = true

    const init = async () => {
      try {
        const currentSession = await getCurrentSession()

        if (!isMounted) {
          return
        }

        await syncAuthState(currentSession)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void init()

    const unsubscribe = subscribeToAuthSession(nextSession => {
      if (!isMounted) {
        return
      }

      void syncAuthState(nextSession)
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [syncAuthState])

  const login = useCallback(
    async (email: string, password: string) => await loginWithPassword(email, password),
    []
  )

  const requestPasswordReset = useCallback(
    async (email: string) => await requestPasswordResetOperation(email),
    []
  )

  const requestAuthenticatedPasswordReset = useCallback(
    async (currentPassword: string) =>
      await requestAuthenticatedPasswordResetOperation(user, currentPassword),
    [user]
  )

  const updatePassword = useCallback(
    async (password: string) => await updatePasswordOperation(password),
    []
  )

  const deleteOwnAccount = useCallback(async ({ username, currentPassword }: DeleteOwnAccountInput) => {
    if (!user?.email || !profile) {
      return {
        error: translate('auth.deleteLoginRequired'),
      }
    }

    if (username !== profile.username) {
      return {
        error: translate('auth.deleteUsernameMismatch'),
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

      const { data, error } = await supabase.functions.invoke('delete-own-account', {
        body: {
          username,
          currentPassword,
        },
      })

      if (error || (data && typeof data === 'object' && 'error' in data)) {
        const payload = error
          ? await getFunctionErrorPayload(error)
          : data as FunctionErrorPayload
        const errorCode = payload?.error

        logClientError('auth.deleteOwnAccount.function', error, {
          errorCode: errorCode || 'unknown',
        })

        return {
          error: getDeleteAccountErrorMessage(errorCode),
        }
      }

      try {
        await supabase.auth.signOut({ scope: 'local' })
      } catch (signOutError) {
        logClientError('auth.deleteOwnAccount.localSignOut', signOutError)
      }

      clearAuthState()

      return {
        error: null,
      }
    } catch (error) {
      logClientError('auth.deleteOwnAccount.unexpected', error)
      return {
        error: getDeleteAccountErrorMessageFallback(),
      }
    } finally {
      try {
        const { error: cleanupError } = await validationClient.auth.signOut()

        if (cleanupError) {
          logClientError('auth.deleteOwnAccount.validationSignOut', cleanupError)
        }
      } catch (cleanupError) {
        logClientError('auth.deleteOwnAccount.validationSignOut', cleanupError)
      }
    }
  }, [clearAuthState, profile, user])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    clearAuthState()
  }, [clearAuthState])

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        login,
        logout,
        register,
        requestPasswordReset,
        requestAuthenticatedPasswordReset,
        updatePassword,
        deleteOwnAccount,
        refreshProfile,
        updateOwnProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
