import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  GameStatusEntry,
  GameStatusValue,
} from '../../../services/gameStatusService'

const serviceMocks = vi.hoisted(() => ({
  deleteGameStatus: vi.fn(),
  getGameStatusEntry: vi.fn(),
  saveGameStatus: vi.fn(),
}))

vi.mock('../../../services/gameStatusService', () => ({
  deleteGameStatus: serviceMocks.deleteGameStatus,
  getGameStatusEntry: serviceMocks.getGameStatusEntry,
  saveGameStatus: serviceMocks.saveGameStatus,
}))

import { useGameStatusAction } from './useGameStatusAction'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise!: (value: T) => void
  const promise = new Promise<T>(resolve => {
    resolvePromise = resolve
  })

  return { promise, resolve: resolvePromise }
}

function createStatusEntry(
  id: string,
  gameId: number,
  status: GameStatusValue,
  favorito = false
): GameStatusEntry {
  return {
    id,
    usuario_id: 'user-1',
    jogo_id: gameId,
    status,
    created_at: '2026-01-01T00:00:00.000Z',
    favorito,
  }
}

const t = (key: string) => `translated:${key}`

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  serviceMocks.getGameStatusEntry.mockResolvedValue({ data: null, error: null })
  serviceMocks.deleteGameStatus.mockResolvedValue({ data: null, error: null })
  serviceMocks.saveGameStatus.mockResolvedValue({
    data: createStatusEntry('status-new', 1, 'jogando'),
    error: null,
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useGameStatusAction', () => {
  it('cria um status novo sem marcar favorito', async () => {
    const createdEntry = createStatusEntry('status-new', 1, 'jogando')
    serviceMocks.saveGameStatus.mockResolvedValue({ data: createdEntry, error: null })
    const { result } = renderHook(() =>
      useGameStatusAction({ userId: 'user-1', gameId: 1, t })
    )

    await waitFor(() => {
      expect(serviceMocks.getGameStatusEntry).toHaveBeenCalledWith('user-1', 1)
      expect(result.current.gameStatusLoading).toBe(false)
    })
    await act(async () => {
      await result.current.saveStatus('jogando')
    })

    expect(serviceMocks.saveGameStatus).toHaveBeenCalledWith({
      userId: 'user-1',
      gameId: 1,
      status: 'jogando',
      favorito: false,
    })
    expect(result.current.gameStatusEntry).toEqual(createdEntry)
    expect(result.current.gameStatusFeedback).toEqual({
      tone: 'success',
      message: 'translated:game.details.statusAdded',
    })
    expect(result.current.pendingGameStatus).toBeNull()
  })

  it('atualiza o status preservando favorito', async () => {
    const currentEntry = createStatusEntry('status-1', 1, 'jogando', true)
    const updatedEntry = createStatusEntry('status-1', 1, 'zerado', true)
    serviceMocks.getGameStatusEntry.mockResolvedValue({ data: currentEntry, error: null })
    serviceMocks.saveGameStatus.mockResolvedValue({ data: updatedEntry, error: null })
    const { result } = renderHook(() =>
      useGameStatusAction({ userId: 'user-1', gameId: 1, t })
    )

    await waitFor(() => expect(result.current.gameStatusEntry).toEqual(currentEntry))
    await act(async () => {
      await result.current.saveStatus('zerado')
    })

    expect(serviceMocks.saveGameStatus).toHaveBeenCalledWith({
      userId: 'user-1',
      gameId: 1,
      status: 'zerado',
      favorito: true,
    })
    expect(result.current.gameStatusEntry).toEqual(updatedEntry)
    expect(result.current.gameStatusFeedback?.message).toBe(
      'translated:game.details.statusUpdated'
    )
  })

  it('remove o status ao clicar no status atual', async () => {
    const currentEntry = createStatusEntry('status-1', 1, 'jogando', true)
    serviceMocks.getGameStatusEntry.mockResolvedValue({ data: currentEntry, error: null })
    const { result } = renderHook(() =>
      useGameStatusAction({ userId: 'user-1', gameId: 1, t })
    )

    await waitFor(() => expect(result.current.gameStatusEntry).toEqual(currentEntry))
    await act(async () => {
      await result.current.saveStatus('jogando')
    })

    expect(serviceMocks.deleteGameStatus).toHaveBeenCalledWith({
      userId: 'user-1',
      statusId: 'status-1',
    })
    expect(serviceMocks.saveGameStatus).not.toHaveBeenCalled()
    expect(result.current.gameStatusEntry).toBeNull()
    expect(result.current.gameStatusFeedback).toEqual({
      tone: 'info',
      message: 'translated:game.details.removeStatusSuccess',
    })
  })

  it('mantem o estado coerente quando carregamento, salvamento ou remocao falham', async () => {
    serviceMocks.getGameStatusEntry.mockResolvedValueOnce({
      data: null,
      error: { message: 'load failed' },
    })
    const firstRender = renderHook(() =>
      useGameStatusAction({ userId: 'user-1', gameId: 1, t })
    )

    await waitFor(() =>
      expect(firstRender.result.current.gameStatusFeedback?.message).toBe(
        'Nao foi possivel verificar o status deste jogo no seu perfil agora.'
      )
    )
    firstRender.unmount()

    serviceMocks.getGameStatusEntry.mockResolvedValueOnce({ data: null, error: null })
    serviceMocks.saveGameStatus.mockResolvedValueOnce({
      data: null,
      error: { message: 'save failed' },
    })
    const secondRender = renderHook(() =>
      useGameStatusAction({ userId: 'user-1', gameId: 2, t })
    )

    await waitFor(() => {
      expect(serviceMocks.getGameStatusEntry).toHaveBeenCalledWith('user-1', 2)
      expect(secondRender.result.current.gameStatusLoading).toBe(false)
    })
    await act(async () => {
      await secondRender.result.current.saveStatus('jogando')
    })
    expect(secondRender.result.current.gameStatusEntry).toBeNull()
    expect(secondRender.result.current.gameStatusFeedback?.tone).toBe('error')
    secondRender.unmount()

    const currentEntry = createStatusEntry('status-3', 3, 'zerado', true)
    serviceMocks.getGameStatusEntry.mockResolvedValueOnce({ data: currentEntry, error: null })
    serviceMocks.deleteGameStatus.mockResolvedValueOnce({
      data: null,
      error: { message: 'delete failed' },
    })
    const thirdRender = renderHook(() =>
      useGameStatusAction({ userId: 'user-1', gameId: 3, t })
    )

    await waitFor(() => expect(thirdRender.result.current.gameStatusEntry).toEqual(currentEntry))
    await act(async () => {
      await thirdRender.result.current.saveStatus('zerado')
    })
    expect(thirdRender.result.current.gameStatusEntry).toEqual(currentEntry)
    expect(thirdRender.result.current.gameStatusFeedback?.tone).toBe('error')
  })

  it('ignora uma leitura concluida para o jogo anterior', async () => {
    const firstLoad = createDeferred<{
      data: GameStatusEntry | null
      error: null
    }>()
    const secondEntry = createStatusEntry('status-2', 2, 'zerado')
    serviceMocks.getGameStatusEntry.mockImplementation((_: string, gameId: number) =>
      gameId === 1
        ? firstLoad.promise
        : Promise.resolve({ data: secondEntry, error: null })
    )
    const { result, rerender } = renderHook(
      ({ gameId }) => useGameStatusAction({ userId: 'user-1', gameId, t }),
      { initialProps: { gameId: 1 } }
    )

    await waitFor(() => expect(serviceMocks.getGameStatusEntry).toHaveBeenCalledWith('user-1', 1))
    rerender({ gameId: 2 })
    await waitFor(() => expect(result.current.gameStatusEntry).toEqual(secondEntry))

    await act(async () => {
      firstLoad.resolve({
        data: createStatusEntry('status-1', 1, 'jogando'),
        error: null,
      })
      await firstLoad.promise
    })

    expect(result.current.gameStatusEntry).toEqual(secondEntry)
  })

  it('bloqueia mutacoes concorrentes e descarta a conclusao pertencente ao jogo anterior', async () => {
    const pendingSave = createDeferred<{
      data: GameStatusEntry
      error: null
    }>()
    const secondEntry = createStatusEntry('status-2', 2, 'planejando', true)
    serviceMocks.getGameStatusEntry.mockImplementation((_: string, gameId: number) =>
      Promise.resolve({ data: gameId === 2 ? secondEntry : null, error: null })
    )
    serviceMocks.saveGameStatus.mockReturnValue(pendingSave.promise)
    const { result, rerender } = renderHook(
      ({ gameId }) => useGameStatusAction({ userId: 'user-1', gameId, t }),
      { initialProps: { gameId: 1 } }
    )

    await waitFor(() => {
      expect(serviceMocks.getGameStatusEntry).toHaveBeenCalledWith('user-1', 1)
      expect(result.current.gameStatusLoading).toBe(false)
    })

    let firstMutation!: Promise<void>
    let secondMutation!: Promise<void>
    act(() => {
      firstMutation = result.current.saveStatus('jogando')
      secondMutation = result.current.saveStatus('zerado')
    })
    expect(serviceMocks.saveGameStatus).toHaveBeenCalledTimes(1)

    rerender({ gameId: 2 })
    await waitFor(() => expect(result.current.gameStatusEntry).toEqual(secondEntry))

    await act(async () => {
      pendingSave.resolve({
        data: createStatusEntry('status-1', 1, 'jogando'),
        error: null,
      })
      await Promise.all([firstMutation, secondMutation])
    })

    expect(result.current.gameStatusEntry).toEqual(secondEntry)
    expect(result.current.gameStatusFeedback).toBeNull()
    expect(result.current.gameStatusSaving).toBe(false)
    expect(result.current.pendingGameStatus).toBeNull()
  })
})
