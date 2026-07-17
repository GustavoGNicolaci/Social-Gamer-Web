export interface NotificationActor {
  id: string
  username: string
  nome_completo: string | null
  avatar_path: string | null
}

export interface UserNotification {
  id: string
  user_id: string
  actor_id: string | null
  type: string
  title: string
  message: string | null
  entity_type: string | null
  entity_id: string | null
  link: string | null
  metadata: Record<string, unknown>
  is_read: boolean
  read_at: string | null
  created_at: string
  actor: NotificationActor | null
}

export interface NotificationServiceError {
  code?: string
  message: string
  details?: string | null
  hint?: string | null
}
