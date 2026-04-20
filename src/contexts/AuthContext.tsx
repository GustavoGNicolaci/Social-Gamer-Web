import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AuthError, Session, User } from '@supabase/supabase-js'
import { supabase } from '../supabase-client'

export interface UserProfile {
  id: string
  username: string
  nome_completo: string
  avatar_url: string | null
  bio: string | null
  data_cadastro: string
  configuracoes_privacidade: Record<string, unknown> | null
}

export type UserProfileUpdates = Partial<
  Pick<UserProfile, 'nome_completo' | 'username' | 'bio' | 'avatar_url' | 'configuracoes_privacidade'>
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
  login: (email: string, password: string) => Promise<{ error: AuthError | null }>
  logout: () => Promise<void>
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

const normalizeProfileUpdateError = (
  error: unknown,
  fallbackMessage: string
): ProfileUpdateError => {
  if (error && typeof error === 'object') {
    const message = 'message' in error && typeof error.message === 'string' ? error.message : fallbackMessage
    const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined
    const details = 'details' in error && typeof error.details === 'string' ? error.details : null
    const hint = 'hint' in error && typeof error.hint === 'string' ? error.hint : null

    return { code, message, details, hint }
  }

  return { message: fallbackMessage }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      console.log('Buscando perfil para userId:', userId)

      const { data, error } = await supabase.from('usuarios').select('*').eq('id', userId).single()

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('Perfil nao encontrado para userId:', userId)
        } else {
          console.error('Erro ao buscar perfil:', {
            userId,
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          })
        }

        return null
      }

      console.log('Perfil encontrado:', data)
      return data as UserProfile
    } catch (error) {
      console.error('Erro generico ao buscar perfil:', { userId, error })
      return null
    }
  }, [])

  const createProfileFromMetadata = useCallback(async (nextUser: User) => {
    try {
      const { username, nome_completo } = getMetadataProfile(nextUser)

      if (!username || !nome_completo) {
        console.error('Nao ha metadata suficiente para criar perfil automaticamente sem usar email:', {
          userId: nextUser.id,
          hasUsername: Boolean(username),
          hasNomeCompleto: Boolean(nome_completo),
        })
        return null
      }

      const profileData = {
        id: nextUser.id,
        username,
        nome_completo,
        avatar_url: null,
        bio: null,
        data_cadastro: new Date().toISOString(),
        configuracoes_privacidade: {},
      }

      const { data, error } = await supabase.from('usuarios').insert(profileData).select().single()
      if (error) {
        console.error('Erro ao criar perfil a partir de metadata:', {
          userId: nextUser.id,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        })
        return null
      }

      console.log('Perfil criado a partir de metadata:', data)
      return data as UserProfile
    } catch (error) {
      console.error('Erro generico ao criar perfil a partir de metadata:', {
        userId: nextUser.id,
        error,
      })
      return null
    }
  }, [])

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
        .select('*')
        .single()

      if (error) {
        console.error('Erro ao corrigir perfil legado com dados herdados do email:', {
          userId: nextUser.id,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        })
        return currentProfile
      }

      console.log('Perfil legado corrigido com sucesso:', data)
      return data as UserProfile
    } catch (error) {
      console.error('Erro generico ao corrigir perfil legado:', {
        userId: nextUser.id,
        error,
      })
      return currentProfile
    }
  }, [])

  const fetchOrCreateProfile = useCallback(
    async (nextUser: User) => {
      const existingProfile = await fetchProfile(nextUser.id)
      if (existingProfile) {
        return await repairLegacyProfile(nextUser, existingProfile)
      }

      return await createProfileFromMetadata(nextUser)
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

  const refreshProfile = useCallback(async () => {
    return await loadProfile(user)
  }, [loadProfile, user])

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
          .select('*')
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
    const init = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

      setSession(currentSession)
      setUser(currentSession?.user ?? null)
      await loadProfile(currentSession?.user ?? null)
      setLoading(false)
    }

    void init()

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      await loadProfile(nextSession?.user ?? null)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [loadProfile])

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    return { error }
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{ session, user, profile, loading, login, logout, refreshProfile, updateOwnProfile }}
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
