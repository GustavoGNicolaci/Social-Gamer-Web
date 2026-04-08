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
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  // fetch profile from 'usuarios' table
  const fetchProfile = async (userId: string) => {
    try {
      console.log('Buscando perfil para userId:', userId)

      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('Perfil não encontrado para userId:', userId)
        } else {
          console.error('Erro ao buscar perfil:', error.message)
          console.error('Código do erro:', error.code)
        }
        return null
      }

      console.log('Perfil encontrado:', data)
      return data as UserProfile
    } catch (err) {
      console.error('Erro genérico ao buscar perfil:', err)
      return null
    }
  }

  const createProfileFromMetadata = async (user: User) => {
    try {
      const metadata = user.user_metadata as Record<string, any> | undefined
      const username = metadata?.username || user.email?.split('@')[0] || ''
      const nome_completo = metadata?.nome_completo || user.email || ''

      if (!username || !nome_completo) {
        console.log('Não há metadata suficiente para criar perfil automaticamente')
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
      console.error('Erro genérico ao criar perfil a partir de metadata:', err)
      return null
    }
  }

  const fetchOrCreateProfile = async (user: User) => {
    const profile = await fetchProfile(user.id)
    if (profile) return profile
    return await createProfileFromMetadata(user)
  }

  useEffect(() => {
    // check current session on mount
    const init = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()
      setSession(currentSession)
      setUser(currentSession?.user ?? null)
      if (currentSession?.user) {
        const prof = await fetchOrCreateProfile(currentSession.user)
        setProfile(prof)
      }
      setLoading(false)
    }
    init()

    // subscribe to auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession)
        setUser(newSession?.user ?? null)
        if (newSession?.user) {
          const prof = await fetchOrCreateProfile(newSession.user)
          setProfile(prof)
        } else {
          setProfile(null)
        }
      }
    )

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    // after login, onAuthStateChange will fire and update profile
    return { error }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{ session, user, profile, loading, login, logout }}
    >
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
