import type {
  Database,
  StatusJogoRow,
} from '../../../types/supabase'
import { normalizeGamePreview } from '../../../services/gameAdapter'
import {
  STATUS_VALUES,
  normalizeStatusValue,
  type GameStatusEntry,
  type GameStatusError,
  type GameStatusItem,
  type StatusGame,
} from '../domain/gameStatus'

export type StatusGameRelation = StatusGame | StatusGame[] | null

export interface GameStatusRelationRow extends GameStatusEntry {
  jogo: StatusGameRelation
}

export type ProfileGameStatusPageRow =
  Database['public']['Functions']['get_profile_game_status_page']['Returns'][number]

export function normalizeGameStatusError(
  error: unknown,
  fallbackMessage: string
): GameStatusError {
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

function resolveStatusGame(game: StatusGameRelation) {
  if (Array.isArray(game)) return game[0] || null
  return game
}

export function isCompleteStatusRow<T extends StatusJogoRow | GameStatusEntry>(
  row: T
): row is T & GameStatusEntry {
  return Boolean(
    row.id &&
      row.usuario_id &&
      row.jogo_id &&
      typeof row.status === 'string' &&
      STATUS_VALUES.includes(row.status as GameStatusEntry['status'])
  )
}

export function normalizeStatusRow(row: StatusJogoRow | GameStatusEntry): GameStatusEntry {
  return {
    id: row.id,
    usuario_id: row.usuario_id || '',
    jogo_id: row.jogo_id || 0,
    status: normalizeStatusValue(row.status),
    created_at: row.created_at || null,
    favorito: Boolean(row.favorito),
  }
}

export function normalizeStatusRelationRow(row: GameStatusRelationRow): GameStatusItem {
  return {
    ...normalizeStatusRow(row),
    jogo: resolveStatusGame(row.jogo),
  }
}

export function normalizeProfileGameStatusPageRow(
  row: ProfileGameStatusPageRow
): GameStatusItem {
  return {
    id: row.id,
    usuario_id: row.usuario_id,
    jogo_id: row.jogo_id,
    status: normalizeStatusValue(row.status),
    created_at: row.created_at,
    favorito: Boolean(row.favorito),
    jogo: normalizeGamePreview({
      id: row.jogo_id,
      titulo: row.game_title,
      capa_url: row.game_cover_url,
      desenvolvedora: row.game_developer,
      generos: row.game_genres,
      data_lancamento: row.game_release_date,
      plataformas: row.game_platforms,
    }),
  }
}

export function isMissingProfileGameStatusPageRpc(error: GameStatusError) {
  return error.code === 'PGRST202' || error.code === '42883'
}
