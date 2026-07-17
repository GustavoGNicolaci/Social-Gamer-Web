import type { Session, User } from '@supabase/supabase-js'

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

export interface AuthContextValue {
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
