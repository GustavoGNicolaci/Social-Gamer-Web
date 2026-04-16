import { supabase } from '../supabase-client'
import type { CatalogGamePreview } from './gameCatalogService'

export type GameStatusValue = 'jogando' | 'zerado' | 'dropado'

export interface GameStatusError {
  code?: string
  message: string
  details?: string | null
  hint?: string | null
}

export interface GameStatusEntry {
  id: string
  usuario_id: string
  jogo_id: number
  status: GameStatusValue
  created_at: string | null
  favorito: boolean
}

export type StatusGame = CatalogGamePreview

export interface GameStatusItem extends GameStatusEntry {
  jogo: StatusGame | null
}

interface ServiceResult<T> {
  data: T
  error: GameStatusError | null
}

interface SaveGameStatusParams {
  userId: string
  gameId: number
  status: GameStatusValue
  favorito: boolean
}

interface DeleteGameStatusParams {
  userId: string
  statusId: string
}

const STATUS_VALUES: GameStatusValue[] = ['jogando', 'zerado', 'dropado']

function normalizeGameStatusError(error: unknown, fallbackMessage: string): GameStatusError {
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

function normalizeStatusValue(value: string): GameStatusValue {
  const normalizedValue = value.trim().toLowerCase()

  if (STATUS_VALUES.includes(normalizedValue as GameStatusValue)) {
    return normalizedValue as GameStatusValue
  }

  return 'jogando'
}

export async function getGameStatusesByUserId(
  userId: string
): Promise<ServiceResult<GameStatusItem[]>> {
  try {
    const { data: statusRows, error: statusError } = await supabase
      .from('status_jogo')
      .select('id, usuario_id, jogo_id, status, created_at, favorito')
      .eq('usuario_id', userId)

    if (statusError) {
      return {
        data: [],
        error: normalizeGameStatusError(statusError, 'Nao foi possivel carregar os status dos jogos.'),
      }
    }

    const normalizedStatusRows = ((statusRows || []) as GameStatusEntry[]).map(row => ({
      ...row,
      status: normalizeStatusValue(row.status),
      favorito: Boolean(row.favorito),
    }))

    if (normalizedStatusRows.length === 0) {
      return {
        data: [],
        error: null,
      }
    }

    const gameIds = Array.from(new Set(normalizedStatusRows.map(row => row.jogo_id)))

    const { data: gameRows, error: gameError } = await supabase
      .from('jogos')
      .select('id, titulo, capa_url, desenvolvedora, generos, data_lancamento, plataformas')
      .in('id', gameIds)

    if (gameError) {
      return {
        data: [],
        error: normalizeGameStatusError(gameError, 'Nao foi possivel carregar os jogos com status.'),
      }
    }

    const gamesById = new Map<number, StatusGame>()

    ;((gameRows || []) as StatusGame[]).forEach(game => {
      gamesById.set(game.id, game)
    })

    return {
      data: normalizedStatusRows.map(item => ({
        ...item,
        jogo: gamesById.get(item.jogo_id) || null,
      })),
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeGameStatusError(error, 'Erro inesperado ao carregar os status dos jogos.'),
    }
  }
}

export async function getGameStatusEntry(
  userId: string,
  gameId: number
): Promise<ServiceResult<GameStatusEntry | null>> {
  try {
    const { data, error } = await supabase
      .from('status_jogo')
      .select('id, usuario_id, jogo_id, status, created_at, favorito')
      .eq('usuario_id', userId)
      .eq('jogo_id', gameId)
      .maybeSingle()

    if (error) {
      return {
        data: null,
        error: normalizeGameStatusError(error, 'Nao foi possivel carregar o status deste jogo.'),
      }
    }

    if (!data) {
      return {
        data: null,
        error: null,
      }
    }

    const entry = data as GameStatusEntry

    return {
      data: {
        ...entry,
        status: normalizeStatusValue(entry.status),
        favorito: Boolean(entry.favorito),
      },
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: normalizeGameStatusError(error, 'Erro inesperado ao carregar o status deste jogo.'),
    }
  }
}


export async function saveGameStatus({
  userId,
  gameId,
  status,
  favorito,
}: SaveGameStatusParams): Promise<ServiceResult<GameStatusEntry | null>> {
  try {
    const { data: existingEntry, error: existingError } = await supabase
      .from('status_jogo')
      .select('id, usuario_id, jogo_id, status, created_at, favorito')
      .eq('usuario_id', userId)
      .eq('jogo_id', gameId)
      .maybeSingle()

    if (existingError) {
      return {
        data: null,
        error: normalizeGameStatusError(existingError, 'Nao foi possivel verificar o status atual do jogo.'),
      }
    }

    if (existingEntry) {
      const { data, error } = await supabase
        .from('status_jogo')
        .update({
          status,
          favorito,
        })
        .eq('id', existingEntry.id)
        .eq('usuario_id', userId)
        .select('id, usuario_id, jogo_id, status, created_at, favorito')
        .single()

      if (error) {
        return {
          data: null,
          error: normalizeGameStatusError(error, 'Nao foi possivel atualizar o status deste jogo.'),
        }
      }

      return {
        data: {
          ...(data as GameStatusEntry),
          status: normalizeStatusValue((data as GameStatusEntry).status),
          favorito: Boolean((data as GameStatusEntry).favorito),
        },
        error: null,
      }
    }

    const { data, error } = await supabase
      .from('status_jogo')
      .insert({
        usuario_id: userId,
        jogo_id: gameId,
        status,
        favorito,
        created_at: new Date().toISOString(),
      })
      .select('id, usuario_id, jogo_id, status, created_at, favorito')
      .single()

    if (error) {
      return {
        data: null,
        error: normalizeGameStatusError(error, 'Nao foi possivel criar o status deste jogo.'),
      }
    }

    return {
      data: {
        ...(data as GameStatusEntry),
        status: normalizeStatusValue((data as GameStatusEntry).status),
        favorito: Boolean((data as GameStatusEntry).favorito),
      },
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: normalizeGameStatusError(error, 'Erro inesperado ao salvar o status deste jogo.'),
    }
  }
}

export async function deleteGameStatus({
  userId,
  statusId,
}: DeleteGameStatusParams): Promise<ServiceResult<null>> {
  try {
    const { data, error } = await supabase
      .from('status_jogo')
      .delete()
      .eq('id', statusId)
      .eq('usuario_id', userId)
      .select('id')
      .maybeSingle()

    if (error) {
      return {
        data: null,
        error: normalizeGameStatusError(error, 'Nao foi possivel remover este jogo do perfil.'),
      }
    }

    if (!data) {
      return {
        data: null,
        error: {
          message:
            'Nenhum status foi removido. Verifique as policies DELETE da tabela status_jogo no Supabase.',
        },
      }
    }

    return {
      data: null,
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: normalizeGameStatusError(error, 'Erro inesperado ao remover este jogo do perfil.'),
    }
  }
}
