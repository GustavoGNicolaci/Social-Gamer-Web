import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../../supabase-client'

export async function getCurrentSession(): Promise<Session | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return session
}

export function subscribeToAuthSession(
  onSessionChange: (session: Session | null) => void
) {
  const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
    onSessionChange(nextSession)
  })

  return () => listener.subscription.unsubscribe()
}
