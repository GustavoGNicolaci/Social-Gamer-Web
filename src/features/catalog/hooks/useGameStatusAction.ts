import { useCallback, useEffect, useRef, useState } from 'react'
import type { TranslationParams } from '../../../i18n'
import {
  deleteGameStatus,
  getGameStatusEntry,
  saveGameStatus,
  type GameStatusEntry,
  type GameStatusError,
  type GameStatusValue,
} from '../../../services/gameStatusService'
import {
  isSupabasePermissionError,
  isSupabaseStructureError,
} from '../../../utils/supabaseErrors'

type Translate = (key: string, params?: TranslationParams) => string

type FeedbackTone = 'success' | 'error' | 'info'

interface GameStatusFeedback {
  tone: FeedbackTone
  message: string
}

interface UseGameStatusActionOptions {
  userId: string | null | undefined
  gameId: number | null | undefined
  t: Translate
}

function getGameStatusContextKey(
  userId: string | null | undefined,
  gameId: number | null | undefined
) {
  return userId && gameId ? `${userId}:${gameId}` : null
}

function getGameStatusErrorMessage(
  error: GameStatusError | null,
  action: 'save' | 'delete' = 'save'
) {
  if (!error) {
    return action === 'save'
      ? 'Nao foi possivel salvar este jogo no seu perfil agora.'
      : 'Nao foi possivel remover este jogo do seu perfil agora.'
  }

  if (isSupabasePermissionError(error)) {
    return action === 'save'
      ? 'Nao foi possivel salvar este jogo no perfil por permissao. Verifique as policies da tabela status_jogo no Supabase.'
      : 'Nao foi possivel remover este jogo do perfil por permissao. Verifique as policies DELETE da tabela status_jogo no Supabase.'
  }

  if (isSupabaseStructureError(error)) {
    return 'A estrutura da tabela status_jogo nao corresponde ao frontend.'
  }

  return action === 'save'
    ? 'Nao foi possivel salvar este jogo no seu perfil agora.'
    : 'Nao foi possivel remover este jogo do seu perfil agora.'
}

export function useGameStatusAction({ userId, gameId, t }: UseGameStatusActionOptions) {
  const [gameStatusLoading, setGameStatusLoading] = useState(false)
  const [gameStatusSaving, setGameStatusSaving] = useState(false)
  const [pendingGameStatus, setPendingGameStatus] = useState<GameStatusValue | null>(null)
  const [gameStatusEntry, setGameStatusEntry] = useState<GameStatusEntry | null>(null)
  const [gameStatusFeedback, setGameStatusFeedback] = useState<GameStatusFeedback | null>(null)
  const loadRequestIdRef = useRef(0)
  const mutationRequestIdRef = useRef(0)
  const pendingMutationRef = useRef<{ contextKey: string; requestId: number } | null>(null)
  const contextKey = getGameStatusContextKey(userId, gameId)
  const activeContextKeyRef = useRef(contextKey)

  useEffect(() => {
    activeContextKeyRef.current = contextKey
    const requestId = loadRequestIdRef.current + 1
    loadRequestIdRef.current = requestId
    pendingMutationRef.current = null

    const loadStatus = async () => {
      setGameStatusSaving(false)
      setPendingGameStatus(null)
      setGameStatusFeedback(null)

      if (!userId || !gameId || !contextKey) {
        setGameStatusLoading(false)
        setGameStatusEntry(null)
        return
      }

      setGameStatusLoading(true)
      setGameStatusEntry(null)

      const { data, error } = await getGameStatusEntry(userId, gameId)

      if (
        loadRequestIdRef.current !== requestId ||
        activeContextKeyRef.current !== contextKey
      ) {
        return
      }

      if (error) {
        console.error('Erro ao verificar status do jogo no perfil:', error)
        setGameStatusEntry(null)
        setGameStatusFeedback({
          tone: 'error',
          message: 'Nao foi possivel verificar o status deste jogo no seu perfil agora.',
        })
      } else {
        setGameStatusEntry(data)
      }

      setGameStatusLoading(false)
    }

    void loadStatus()

    return () => {
      if (loadRequestIdRef.current === requestId) {
        loadRequestIdRef.current += 1
      }
      if (activeContextKeyRef.current === contextKey) {
        activeContextKeyRef.current = null
      }
    }
  }, [contextKey, gameId, userId])

  const saveStatus = useCallback(
    async (nextStatus: GameStatusValue) => {
      if (
        !userId ||
        !gameId ||
        !contextKey ||
        gameStatusLoading ||
        gameStatusSaving ||
        pendingMutationRef.current?.contextKey === contextKey
      ) {
        return
      }

      const requestId = mutationRequestIdRef.current + 1
      mutationRequestIdRef.current = requestId
      pendingMutationRef.current = { contextKey, requestId }
      setGameStatusSaving(true)
      setPendingGameStatus(nextStatus)
      setGameStatusFeedback(null)

      const isCurrentMutation = () =>
        activeContextKeyRef.current === contextKey &&
        pendingMutationRef.current?.contextKey === contextKey &&
        pendingMutationRef.current.requestId === requestId

      try {
        const isRemovingCurrentStatus =
          gameStatusEntry?.status === nextStatus && Boolean(gameStatusEntry.id)

        if (isRemovingCurrentStatus && gameStatusEntry?.id) {
          const { error } = await deleteGameStatus({
            userId,
            statusId: gameStatusEntry.id,
          })

          if (!isCurrentMutation()) return

          if (error) {
            console.error('Erro ao remover status do jogo pelo detalhe:', error)
            setGameStatusFeedback({
              tone: 'error',
              message: getGameStatusErrorMessage(error, 'delete'),
            })
          } else {
            setGameStatusEntry(null)
            setGameStatusFeedback({
              tone: 'info',
              message: t('game.details.removeStatusSuccess'),
            })
          }
        } else {
          const { data, error } = await saveGameStatus({
            userId,
            gameId,
            status: nextStatus,
            favorito: gameStatusEntry?.favorito || false,
          })

          if (!isCurrentMutation()) return

          if (error) {
            console.error('Erro ao salvar status do jogo pelo detalhe:', error)
            setGameStatusFeedback({
              tone: 'error',
              message: getGameStatusErrorMessage(error, 'save'),
            })
          } else {
            setGameStatusEntry(data)
            setGameStatusFeedback({
              tone: 'success',
              message: gameStatusEntry
                ? t('game.details.statusUpdated')
                : t('game.details.statusAdded'),
            })
          }
        }
      } finally {
        if (isCurrentMutation()) {
          pendingMutationRef.current = null
          setGameStatusSaving(false)
          setPendingGameStatus(null)
        }
      }
    },
    [contextKey, gameId, gameStatusEntry, gameStatusLoading, gameStatusSaving, t, userId]
  )

  return {
    gameStatusLoading,
    gameStatusSaving,
    pendingGameStatus,
    gameStatusEntry,
    gameStatusFeedback,
    saveStatus,
  }
}
