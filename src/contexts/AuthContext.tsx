import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { createStatelessSupabaseClient, supabase } from '../supabase-client'
import { getPasswordValidationError } from '../utils/passwordValidation'
import {
  isValidEmailAddress,
  logUnexpectedAuthError,
  mapFriendlyAuthError,
} from '../utils/authErrorMessages'
import { translate } from '../i18n'

const getUsernameTakenMessage = () => translate('auth.usernameTaken')
const getCurrentPasswordRequiredMessage = () => translate('auth.currentPasswordRequired')
const getCurrentPasswordInvalidMessage = () => translate('auth.currentPasswordInvalid')
const getDeleteAccountErrorMessageFallback = () => translate('auth.deleteAccountError')
const USER_PROFILE_SELECT =
  'id, username, nome_completo, avatar_path, avatar_url, bio, data_cadastro, configuracoes_privacidade'

interface FunctionErrorPayload {
  error?: string
}

export interface UserProfile {
  id: string
  username: string
  nome_completo: string | null
  avatar_path: string | null
  avatar_url: string | null
  bio: string | null
  data_cadastro: string
  configuracoes_privacidade: Record<string, unknown> | null
}

export interface RegisterInput {
  username: string
  name?: string | null
  email: string
  password: string
}

export interface RegisterFieldErrors {
  username?: string
  name?: string
  email?: string
  password?: string
  confirmPassword?: string
  submit?: string
}

export interface DeleteOwnAccountInput {
  username: string
  currentPassword: string
}

export type RegisterResult =
  | {
      status: 'validation_error'
      fieldErrors: RegisterFieldErrors
    }
  | {
      status: 'email_confirmation_required'
    }
  | {
      status: 'authenticated'
    }
  | {
      status: 'system_error'
      message: string
    }

export type UserProfileUpdates = Partial<
  Pick<
    UserProfile,
    'nome_completo' | 'username' | 'bio' | 'avatar_path' | 'avatar_url' | 'configuracoes_privacidade'
  >
>

export interface ProfileUpdateError {
  code?: string
  message: string
  details?: string | null
  hint?: string | null
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ error: string | null }>
  logout: () => Promise<void>
  register: (input: RegisterInput) => Promise<RegisterResult>
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>
  requestAuthenticatedPasswordReset: (currentPassword: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
  deleteOwnAccount: (input: DeleteOwnAccountInput) => Promise<{ error: string | null }>
  refreshProfile: () => Promise<UserProfile | null>
  updateOwnProfile: (
    updates: UserProfileUpdates
  ) => Promise<{ data: UserProfile | null; error: ProfileUpdateError | null }>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const normalizeWhitespace = (value: string) => value.trim().replace(/\s+/g, ' ')

interface NormalizedRegisterInput {
  username: string
  name: string | null
  email: string
  password: string
}

const normalizeOptionalName = (value?: string | null) => {
  const normalizedValue = typeof value === 'string' ? normalizeWhitespace(value) : ''
  return normalizedValue || null
}

const getMetadataProfile = (user: User) => {
  const metadata = user.user_metadata as Record<string, unknown> | undefined

  return {
    username: typeof metadata?.username === 'string' ? metadata.username.trim() : '',
    nome_completo:
      typeof metadata?.nome_completo === 'string'
        ? normalizeOptionalName(metadata.nome_completo)
        : null,
  }
}

const getEmailLocalPart = (email?: string) => {
  if (!email) return ''

  const [localPart] = email.split('@')
  return localPart?.trim().toLowerCase() || ''
}

const normalizeRegisterInput = (input: RegisterInput): NormalizedRegisterInput => ({
  username: input.username.trim(),
  name: normalizeOptionalName(input.name),
  email: input.email.trim().toLowerCase(),
  password: input.password,
})

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
    case 'auth_delete_failed':
      return translate('auth.deleteAuthCleanupFailed')
    default:
      return getDeleteAccountErrorMessageFallback()
  }
}

