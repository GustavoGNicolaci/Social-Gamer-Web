import { useCallback, useEffect, useRef, useState } from 'react'
import type { TranslationParams } from '../../../i18n'
import {
  addGameToWishlist,
  deleteWishlistEntry,
  getWishlistEntry,
  type WishlistError,
} from '../../../services/wishlistService'
import {
  isSupabaseDuplicateError,
  isSupabasePermissionError,
  isSupabaseStructureError,
} from '../../../utils/supabaseErrors'

type Translate = (key: string, params?: TranslationParams) => string

type FeedbackTone = 'success' | 'error' | 'info'

interface WishlistFeedback {
  tone: FeedbackTone
  message: string
}

interface UseGameWishlistActionOptions {
  userId: string | null | undefined
  gameId: number | null | undefined
  t: Translate
}

function getWishlistContextKey(
  userId: string | null | undefined,
  gameId: number | null | undefined
) {
  return userId && gameId ? `${userId}:${gameId}` : null
}

function getWishlistErrorMessage(
  error: WishlistError | null,
  action: 'save' | 'delete' = 'save'
) {
  if (!error) {
    return action === 'save'
      ? 'Nao foi possivel salvar este jogo na sua lista de desejos agora.'
      : 'Nao foi possivel remover este jogo da sua lista de desejos agora.'
  }

  if (isSupabasePermissionError(error)) {
    return action === 'save'
      ? 'Nao foi possivel acessar sua lista de desejos por permissao. Verifique as policies da tabela lista_desejos no Supabase.'
      : 'Nao foi possivel remover este jogo da sua lista de desejos por permissao. Verifique as policies DELETE da tabela lista_desejos no Supabase.'
  }

  if (isSupabaseDuplicateError(error)) {
    return 'Esse jogo já está na sua lista de desejos.'
  }

  if (isSupabaseStructureError(error)) {
    return 'A estrutura da tabela lista_desejos nao corresponde ao frontend.'
  }

  return action === 'save'
    ? 'Nao foi possivel salvar este jogo na sua lista de desejos agora.'
    : 'Nao foi possivel remover este jogo da sua lista de desejos agora.'
}

export function useGameWishlistAction({
  userId,
  gameId,
  t,
}: UseGameWishlistActionOptions) {
  const [wishlistLoading, setWishlistLoading] = useState(false)
  const [wishlistSaving, setWishlistSaving] = useState(false)
  const [isInWishlist, setIsInWishlist] = useState(false)
  const [wishlistEntryId, setWishlistEntryId] = useState<string | null>(null)
  const [wishlistFeedback, setWishlistFeedback] = useState<WishlistFeedback | null>(null)
  const loadRequestIdRef = useRef(0)
  const mutationRequestIdRef = useRef(0)
  const pendingMutationRef = useRef<{ contextKey: string; requestId: number } | null>(null)
  const contextKey = getWishlistContextKey(userId, gameId)
  const activeContextKeyRef = useRef(contextKey)

  useEffect(() => {
    activeContextKeyRef.current = contextKey
    const requestId = loadRequestIdRef.current + 1
    loadRequestIdRef.current = requestId
    pendingMutationRef.current = null

    const loadWishlistStatus = async () => {
      setWishlistSaving(false)
      setWishlistFeedback(null)

      if (!userId || !gameId || !contextKey) {
        setWishlistLoading(false)
        setIsInWishlist(false)
        setWishlistEntryId(null)
        return
      }

      setWishlistLoading(true)
      setIsInWishlist(false)
      setWishlistEntryId(null)

      const { data, error } = await getWishlistEntry(userId, gameId)

      if (
        loadRequestIdRef.current !== requestId ||
        activeContextKeyRef.current !== contextKey
      ) {
        return
      }

      if (error) {
        console.error('Erro ao verificar wishlist do jogo:', error)
        setWishlistFeedback({
          tone: 'error',
          message: 'Nao foi possivel verificar sua lista de desejos agora.',
        })
        setIsInWishlist(false)
        setWishlistEntryId(null)
      } else {
        setIsInWishlist(Boolean(data))
        setWishlistEntryId(data?.id || null)
      }

      setWishlistLoading(false)
    }

    void loadWishlistStatus()

    return () => {
      if (loadRequestIdRef.current === requestId) {
        loadRequestIdRef.current += 1
      }
      if (activeContextKeyRef.current === contextKey) {
        activeContextKeyRef.current = null
      }
    }
  }, [contextKey, gameId, userId])

  const toggleWishlist = useCallback(async () => {
    if (
      !userId ||
      !gameId ||
      !contextKey ||
      wishlistLoading ||
      wishlistSaving ||
      pendingMutationRef.current?.contextKey === contextKey
    ) {
      return
    }

    const requestId = mutationRequestIdRef.current + 1
    mutationRequestIdRef.current = requestId
    pendingMutationRef.current = { contextKey, requestId }
    setWishlistSaving(true)
    setWishlistFeedback(null)

    const isCurrentMutation = () =>
      activeContextKeyRef.current === contextKey &&
      pendingMutationRef.current?.contextKey === contextKey &&
      pendingMutationRef.current.requestId === requestId

    try {
      if (isInWishlist && wishlistEntryId) {
        const { error } = await deleteWishlistEntry({
          userId,
          wishlistEntryId,
        })

        if (!isCurrentMutation()) return

        if (error) {
          console.error('Erro ao remover jogo da wishlist:', error)
          setWishlistFeedback({
            tone: 'error',
            message: getWishlistErrorMessage(error, 'delete'),
          })
        } else {
          setIsInWishlist(false)
          setWishlistEntryId(null)
          setWishlistFeedback({
            tone: 'info',
            message: t('game.details.wishlistRemoved'),
          })
        }
      } else {
        const result = await addGameToWishlist({ userId, gameId })

        if (!isCurrentMutation()) return

        if (result.status === 'added') {
          setIsInWishlist(true)
          setWishlistEntryId(result.data?.id || null)
          setWishlistFeedback({
            tone: 'success',
            message: t('game.details.wishlistSaved'),
          })
        } else if (result.status === 'duplicate') {
          setIsInWishlist(true)
          setWishlistEntryId(result.data?.id || null)
          setWishlistFeedback({
            tone: 'info',
            message: t('game.details.wishlistSaved'),
          })
        } else {
          console.error('Erro ao salvar jogo na wishlist:', result.error)
          setWishlistFeedback({
            tone: 'error',
            message: getWishlistErrorMessage(result.error, 'save'),
          })
        }
      }
    } finally {
      if (isCurrentMutation()) {
        pendingMutationRef.current = null
        setWishlistSaving(false)
      }
    }
  }, [contextKey, gameId, isInWishlist, t, userId, wishlistEntryId, wishlistLoading, wishlistSaving])

  return {
    wishlistLoading,
    wishlistSaving,
    isInWishlist,
    wishlistEntryId,
    wishlistFeedback,
    toggleWishlist,
  }
}
