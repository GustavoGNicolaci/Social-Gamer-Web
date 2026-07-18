import { supabase } from '../../../supabase-client'
import {
  type AddOwnWishlistRow,
  type AddWishlistParams,
  type AddWishlistResult,
  type DeleteWishlistEntryParams,
  type WishlistGameItem,
  type WishlistServiceResult,
} from '../domain/wishlist'
import { normalizeWishlistError } from './wishlistRepository'

export async function addGameToWishlist({
  userId,
  gameId,
}: AddWishlistParams): Promise<AddWishlistResult> {
  if (!userId.trim() || !Number.isInteger(gameId) || gameId <= 0) {
    return {
      status: 'error',
      data: null,
      error: { message: 'Nao foi possivel identificar o usuario ou o jogo da wishlist.' },
    }
  }

  try {
    const { data, error } = await supabase.rpc('add_own_wishlist_item', {
      p_game_id: gameId,
    })

    if (error) {
      return {
        status: 'error',
        data: null,
        error: normalizeWishlistError(error, 'Nao foi possivel salvar o jogo na lista de desejos.'),
      }
    }

    const row = (Array.isArray(data) ? data[0] : data) as AddOwnWishlistRow | null

    if (!row) {
      return {
        status: 'error',
        data: null,
        error: { message: 'O Supabase nao retornou o item salvo na lista de desejos.' },
      }
    }

    const { inserted, ...entry } = row
    return {
      status: inserted ? 'added' : 'duplicate',
      data: entry,
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

export async function updateWishlistPriorities(
  userId: string,
  orderedItems: WishlistGameItem[]
): Promise<WishlistServiceResult<WishlistGameItem[]>> {
  const itemsWithNextPriority = orderedItems.map((item, index) => ({
    ...item,
    prioridade: index + 1,
  }))

  if (!userId.trim()) {
    return {
      data: orderedItems,
      error: { message: 'Nao foi possivel identificar o usuario da lista de desejos.' },
    }
  }

  try {
    const { error } = await supabase.rpc('reorder_own_wishlist', {
      p_item_ids: itemsWithNextPriority.map(item => item.id),
    })

    if (error) {
      return {
        data: orderedItems,
        error: normalizeWishlistError(
          error,
          'Nao foi possivel salvar a nova ordem da lista de desejos.'
        ),
      }
    }

    return { data: itemsWithNextPriority, error: null }
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
}: DeleteWishlistEntryParams): Promise<WishlistServiceResult<null>> {
  if (!userId.trim() || !wishlistEntryId.trim()) {
    return {
      data: null,
      error: { message: 'Nao foi possivel identificar o item da wishlist.' },
    }
  }

  try {
    const { data, error } = await supabase.rpc('remove_own_wishlist_item', {
      p_item_id: wishlistEntryId,
    })

    if (error) {
      return {
        data: null,
        error: normalizeWishlistError(error, 'Nao foi possivel remover o jogo da wishlist.'),
      }
    }

    if (data !== true) {
      return {
        data: null,
        error: { message: 'Nenhum item foi removido da wishlist deste usuario.' },
      }
    }

    return { data: null, error: null }
  } catch (error) {
    return {
      data: null,
      error: normalizeWishlistError(error, 'Erro inesperado ao remover o jogo da wishlist.'),
    }
  }
}