const buildValidationErrorResult = (fieldErrors: RegisterFieldErrors): RegisterResult => ({
  status: 'validation_error',
  fieldErrors,
})

const getRegisterAuthErrorResult = (error: unknown): RegisterResult => {
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
    status: 'system_error',
    message: friendlyError.message,
  }
}

const isEmailConfirmationPending = (user: User | null, session: Session | null) => {
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

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select(USER_PROFILE_SELECT)
        .eq('id', userId)
        .single()

      if (error) {
        return null
      }

      return data as UserProfile
    } catch {
      return null
    }
  }, [])

  const createProfileFromMetadata = useCallback(
    async (nextUser: User) => {
      try {
        const { username, nome_completo } = getMetadataProfile(nextUser)

        if (!username) {
          return null
        }

        const profileData = {
          id: nextUser.id,
          username,
          nome_completo,
          avatar_path: null,
          avatar_url: null,
          bio: null,
          data_cadastro: new Date().toISOString(),
          configuracoes_privacidade: {},
        }

        // The auth listener and the register flow can race to create the same profile.
        const { data, error } = await supabase
          .from('usuarios')
          .insert(profileData)
          .select(USER_PROFILE_SELECT)
          .single()

        if (error) {
          if (error.code === '23505') {
            return await fetchProfile(nextUser.id)
          }

          return null
        }

        return data as UserProfile
      } catch {
        return null
      }
    },
    [fetchProfile]
  )

  const repairLegacyProfile = useCallback(async (nextUser: User, currentProfile: UserProfile) => {
    try {
      const { username: metadataUsername, nome_completo: metadataNomeCompleto } =
        getMetadataProfile(nextUser)

      if (!metadataUsername) {
        return currentProfile
      }

      const normalizedEmail = nextUser.email?.trim().toLowerCase() || ''
      const emailLocalPart = getEmailLocalPart(nextUser.email)
      const normalizedProfileUsername = currentProfile.username?.trim().toLowerCase() || ''
      const normalizedProfileNomeCompleto = currentProfile.nome_completo?.trim().toLowerCase() || ''

      const shouldRepairUsername =
        normalizedProfileUsername === emailLocalPart && currentProfile.username !== metadataUsername

      const shouldRepairNomeCompleto =
        Boolean(metadataNomeCompleto) &&
        normalizedProfileNomeCompleto === normalizedEmail &&
        currentProfile.nome_completo !== metadataNomeCompleto

      if (!shouldRepairUsername && !shouldRepairNomeCompleto) {
        return currentProfile
      }

      const updates: Partial<UserProfile> = {}

      if (shouldRepairUsername) {
        updates.username = metadataUsername
      }

      if (shouldRepairNomeCompleto) {
        updates.nome_completo = metadataNomeCompleto
      }

      const { data, error } = await supabase
        .from('usuarios')
        .update(updates)
        .eq('id', nextUser.id)
        .select(USER_PROFILE_SELECT)
        .single()

      if (error || !data) {
        return currentProfile
      }

      return data as UserProfile
    } catch {
      return currentProfile
    }
  }, [])

  const fetchOrCreateProfile = useCallback(
    async (nextUser: User) => {
      const existingProfile = await fetchProfile(nextUser.id)

      if (existingProfile) {
        return await repairLegacyProfile(nextUser, existingProfile)
      }

      const createdProfile = await createProfileFromMetadata(nextUser)

      if (createdProfile) {
        return createdProfile
      }

      return await fetchProfile(nextUser.id)
    },
    [createProfileFromMetadata, fetchProfile, repairLegacyProfile]
  )

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
    [fetchOrCreateProfile]
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

      const passwordError = getPasswordValidationError(normalizedInput.password)

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
          console.error('Erro ao verificar disponibilidade do nome de usuario:', usernameLookupError)
          return {
            status: 'system_error',
            message: translate('auth.registerGenericError'),
          }
        }

        if (usernameRows && usernameRows.length > 0) {
          return buildValidationErrorResult({
            username: getUsernameTakenMessage(),
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
          console.error('Cadastro concluido sem usuario retornado pelo Supabase.', {
            email: normalizedInput.email,
          })

          return {
            status: 'system_error',
            message: translate('auth.registerGenericError'),
          }
        }

        if (data.session) {
          const nextProfile = await fetchOrCreateProfile(nextUser)

          if (!nextProfile) {
            await supabase.auth.signOut()
            clearAuthState()

            return {
              status: 'system_error',
              message: translate('auth.registerGenericError'),
            }
          }

          setSession(data.session)
          setUser(nextUser)
          setProfile(nextProfile)

          return {
            status: 'authenticated',
          }
        }

        if (isEmailConfirmationPending(nextUser, data.session)) {
          return {
            status: 'email_confirmation_required',
          }
        }

        return {
          status: 'system_error',
          message: translate('auth.registerGenericError'),
        }
      } catch (error) {
        console.error('Erro inesperado ao registrar usuario:', error)

        return {
          status: 'system_error',
          message: translate('auth.registerGenericError'),
        }
      }
    },
    [clearAuthState, fetchOrCreateProfile]
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
        const { data, error } = await supabase
          .from('usuarios')
          .update(updates)
          .eq('id', user.id)
          .select(USER_PROFILE_SELECT)
          .single()

        if (error) {
          const normalizedError = normalizeProfileUpdateError(
            error,
            translate('profile.error.updateFailed')
          )

          console.error('Erro ao atualizar perfil:', {
            userId: user.id,
            updates,
            ...normalizedError,
          })

          return { data: null, error: normalizedError }
        }

        if (!data) {
          const normalizedError = normalizeProfileUpdateError(
            null,
            translate('profile.error.noRecordReturned')
          )

          console.error('Atualizacao do perfil sem retorno de dados:', {
            userId: user.id,
            updates,
          })

          return { data: null, error: normalizedError }
        }

        const nextProfile = data as UserProfile
        setProfile(nextProfile)
        return { data: nextProfile, error: null }
      } catch (error) {
        const normalizedError = normalizeProfileUpdateError(
          error,
          translate('profile.error.unexpectedUpdate')
        )

        console.error('Erro inesperado ao atualizar perfil:', {
          userId: user.id,
          updates,
          error,
        })

        return { data: null, error: normalizedError }
      }
    },
    [user]
  )

  useEffect(() => {
    let isMounted = true

    const init = async () => {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession()

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

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return
      }

      void syncAuthState(nextSession)
    })

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
    }
  }, [syncAuthState])

  const login = useCallback(async (email: string, password: string) => {
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
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
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
  }, [])

  const requestAuthenticatedPasswordReset = useCallback(
    async (currentPassword: string) => {
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

        const resetResult = await requestPasswordReset(user.email)

        if (resetResult.error) {
          return resetResult
        }

        return {
          error: null,
        }
      } catch (error) {
        const friendlyError = mapFriendlyAuthError(error, 'login')

        if (friendlyError.shouldLog) {
          logUnexpectedAuthError('login', error)
        }

        return {
          error: friendlyError.message,
        }
      }
    },
    [requestPasswordReset, user]
  )

  const updatePassword = useCallback(async (password: string) => {
    const passwordError = getPasswordValidationError(password)

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
  }, [])

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

        console.error('Erro real ao excluir a propria conta:', {
          error,
          data,
          errorCode,
          payload,
        })

        return {
          error: getDeleteAccountErrorMessage(errorCode),
        }
      }

      try {
        await supabase.auth.signOut({ scope: 'local' })
      } catch (signOutError) {
        console.error('Erro ao encerrar sessao local apos excluir conta:', signOutError)
      }

      clearAuthState()

      return {
        error: null,
      }
    } catch (error) {
      console.error('Erro inesperado ao excluir a propria conta:', error)
      return {
        error: getDeleteAccountErrorMessageFallback(),
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
