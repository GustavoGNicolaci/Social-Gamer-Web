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

interface DeleteWishlistEntryParams {
  userId: string
  wishlistEntryId: string
}

interface AddWishlistResult extends ServiceResult<WishlistEntry | null> {
  status: 'added' | 'duplicate' | 'error'
}

interface WishlistSortable {
  id: string
  prioridade: number | null
  adicionado_em: string | null
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

function getComparableTimestamp(value: string | null) {
  if (!value) return 0

  const parsedDate = new Date(value)
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime()
}

function sortWishlistItemsByDisplayOrder<T extends WishlistSortable>(items: T[]) {
  const prioritizedItems = items
    .filter(item => item.prioridade !== null)
    .sort((leftItem, rightItem) => {
      const priorityDelta = (leftItem.prioridade || 0) - (rightItem.prioridade || 0)
      if (priorityDelta !== 0) return priorityDelta

      const addedAtDelta =
        getComparableTimestamp(rightItem.adicionado_em) -
        getComparableTimestamp(leftItem.adicionado_em)
      if (addedAtDelta !== 0) return addedAtDelta

      return leftItem.id.localeCompare(rightItem.id)
    })

  const unprioritizedItems = items
    .filter(item => item.prioridade === null)
    .sort((leftItem, rightItem) => {
      const addedAtDelta =
        getComparableTimestamp(rightItem.adicionado_em) -
        getComparableTimestamp(leftItem.adicionado_em)
      if (addedAtDelta !== 0) return addedAtDelta

      return leftItem.id.localeCompare(rightItem.id)
    })

  const maxPriority = prioritizedItems.reduce(
    (currentMax, item) => Math.max(currentMax, item.prioridade || 0),
    0
  )

  const effectivePriority = new Map<string, number>()

  prioritizedItems.forEach(item => {
    effectivePriority.set(item.id, item.prioridade || 0)
  })

  unprioritizedItems.forEach((item, index) => {
    effectivePriority.set(item.id, maxPriority + index + 1)
  })

  return [...items].sort((leftItem, rightItem) => {
    const priorityDelta =
      (effectivePriority.get(leftItem.id) || 0) - (effectivePriority.get(rightItem.id) || 0)
    if (priorityDelta !== 0) return priorityDelta

    const addedAtDelta =
      getComparableTimestamp(rightItem.adicionado_em) -
      getComparableTimestamp(leftItem.adicionado_em)
    if (addedAtDelta !== 0) return addedAtDelta

    return leftItem.id.localeCompare(rightItem.id)
  })
}

function getNextWishlistPriority(items: WishlistSortable[]) {
  const maxPriority = items.reduce(
    (currentMax, item) => Math.max(currentMax, item.prioridade || 0),
    0
  )
  const unprioritizedCount = items.filter(item => item.prioridade === null).length

  return maxPriority + unprioritizedCount + 1
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
    const { data: priorityRows, error: priorityError } = await supabase
      .from('lista_desejos')
      .select('id, prioridade, adicionado_em')
      .eq('usuario_id', userId)

    if (priorityError) {
      return {
        status: 'error',
        data: null,
        error: normalizeWishlistError(
          priorityError,
          'Nao foi possivel preparar a ordem da lista de desejos.'
        ),
      }
    }

    const { data, error } = await supabase
      .from('lista_desejos')
      .insert({
        usuario_id: userId,
        jogo_id: gameId,
        adicionado_em: new Date().toISOString(),
        prioridade: getNextWishlistPriority((priorityRows || []) as WishlistEntry[]),
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
      .order('prioridade', { ascending: true, nullsFirst: false })
      .order('adicionado_em', { ascending: false })

    if (error) {
      return {
        data: [],
        error: normalizeWishlistError(error, 'Nao foi possivel carregar a lista de desejos.'),
      }
    }

    const normalizedItems = sortWishlistItemsByDisplayOrder(
      ((data || []) as WishlistGameRow[]).map(item => ({
        ...item,
        jogo: resolveWishlistGame(item.jogo),
      }))
    )

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

export async function updateWishlistPriorities(
  userId: string,
  orderedItems: WishlistGameItem[]
): Promise<ServiceResult<WishlistGameItem[]>> {
  const itemsWithNextPriority = orderedItems.map((item, index) => ({
    ...item,
    prioridade: index + 1,
  }))

  const changedItems = itemsWithNextPriority.filter(
    item => item.prioridade !== (orderedItems.find(currentItem => currentItem.id === item.id)?.prioridade || null)
  )

  if (changedItems.length === 0) {
    return {
      data: itemsWithNextPriority,
      error: null,
    }
  }

  try {
    const updateResults = await Promise.all(
      changedItems.map(async item => {
        const { error } = await supabase
          .from('lista_desejos')
          .update({ prioridade: item.prioridade })
          .eq('id', item.id)
          .eq('usuario_id', userId)

        return { id: item.id, error }
      })
    )

    const failedUpdate = updateResults.find(result => result.error)

    if (failedUpdate?.error) {
      return {
        data: orderedItems,
        error: normalizeWishlistError(
          failedUpdate.error,
          'Nao foi possivel salvar a nova ordem da lista de desejos.'
        ),
      }
    }

    return {
      data: itemsWithNextPriority,
      error: null,
    }
  } catch (error) {
    return {
      data: orderedItems,
      error: normalizeWishlistError(
        error,
        'Erro inesperado ao salvar a nova ordem da lista de desejos.'
      ),
    }
  }
}

export async function deleteWishlistEntry({
  userId,
  wishlistEntryId,
}: DeleteWishlistEntryParams): Promise<ServiceResult<null>> {
  try {
    const { data, error } = await supabase
      .from('lista_desejos')
      .delete()
      .eq('id', wishlistEntryId)
      .eq('usuario_id', userId)
      .select('id')
      .maybeSingle()

    if (error) {
      return {
        data: null,
        error: normalizeWishlistError(error, 'Nao foi possivel remover o jogo da wishlist.'),
      }
    }

    if (!data) {
      return {
        data: null,
        error: {
          message:
            'Nenhum item foi removido. Verifique as policies DELETE da tabela lista_desejos no Supabase.',
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
      error: normalizeWishlistError(error, 'Erro inesperado ao remover o jogo da wishlist.'),
    }
  }
}
