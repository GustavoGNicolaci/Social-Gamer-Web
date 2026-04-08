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

      let { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Erro ao buscar perfil:', error.message)
        console.error('Código do erro:', error.code)
        return null
      }

      console.log('Perfil encontrado:', data)
      return data as UserProfile
    } catch (err) {
      console.error('Erro genérico ao buscar perfil:', err)
      return null
    }
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
        const prof = await fetchProfile(currentSession.user.id)
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
          const prof = await fetchProfile(newSession.user.id)
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
    const { data, error } = await supabase.auth.signInWithPassword({
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
