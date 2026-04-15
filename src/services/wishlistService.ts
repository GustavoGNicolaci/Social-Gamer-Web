import { supabase } from '../supabase-client'

export interface WishlistError {
  code?: string
  message: string
  details?: string | null
  hint?: string | null
}

export interface WishlistEntry {
  id: string
  usuario_id: string
  jogo_id: number
  adicionado_em: string | null
  prioridade: number | null
}

export interface WishlistGame {
  id: number
  titulo: string
  capa_url: string | null
  desenvolvedora: string[] | string | null
  generos: string[] | string | null
  data_lancamento: string | null
  plataformas: string[] | string | null
}

type WishlistGameRelation = WishlistGame | WishlistGame[] | null

interface WishlistGameRow extends WishlistEntry {
  jogo: WishlistGameRelation
}

export interface WishlistGameItem extends WishlistEntry {
  jogo: WishlistGame | null
}

interface ServiceResult<T> {
  data: T
  error: WishlistError | null
}

interface AddWishlistParams {
  userId: string
  gameId: number
}

interface AddWishlistResult extends ServiceResult<WishlistEntry | null> {
  status: 'added' | 'duplicate' | 'error'
}

function normalizeWishlistError(error: unknown, fallbackMessage: string): WishlistError {
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

function resolveWishlistGame(game: WishlistGameRelation) {
  if (Array.isArray(game)) return game[0] || null
  return game
}

export async function getWishlistEntry(
  userId: string,
  gameId: number
): Promise<ServiceResult<WishlistEntry | null>> {
  try {
    const { data, error } = await supabase
      .from('lista_desejos')
      .select('id, usuario_id, jogo_id, adicionado_em, prioridade')
      .eq('usuario_id', userId)
      .eq('jogo_id', gameId)
      .maybeSingle()

    if (error) {
      return {
        data: null,
        error: normalizeWishlistError(error, 'Nao foi possivel verificar a lista de desejos.'),
      }
    }

    return {
      data: (data as WishlistEntry | null) || null,
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: normalizeWishlistError(error, 'Erro inesperado ao verificar a lista de desejos.'),
    }
  }
}

export async function addGameToWishlist({
  userId,
  gameId,
}: AddWishlistParams): Promise<AddWishlistResult> {
  const existingEntry = await getWishlistEntry(userId, gameId)

  if (existingEntry.error) {
    return {
      status: 'error',
      data: null,
      error: existingEntry.error,
    }
  }

  if (existingEntry.data) {
    return {
      status: 'duplicate',
      data: existingEntry.data,
      error: null,
    }
  }

  try {
    const { data, error } = await supabase
      .from('lista_desejos')
      .insert({
        usuario_id: userId,
        jogo_id: gameId,
        adicionado_em: new Date().toISOString(),
        prioridade: 1,
      })
      .select('id, usuario_id, jogo_id, adicionado_em, prioridade')
      .single()

    if (error) {
      return {
        status: 'error',
        data: null,
        error: normalizeWishlistError(error, 'Nao foi possivel salvar o jogo na lista de desejos.'),
      }
    }

    return {
      status: 'added',
      data: (data as WishlistEntry | null) || null,
      error: null,
    }
  } catch (error) {
    return {
      status: 'error',
      data: null,
      error: normalizeWishlistError(
        error,
        'Erro inesperado ao salvar o jogo na lista de desejos.'
      ),
    }
  }
}

export async function getWishlistGamesByUserId(
  userId: string
): Promise<ServiceResult<WishlistGameItem[]>> {
  try {
    const { data, error } = await supabase
      .from('lista_desejos')
      .select(`
        id,
        usuario_id,
        jogo_id,
        adicionado_em,
        prioridade,
        jogo:jogos (
          id,
          titulo,
          capa_url,
          desenvolvedora,
          generos,
          data_lancamento,
          plataformas
        )
      `)
      .eq('usuario_id', userId)
      .order('adicionado_em', { ascending: false })

    if (error) {
      return {
        data: [],
        error: normalizeWishlistError(error, 'Nao foi possivel carregar a lista de desejos.'),
      }
    }

    const normalizedItems = ((data || []) as WishlistGameRow[]).map(item => ({
      ...item,
      jogo: resolveWishlistGame(item.jogo),
    }))

    return {
      data: normalizedItems,
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeWishlistError(error, 'Erro inesperado ao carregar a lista de desejos.'),
    }
  }
}
