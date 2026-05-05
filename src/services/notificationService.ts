import { supabase } from '../supabase-client'

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

interface NotificationRow {
  id: string
  user_id: string
  actor_id: string | null
  type: string
  title: string
  message: string | null
  entity_type: string | null
  entity_id: string | null
  link: string | null
  metadata: Record<string, unknown> | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

interface ActorRow {
  id: string
  username: string
  nome_completo: string | null
  avatar_path: string | null
}

interface ServiceResult<T> {
  data: T
  error: NotificationServiceError | null
}

const NOTIFICATION_SELECT = `
  id,
  user_id,
  actor_id,
  type,
  title,
  message,
  entity_type,
  entity_id,
  link,
  metadata,
  is_read,
  read_at,
  created_at
`

const DEFAULT_NOTIFICATION_LIMIT = 20

function normalizeNotificationError(
  error: unknown,
  fallbackMessage: string
): NotificationServiceError {
  if (error && typeof error === 'object') {
    const message =
      'message' in error && typeof error.message === 'string' ? error.message : fallbackMessage
    const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined
    const details =
      'details' in error && typeof error.details === 'string' ? error.details : null
    const hint = 'hint' in error && typeof error.hint === 'string' ? error.hint : null

    return { code, message, details, hint }
  }

  return { message: fallbackMessage }
}

function normalizeNotification(
  row: NotificationRow,
  actorsById: Map<string, NotificationActor>
): UserNotification {
  return {
    ...row,
    metadata: row.metadata || {},
    actor: row.actor_id ? actorsById.get(row.actor_id) || null : null,
  }
}

async function fetchActors(actorIds: string[]) {
  const uniqueActorIds = Array.from(new Set(actorIds.filter(Boolean)))

  if (uniqueActorIds.length === 0) {
    return new Map<string, NotificationActor>()
  }

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, username, nome_completo, avatar_path')
    .in('id', uniqueActorIds)

  if (error) {
    console.error('Erro ao carregar atores das notificacoes:', error)
    return new Map<string, NotificationActor>()
  }

  return new Map(
    ((data || []) as ActorRow[]).map(actor => [
      actor.id,
      {
        id: actor.id,
        username: actor.username,
        nome_completo: actor.nome_completo,
        avatar_path: actor.avatar_path,
      },
    ])
  )
}

export async function fetchNotifications(
  limit = DEFAULT_NOTIFICATION_LIMIT
): Promise<ServiceResult<UserNotification[]>> {
  try {
    const safeLimit = Math.min(Math.max(limit, 1), 50)
    const { data, error } = await supabase
      .from('notifications')
      .select(NOTIFICATION_SELECT)
      .order('created_at', { ascending: false })
      .limit(safeLimit)

    if (error) {
      return {
        data: [],
        error: normalizeNotificationError(error, 'Nao foi possivel carregar suas notificacoes.'),
      }
    }

    const rows = (data || []) as NotificationRow[]
    const actorsById = await fetchActors(
      rows.map(row => row.actor_id).filter((actorId): actorId is string => Boolean(actorId))
    )

    return {
      data: rows.map(row => normalizeNotification(row, actorsById)),
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeNotificationError(error, 'Erro inesperado ao carregar notificacoes.'),
    }
  }
}

export async function fetchUnreadNotificationCount(): Promise<ServiceResult<number>> {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false)

    return {
      data: count || 0,
      error: error
        ? normalizeNotificationError(error, 'Nao foi possivel carregar o contador de notificacoes.')
        : null,
    }
  } catch (error) {
    return {
      data: 0,
      error: normalizeNotificationError(error, 'Erro inesperado ao carregar contador.'),
    }
  }
}

export async function markNotificationRead(notificationId: string): Promise<ServiceResult<null>> {
  try {
    const { error } = await supabase.rpc('mark_notification_read', {
      p_notification_id: notificationId,
    })

    return {
      data: null,
      error: error
        ? normalizeNotificationError(error, 'Nao foi possivel marcar esta notificacao como lida.')
        : null,
    }
  } catch (error) {
    return {
      data: null,
      error: normalizeNotificationError(error, 'Erro inesperado ao marcar notificacao.'),
    }
  }
}

export async function markAllNotificationsRead(): Promise<ServiceResult<null>> {
  try {
    const { error } = await supabase.rpc('mark_all_notifications_read')

    return {
      data: null,
      error: error
        ? normalizeNotificationError(error, 'Nao foi possivel marcar todas como lidas.')
        : null,
    }
  } catch (error) {
    return {
      data: null,
      error: normalizeNotificationError(error, 'Erro inesperado ao marcar notificacoes.'),
    }
  }
}

export function subscribeToNotifications(
  userId: string,
  onChange: () => void
) {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      onChange
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}
