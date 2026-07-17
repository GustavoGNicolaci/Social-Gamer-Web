import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WishlistEntry } from '../../../services/wishlistService'

const serviceMocks = vi.hoisted(() => ({
  addGameToWishlist: vi.fn(),
  deleteWishlistEntry: vi.fn(),
  getWishlistEntry: vi.fn(),
}))

vi.mock('../../../services/wishlistService', () => ({
  addGameToWishlist: serviceMocks.addGameToWishlist,
  deleteWishlistEntry: serviceMocks.deleteWishlistEntry,
  getWishlistEntry: serviceMocks.getWishlistEntry,
}))

import { useGameWishlistAction } from './useGameWishlistAction'

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

function createWishlistEntry(id: string, gameId: number): WishlistEntry {
  return {
    id,
    usuario_id: 'user-1',
    jogo_id: gameId,
    adicionado_em: '2026-01-01T00:00:00.000Z',
    prioridade: null,
  }
}

const t = (key: string) => `translated:${key}`

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  serviceMocks.getWishlistEntry.mockResolvedValue({ data: null, error: null })
  serviceMocks.deleteWishlistEntry.mockResolvedValue({ data: null, error: null })
  serviceMocks.addGameToWishlist.mockResolvedValue({
    status: 'added',
    data: createWishlistEntry('wishlist-new', 1),
    error: null,
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useGameWishlistAction', () => {
  it('carrega uma wishlist vazia e adiciona o jogo', async () => {
    const { result } = renderHook(() =>
      useGameWishlistAction({ userId: 'user-1', gameId: 1, t })
    )

    await waitFor(() => {
      expect(serviceMocks.getWishlistEntry).toHaveBeenCalledWith('user-1', 1)
      expect(result.current.wishlistLoading).toBe(false)
    })

    await act(async () => {
      await result.current.toggleWishlist()
    })

    expect(serviceMocks.addGameToWishlist).toHaveBeenCalledWith({
      userId: 'user-1',
      gameId: 1,
    })
    expect(result.current.isInWishlist).toBe(true)
    expect(result.current.wishlistEntryId).toBe('wishlist-new')
    expect(result.current.wishlistFeedback).toEqual({
      tone: 'success',
      message: 'translated:game.details.wishlistSaved',
    })
    expect(result.current.wishlistSaving).toBe(false)
  })

  it('trata o retorno duplicado como item salvo sem criar uma segunda entrada', async () => {
    serviceMocks.addGameToWishlist.mockResolvedValue({
      status: 'duplicate',
      data: createWishlistEntry('wishlist-existing', 1),
      error: null,
    })
    const { result } = renderHook(() =>
      useGameWishlistAction({ userId: 'user-1', gameId: 1, t })
    )

    await waitFor(() => {
      expect(serviceMocks.getWishlistEntry).toHaveBeenCalledTimes(1)
      expect(result.current.wishlistLoading).toBe(false)
    })
    await act(async () => {
      await result.current.toggleWishlist()
    })

    expect(result.current.isInWishlist).toBe(true)
    expect(result.current.wishlistEntryId).toBe('wishlist-existing')
    expect(result.current.wishlistFeedback).toEqual({
      tone: 'info',
      message: 'translated:game.details.wishlistSaved',
    })
  })

  it('remove uma entrada existente', async () => {
    serviceMocks.getWishlistEntry.mockResolvedValue({
      data: createWishlistEntry('wishlist-1', 1),
      error: null,
    })
    const { result } = renderHook(() =>
      useGameWishlistAction({ userId: 'user-1', gameId: 1, t })
    )

    await waitFor(() => expect(result.current.wishlistEntryId).toBe('wishlist-1'))
    await act(async () => {
      await result.current.toggleWishlist()
    })

    expect(serviceMocks.deleteWishlistEntry).toHaveBeenCalledWith({
      userId: 'user-1',
      wishlistEntryId: 'wishlist-1',
    })
    expect(result.current.isInWishlist).toBe(false)
    expect(result.current.wishlistEntryId).toBeNull()
    expect(result.current.wishlistFeedback).toEqual({
      tone: 'info',
      message: 'translated:game.details.wishlistRemoved',
    })
  })

  it('mantem o estado coerente quando carregamento, adicao ou remocao falham', async () => {
    serviceMocks.getWishlistEntry.mockResolvedValueOnce({
      data: null,
      error: { message: 'load failed' },
    })
    const firstRender = renderHook(() =>
      useGameWishlistAction({ userId: 'user-1', gameId: 1, t })
    )

    await waitFor(() =>
      expect(firstRender.result.current.wishlistFeedback?.message).toBe(
        'Nao foi possivel verificar sua lista de desejos agora.'
      )
    )
    firstRender.unmount()

    serviceMocks.getWishlistEntry.mockResolvedValueOnce({ data: null, error: null })
    serviceMocks.addGameToWishlist.mockResolvedValueOnce({
      status: 'error',
      data: null,
      error: { message: 'save failed' },
    })
    const secondRender = renderHook(() =>
      useGameWishlistAction({ userId: 'user-1', gameId: 2, t })
    )

    await waitFor(() => {
      expect(serviceMocks.getWishlistEntry).toHaveBeenCalledWith('user-1', 2)
      expect(secondRender.result.current.wishlistLoading).toBe(false)
    })
    await act(async () => {
      await secondRender.result.current.toggleWishlist()
    })
    expect(secondRender.result.current.isInWishlist).toBe(false)
    expect(secondRender.result.current.wishlistFeedback?.tone).toBe('error')
    secondRender.unmount()

    serviceMocks.getWishlistEntry.mockResolvedValueOnce({
      data: createWishlistEntry('wishlist-3', 3),
      error: null,
    })
    serviceMocks.deleteWishlistEntry.mockResolvedValueOnce({
      data: null,
      error: { message: 'delete failed' },
    })
    const thirdRender = renderHook(() =>
      useGameWishlistAction({ userId: 'user-1', gameId: 3, t })
    )

    await waitFor(() => expect(thirdRender.result.current.wishlistEntryId).toBe('wishlist-3'))
    await act(async () => {
      await thirdRender.result.current.toggleWishlist()
    })
    expect(thirdRender.result.current.isInWishlist).toBe(true)
    expect(thirdRender.result.current.wishlistEntryId).toBe('wishlist-3')
    expect(thirdRender.result.current.wishlistFeedback?.tone).toBe('error')
  })

  it('ignora uma leitura concluida para o jogo anterior', async () => {
    const firstLoad = createDeferred<{
      data: WishlistEntry | null
      error: null
    }>()
    serviceMocks.getWishlistEntry.mockImplementation((_: string, gameId: number) =>
      gameId === 1
        ? firstLoad.promise
        : Promise.resolve({ data: createWishlistEntry('wishlist-2', gameId), error: null })
    )
    const { result, rerender } = renderHook(
      ({ gameId }) => useGameWishlistAction({ userId: 'user-1', gameId, t }),
      { initialProps: { gameId: 1 } }
    )

    await waitFor(() => expect(serviceMocks.getWishlistEntry).toHaveBeenCalledWith('user-1', 1))
    rerender({ gameId: 2 })
    await waitFor(() => expect(result.current.wishlistEntryId).toBe('wishlist-2'))

    await act(async () => {
      firstLoad.resolve({ data: createWishlistEntry('wishlist-1', 1), error: null })
      await firstLoad.promise
    })

    expect(result.current.wishlistEntryId).toBe('wishlist-2')
  })

  it('bloqueia mutacoes concorrentes e descarta a conclusao pertencente ao jogo anterior', async () => {
    const pendingAdd = createDeferred<{
      status: 'added'
      data: WishlistEntry
      error: null
    }>()
    serviceMocks.getWishlistEntry.mockImplementation((_: string, gameId: number) =>
      Promise.resolve({
        data: gameId === 2 ? createWishlistEntry('wishlist-2', 2) : null,
        error: null,
      })
    )
    serviceMocks.addGameToWishlist.mockReturnValue(pendingAdd.promise)
    const { result, rerender } = renderHook(
      ({ gameId }) => useGameWishlistAction({ userId: 'user-1', gameId, t }),
      { initialProps: { gameId: 1 } }
    )

    await waitFor(() => {
      expect(serviceMocks.getWishlistEntry).toHaveBeenCalledWith('user-1', 1)
      expect(result.current.wishlistLoading).toBe(false)
    })

    let firstMutation!: Promise<void>
    let secondMutation!: Promise<void>
    act(() => {
      firstMutation = result.current.toggleWishlist()
      secondMutation = result.current.toggleWishlist()
    })
    expect(serviceMocks.addGameToWishlist).toHaveBeenCalledTimes(1)

    rerender({ gameId: 2 })
    await waitFor(() => expect(result.current.wishlistEntryId).toBe('wishlist-2'))

    await act(async () => {
      pendingAdd.resolve({
        status: 'added',
        data: createWishlistEntry('wishlist-1', 1),
        error: null,
      })
      await Promise.all([firstMutation, secondMutation])
    })

    expect(result.current.wishlistEntryId).toBe('wishlist-2')
    expect(result.current.wishlistFeedback).toBeNull()
    expect(result.current.wishlistSaving).toBe(false)
  })
})
