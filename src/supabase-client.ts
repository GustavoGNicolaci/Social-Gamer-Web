import { createClient } from '@supabase/supabase-js'
import type { Database } from './types/supabase'

function getRequiredEnvValue(name: string, value: unknown) {
  const normalizedValue = typeof value === 'string' ? value.trim() : ''

  if (!normalizedValue || normalizedValue.startsWith('sua_')) {
    throw new Error(`Missing ${name}. Configure it in your local .env file before starting the app.`)
  }

  return normalizedValue
}

function getRequiredSupabaseUrl(value: unknown) {
  const normalizedValue = getRequiredEnvValue('VITE_SUPABASE_URL', value)

  try {
    return new URL(normalizedValue).toString().replace(/\/$/, '')
  } catch {
    throw new Error('Invalid VITE_SUPABASE_URL. Configure a valid Supabase project URL.')
  }
}

const supabaseUrl = getRequiredSupabaseUrl(import.meta.env.VITE_SUPABASE_URL)
const supabaseKey = getRequiredEnvValue('VITE_SUPABASE_ANON_KEY', import.meta.env.VITE_SUPABASE_ANON_KEY)

export const supabase = createClient<Database>(supabaseUrl, supabaseKey)

export function createStatelessSupabaseClient() {
  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
