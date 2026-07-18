import { supabase } from '../../../supabase-client'
import type { StatusJogoRow } from '../../../types/supabase'
import {
  STATUS_VALUES,
  type DeleteGameStatusParams,
  type GameStatusEntry,
  type GameStatusError,
  type SaveGameStatusParams,
  type ServiceResult,
} from '../domain/gameStatus'
import {
  isCompleteStatusRow,
  normalizeGameStatusError,
  normalizeStatusRow,
} from './gameStatusMappers'

function validateSaveGameStatusParams({
  userId,
  gameId,
  status,
}: SaveGameStatusParams): GameStatusError | null {
  if (!userId.trim()) {
    return { message: 'Nao foi possivel identificar o usuario do status.' }
  }

  if (!Number.isInteger(gameId) || gameId <= 0) {
    return { message: 'Nao foi possivel identificar o jogo do status.' }
  }

  if (!STATUS_VALUES.includes(status)) {
    return { message: 'Escolha um status valido para salvar o jogo no perfil.' }
  }

  return null
}

async function updateSavedGameStatus(
  { userId, gameId, status, favorito }: SaveGameStatusParams,
  statusId?: string
): Promise<ServiceResult<GameStatusEntry | null>> {
  let updateQuery = supabase
    .from('status_jogo')
    .update({ status, favorito })
    .eq('usuario_id', userId)

  updateQuery = statusId ? updateQuery.eq('id', statusId) : updateQuery.eq('jogo_id', gameId)

  const { data, error } = await updateQuery
    .select('id, usuario_id, jogo_id, status, created_at, favorito')
    .single()

  if (error) {
    return {
      data: null,
      error: normalizeGameStatusError(error, 'Nao foi possivel atualizar o status deste jogo.'),
    }
  }

  if (!isCompleteStatusRow(data as StatusJogoRow)) {
    return {
      data: null,
      error: {
        message:
          'Nao foi possivel confirmar o status atualizado. Verifique as policies SELECT da tabela status_jogo.',
      },
    }
  }

  return { data: normalizeStatusRow(data as StatusJogoRow), error: null }
}

export async function saveGameStatus(
  params: SaveGameStatusParams
): Promise<ServiceResult<GameStatusEntry | null>> {
  const validationError = validateSaveGameStatusParams(params)

  if (validationError) {
    return { data: null, error: validationError }
  }

  const { userId, gameId, status, favorito } = params

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
        error: normalizeGameStatusError(
          existingError,
          'Nao foi possivel verificar o status atual do jogo.'
        ),
      }
    }

    if (existingEntry) {
      return updateSavedGameStatus(params, existingEntry.id)
    }

    const { data, error } = await supabase
      .from('status_jogo')
      .insert({ usuario_id: userId, jogo_id: gameId, status, favorito })
      .select('id, usuario_id, jogo_id, status, created_at, favorito')
      .single()

    if (error) {
      if (error.code === '23505') {
        return updateSavedGameStatus(params)
      }

      return {
        data: null,
        error: normalizeGameStatusError(error, 'Nao foi possivel criar o status deste jogo.'),
      }
    }

    if (!isCompleteStatusRow(data as StatusJogoRow)) {
      return {
        data: null,
        error: {
          message:
            'Nao foi possivel confirmar o status criado. Verifique as policies SELECT da tabela status_jogo.',
        },
      }
    }

    return { data: normalizeStatusRow(data as StatusJogoRow), error: null }
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

    return { data: null, error: null }
  } catch (error) {
    return {
      data: null,
      error: normalizeGameStatusError(error, 'Erro inesperado ao remover este jogo do perfil.'),
    }
  }
}
