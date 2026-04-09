import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../supabase-client'

interface UserProfile {
  id: string
  username: string
  nome_completo: string
  avatar_url: string | null
  bio: string | null
  data_cadastro: string
  configuracoes_privacidade: any
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ error: any }>
  logout: () => Promise<void>
  refreshProfile: () => Promise<UserProfile | null>
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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const fetchProfile = async (userId: string) => {
    try {
      console.log('Buscando perfil para userId:', userId)

      const { data, error } = await supabase.from('usuarios').select('*').eq('id', userId).single()

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('Perfil nao encontrado para userId:', userId)
        } else {
          console.error('Erro ao buscar perfil:', error.message)
          console.error('Codigo do erro:', error.code)
        }
        return null
      }

      console.log('Perfil encontrado:', data)
      return data as UserProfile
    } catch (err) {
      console.error('Erro generico ao buscar perfil:', err)
      return null
    }
  }

  const createProfileFromMetadata = async (user: User) => {
    try {
      const { username, nome_completo } = getMetadataProfile(user)

      if (!username || !nome_completo) {
        console.error('Nao ha metadata suficiente para criar perfil automaticamente sem usar email:', {
          userId: user.id,
          hasUsername: Boolean(username),
          hasNomeCompleto: Boolean(nome_completo),
        })
        return null
      }

      const profileData = {
        id: user.id,
        username,
        nome_completo,
        avatar_url: null,
        bio: null,
        data_cadastro: new Date().toISOString(),
        configuracoes_privacidade: {},
      }

      const { data, error } = await supabase.from('usuarios').insert(profileData).select().single()
      if (error) {
        console.error('Erro ao criar perfil a partir de metadata:', error.message)
        return null
      }

      console.log('Perfil criado a partir de metadata:', data)
      return data as UserProfile
    } catch (err) {
      console.error('Erro generico ao criar perfil a partir de metadata:', err)
      return null
    }
  }

  const repairLegacyProfile = async (user: User, profile: UserProfile) => {
    try {
      const { username: metadataUsername, nome_completo: metadataNomeCompleto } = getMetadataProfile(user)
      if (!metadataUsername || !metadataNomeCompleto) {
        return profile
      }

      const normalizedEmail = user.email?.trim().toLowerCase() || ''
      const emailLocalPart = getEmailLocalPart(user.email)
      const normalizedProfileUsername = profile.username?.trim().toLowerCase() || ''
      const normalizedProfileNomeCompleto = profile.nome_completo?.trim().toLowerCase() || ''

      const shouldRepairUsername =
        normalizedProfileUsername === emailLocalPart && profile.username !== metadataUsername

      const shouldRepairNomeCompleto =
        normalizedProfileNomeCompleto === normalizedEmail &&
        profile.nome_completo !== metadataNomeCompleto

      if (!shouldRepairUsername && !shouldRepairNomeCompleto) {
        return profile
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
        .eq('id', user.id)
        .select('*')
        .single()

      if (error) {
        console.error('Erro ao corrigir perfil legado com dados herdados do email:', error.message)
        return profile
      }

      console.log('Perfil legado corrigido com sucesso:', data)
      return data as UserProfile
    } catch (err) {
      console.error('Erro generico ao corrigir perfil legado:', err)
      return profile
    }
  }

  const fetchOrCreateProfile = async (user: User) => {
    const existingProfile = await fetchProfile(user.id)
    if (existingProfile) {
      return await repairLegacyProfile(user, existingProfile)
    }

    return await createProfileFromMetadata(user)
  }

  const loadProfile = async (targetUser: User | null) => {
    if (!targetUser) {
      setProfile(null)
      return null
    }

    const nextProfile = await fetchOrCreateProfile(targetUser)
    setProfile(nextProfile)
    return nextProfile
  }

  const refreshProfile = async () => {
    return await loadProfile(user)
  }

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

    init()

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
      await loadProfile(newSession?.user ?? null)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    return { error }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
