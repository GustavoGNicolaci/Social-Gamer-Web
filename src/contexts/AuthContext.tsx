import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { deleteAllUserFiles } from '../services/storageService'
import { createStatelessSupabaseClient, supabase } from '../supabase-client'
import { getPasswordValidationError } from '../utils/passwordValidation'
import {
  INVALID_EMAIL_MESSAGE,
  REGISTER_GENERIC_ERROR_MESSAGE,
  REQUIRED_EMAIL_MESSAGE,
  REQUIRED_LOGIN_PASSWORD_MESSAGE,
  isValidEmailAddress,
  logUnexpectedAuthError,
  mapFriendlyAuthError,
} from '../utils/authErrorMessages'

const USERNAME_TAKEN_MESSAGE = 'Esse nome de usuario ja esta em uso.'
const CURRENT_PASSWORD_REQUIRED_MESSAGE = 'Informe sua senha atual.'
const CURRENT_PASSWORD_INVALID_MESSAGE = 'A senha atual informada nao esta correta.'
const DELETE_ACCOUNT_ERROR_MESSAGE =
  'Nao foi possivel excluir sua conta agora. Tente novamente em alguns instantes.'
const DELETE_ACCOUNT_STORAGE_ERROR_MESSAGE =
  'Nao foi possivel remover seus arquivos agora. Tente novamente em alguns instantes.'
const USER_PROFILE_SELECT =
  'id, username, nome_completo, avatar_path, avatar_url, bio, data_cadastro, configuracoes_privacidade'

export interface UserProfile {
  id: string
  username: string
  nome_completo: string
  avatar_path: string | null
  avatar_url: string | null
  bio: string | null
  data_cadastro: string
  configuracoes_privacidade: Record<string, unknown> | null
}

export interface RegisterInput {
  username: string
  name: string
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
  deleteOwnAccount: () => Promise<{ error: string | null }>
  refreshProfile: () => Promise<UserProfile | null>
  updateOwnProfile: (
    updates: UserProfileUpdates
  ) => Promise<{ data: UserProfile | null; error: ProfileUpdateError | null }>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const getMetadataProfile = (user: User) => {
  const metadata = user.user_metadata as Record<string, unknown> | undefined

  return {
    username: typeof metadata?.username === 'string' ? metadata.username.trim() : '',
    nome_completo:
      typeof metadata?.nome_completo === 'string' ? metadata.nome_completo.trim() : '',
  }
}

const getEmailLocalPart = (email?: string) => {
  if (!email) return ''

  const [localPart] = email.split('@')
  return localPart?.trim().toLowerCase() || ''
}

const normalizeWhitespace = (value: string) => value.trim().replace(/\s+/g, ' ')

const normalizeRegisterInput = (input: RegisterInput): RegisterInput => ({
  username: input.username.trim(),
  name: normalizeWhitespace(input.name),
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

        if (!username || !nome_completo) {
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

      if (!metadataUsername || !metadataNomeCompleto) {
        return currentProfile
      }

      const normalizedEmail = nextUser.email?.trim().toLowerCase() || ''
      const emailLocalPart = getEmailLocalPart(nextUser.email)
      const normalizedProfileUsername = currentProfile.username?.trim().toLowerCase() || ''
      const normalizedProfileNomeCompleto = currentProfile.nome_completo?.trim().toLowerCase() || ''

      const shouldRepairUsername =
        normalizedProfileUsername === emailLocalPart && currentProfile.username !== metadataUsername

      const shouldRepairNomeCompleto =
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
          username: 'Nome de usuario e obrigatorio.',
        })
      }

      if (!normalizedInput.name) {
        return buildValidationErrorResult({
          name: 'Nome completo e obrigatorio.',
        })
      }

      if (!normalizedInput.email) {
        return buildValidationErrorResult({
          email: REQUIRED_EMAIL_MESSAGE,
        })
      }

      if (!isValidEmailAddress(normalizedInput.email)) {
        return buildValidationErrorResult({
          email: INVALID_EMAIL_MESSAGE,
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
            message: REGISTER_GENERIC_ERROR_MESSAGE,
          }
        }

        if (usernameRows && usernameRows.length > 0) {
          return buildValidationErrorResult({
            username: USERNAME_TAKEN_MESSAGE,
          })
        }

        const { data, error } = await supabase.auth.signUp({
          email: normalizedInput.email,
          password: normalizedInput.password,
          options: {
            data: {
              username: normalizedInput.username,
              nome_completo: normalizedInput.name,
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
            message: REGISTER_GENERIC_ERROR_MESSAGE,
          }
        }

        if (data.session) {
          const nextProfile = await fetchOrCreateProfile(nextUser)

          if (!nextProfile) {
            await supabase.auth.signOut()
            clearAuthState()

            return {
              status: 'system_error',
              message: REGISTER_GENERIC_ERROR_MESSAGE,
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
          message: REGISTER_GENERIC_ERROR_MESSAGE,
        }
      } catch (error) {
        console.error('Erro inesperado ao registrar usuario:', error)

        return {
          status: 'system_error',
          message: REGISTER_GENERIC_ERROR_MESSAGE,
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
          error: { message: 'Usuario nao autenticado para atualizar o perfil.' },
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
            'Nao foi possivel atualizar o perfil.'
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
            'Nenhum registro foi retornado apos atualizar o perfil.'
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
          'Erro inesperado ao atualizar o perfil.'
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
      return { error: REQUIRED_EMAIL_MESSAGE }
    }

    if (!isValidEmailAddress(normalizedEmail)) {
      return { error: INVALID_EMAIL_MESSAGE }
    }

    if (!password) {
      return { error: REQUIRED_LOGIN_PASSWORD_MESSAGE }
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
        error: REQUIRED_EMAIL_MESSAGE,
      }
    }

    if (!isValidEmailAddress(normalizedEmail)) {
      return {
        error: INVALID_EMAIL_MESSAGE,
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
          error: 'Voce precisa estar logado para alterar a senha.',
        }
      }

      if (!currentPassword) {
        return {
          error: CURRENT_PASSWORD_REQUIRED_MESSAGE,
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
                ? CURRENT_PASSWORD_INVALID_MESSAGE
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

  const deleteOwnAccount = useCallback(async () => {
    if (!user) {
      return {
        error: 'Voce precisa estar logado para excluir sua conta.',
      }
    }

    const storageCleanupResult = await deleteAllUserFiles(user.id)

    if (!storageCleanupResult.ok) {
      return {
        error: DELETE_ACCOUNT_STORAGE_ERROR_MESSAGE,
      }
    }

    try {
      const { error } = await supabase.rpc('delete_own_account')

      if (error) {
        console.error('Erro ao excluir a propria conta:', error)
        return {
          error: DELETE_ACCOUNT_ERROR_MESSAGE,
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
        error: DELETE_ACCOUNT_ERROR_MESSAGE,
      }
    }
  }, [clearAuthState, user])

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
