import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { FormEvent } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CommunityError,
  CommunitySummary,
  ServiceResult,
} from '../../../services/communityService'

const mocks = vi.hoisted(() => ({
  deleteFile: vi.fn(),
  updateCommunity: vi.fn(),
  updateCommunityModeratedDetails: vi.fn(),
  uploadCommunityBannerImage: vi.fn(),
  createObjectURL: vi.fn(),
  revokeObjectURL: vi.fn(),
}))

vi.mock('../../../services/communityService', () => ({
  COMMUNITY_CATEGORY_VALUES: ['acao', 'aventura', 'rpg'],
  updateCommunity: mocks.updateCommunity,
  updateCommunityModeratedDetails: mocks.updateCommunityModeratedDetails,
}))

vi.mock('../../../services/storageService', () => ({
  deleteFile: mocks.deleteFile,
  uploadCommunityBannerImage: mocks.uploadCommunityBannerImage,
}))

import {
  useCommunitySettingsController,
  type UseCommunitySettingsControllerOptions,
} from './useCommunitySettingsController'

const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')

function restoreUrlMethod(
  method: 'createObjectURL' | 'revokeObjectURL',
  descriptor: PropertyDescriptor | undefined
) {
  if (descriptor) {
    Object.defineProperty(URL, method, descriptor)
    return
  }

  Reflect.deleteProperty(URL, method)
}

function createCommunity(
  id = 'community-a',
  overrides: Partial<CommunitySummary> = {}
): CommunitySummary {
  return {
    id,
    nome: `Community ${id}`,
    descricao: 'Description',
    banner_path: 'owner/communities/old-banner.png',
    tipo: 'General',
    jogo_id: 7,
    categoria: 'aventura',
    regras: 'Rules',
    permissao_postagem: 'todos_membros',
    visibilidade: 'publica',
    lider_id: 'leader-a',
    membros_count: 2,
    posts_count: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    jogo: null,
    lider: null,
    currentUserRole: 'lider',
    currentUserJoinRequestStatus: null,
    canPost: true,
    canViewContent: true,
    ...overrides,
  }
}

function createResult(
  data: CommunitySummary | null,
  error: CommunityError | null = null
): ServiceResult<CommunitySummary | null> {
  return { data, error }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

function createSubmitEvent() {
  return {
    preventDefault: vi.fn(),
  } as unknown as FormEvent<HTMLFormElement>
}

function createBannerFile(name = 'banner.png') {
  return new File(['banner'], name, { type: 'image/png' })
}

function createOptions(
  overrides: Partial<UseCommunitySettingsControllerOptions> = {}
): UseCommunitySettingsControllerOptions {
  return {
    community: createCommunity(),
    currentUserId: 'viewer-a',
    isLeader: true,
    isModerator: true,
    reloadCommunity: vi.fn().mockResolvedValue(undefined),
    publishFeedback: vi.fn(),
    t: (key: string) => key,
    ...overrides,
  }
}

function renderController(initialOptions = createOptions()) {
  return renderHook(
    (options: UseCommunitySettingsControllerOptions) => (
      useCommunitySettingsController(options)
    ),
    { initialProps: initialOptions }
  )
}

beforeAll(() => {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: mocks.createObjectURL,
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: mocks.revokeObjectURL,
  })
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createObjectURL.mockImplementation((file: File) => `blob:${file.name}`)
  mocks.deleteFile.mockResolvedValue(true)
  mocks.updateCommunity.mockResolvedValue(createResult(createCommunity()))
  mocks.updateCommunityModeratedDetails.mockResolvedValue(createResult(createCommunity()))
  mocks.uploadCommunityBannerImage.mockResolvedValue({
    path: 'viewer-a/communities/new-banner.png',
    publicUrl: 'https://example.test/new-banner.png',
    url: 'https://example.test/new-banner.png',
  })
})

afterEach(() => {
  cleanup()
})

afterAll(() => {
  restoreUrlMethod('createObjectURL', originalCreateObjectURL)
  restoreUrlMethod('revokeObjectURL', originalRevokeObjectURL)
})

describe('useCommunitySettingsController', () => {
  it('inicializa, atualiza e reseta o draft quando o resumo muda', async () => {
    const options = createOptions()
    const { result, rerender } = renderController(options)

    expect(result.current.form.draft).toEqual({
      nome: 'Community community-a',
      descricao: 'Description',
      tipo: 'General',
      categoria: 'aventura',
      regras: 'Rules',
      visibilidade: 'publica',
    })

    act(() => result.current.form.update('nome', 'Edited name'))
    expect(result.current.form.draft.nome).toBe('Edited name')

    rerender({
      ...options,
      community: createCommunity('community-a', {
        nome: 'Reloaded name',
        categoria: 'legacy-category',
        visibilidade: 'privada',
      }),
    })

    await waitFor(() => expect(result.current.form.draft.nome).toBe('Reloaded name'))
    expect(result.current.form.draft.categoria).toBe('')
    expect(result.current.form.draft.visibilidade).toBe('privada')
  })

  it('revoga previews ao substituir, remover, trocar escopo e desmontar', async () => {
    const options = createOptions()
    const { result, rerender, unmount } = renderController(options)
    const firstFile = createBannerFile('first.png')
    const secondFile = createBannerFile('second.png')
    const thirdFile = createBannerFile('third.png')
    const fourthFile = createBannerFile('fourth.png')

    act(() => result.current.banner.select(firstFile))
    expect(result.current.banner.previewUrl).toBe('blob:first.png')

    act(() => result.current.banner.select(secondFile))
    expect(mocks.revokeObjectURL).toHaveBeenCalledWith('blob:first.png')

    act(() => result.current.banner.select(null))
    expect(mocks.revokeObjectURL).toHaveBeenCalledWith('blob:second.png')
    expect(result.current.banner.file).toBeNull()

    act(() => result.current.banner.select(thirdFile))
    rerender({
      ...options,
      community: createCommunity('community-b'),
    })

    await waitFor(() => expect(result.current.banner.file).toBeNull())
    expect(mocks.revokeObjectURL).toHaveBeenCalledWith('blob:third.png')

    act(() => result.current.banner.select(fourthFile))
    unmount()
    expect(mocks.revokeObjectURL).toHaveBeenCalledWith('blob:fourth.png')
  })

  it('persiste todos os campos do lider e apaga o banner antigo somente depois', async () => {
    const publishFeedback = vi.fn()
    const reloadCommunity = vi.fn().mockResolvedValue(undefined)
    const options = createOptions({ publishFeedback, reloadCommunity })
    const { result } = renderController(options)
    const bannerFile = createBannerFile()

    act(() => {
      result.current.form.update('nome', 'Updated community')
      result.current.form.update('descricao', 'Updated description')
      result.current.form.update('categoria', 'rpg')
      result.current.form.update('visibilidade', 'privada')
      result.current.banner.select(bannerFile)
    })

    await act(async () => result.current.form.submit(createSubmitEvent()))

    expect(mocks.updateCommunity).toHaveBeenCalledWith({
      comunidadeId: 'community-a',
      nome: 'Updated community',
      descricao: 'Updated description',
      tipo: 'General',
      categoria: 'rpg',
      regras: 'Rules',
      bannerPath: 'viewer-a/communities/new-banner.png',
      jogoId: 7,
      permissaoPostagem: 'todos_membros',
      visibilidade: 'privada',
    })
    expect(mocks.updateCommunityModeratedDetails).not.toHaveBeenCalled()
    expect(mocks.deleteFile).toHaveBeenCalledWith('owner/communities/old-banner.png')
    expect(mocks.updateCommunity.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteFile.mock.invocationCallOrder[0]
    )
    expect(reloadCommunity).toHaveBeenCalledTimes(1)
    expect(publishFeedback).toHaveBeenNthCalledWith(1, null)
    expect(publishFeedback).toHaveBeenLastCalledWith({
      tone: 'success',
      message: 'communities.settings.saved',
    })
    expect(result.current.banner.file).toBeNull()
    expect(result.current.form.saving).toBe(false)
  })

  it('limita o admin aos campos moderaveis', async () => {
    const adminCommunity = createCommunity('community-a', { currentUserRole: 'admin' })
    const options = createOptions({
      community: adminCommunity,
      isLeader: false,
      isModerator: true,
    })
    const { result } = renderController(options)

    act(() => {
      result.current.form.update('nome', 'Must not be sent')
      result.current.form.update('descricao', 'Moderator description')
      result.current.form.update('regras', 'Moderator rules')
    })

    await act(async () => result.current.form.submit(createSubmitEvent()))

    expect(mocks.updateCommunity).not.toHaveBeenCalled()
    expect(mocks.updateCommunityModeratedDetails).toHaveBeenCalledWith({
      comunidadeId: 'community-a',
      currentUserId: 'viewer-a',
      descricao: 'Moderator description',
      regras: 'Moderator rules',
      bannerPath: 'owner/communities/old-banner.png',
    })
  })

  it('bloqueia submissao duplicada antes da primeira renderizacao de saving', async () => {
    const updateRequest = createDeferred<ServiceResult<CommunitySummary | null>>()
    mocks.updateCommunity.mockReturnValueOnce(updateRequest.promise)
    const { result } = renderController()
    const firstEvent = createSubmitEvent()
    const secondEvent = createSubmitEvent()
    let firstSubmission!: Promise<void>
    let secondSubmission!: Promise<void>

    act(() => {
      firstSubmission = result.current.form.submit(firstEvent)
      secondSubmission = result.current.form.submit(secondEvent)
    })

    expect(mocks.updateCommunity).toHaveBeenCalledTimes(1)
    expect(result.current.form.saving).toBe(true)

    await act(async () => {
      updateRequest.resolve(createResult(createCommunity()))
      await Promise.all([firstSubmission, secondSubmission])
    })

    expect(firstEvent.preventDefault).toHaveBeenCalledTimes(1)
    expect(secondEvent.preventDefault).toHaveBeenCalledTimes(1)
    expect(result.current.form.saving).toBe(false)
  })

  it('interrompe o save quando o upload falha', async () => {
    mocks.uploadCommunityBannerImage.mockResolvedValueOnce(null)
    const publishFeedback = vi.fn()
    const { result } = renderController(createOptions({ publishFeedback }))

    act(() => result.current.banner.select(createBannerFile()))
    await act(async () => result.current.form.submit(createSubmitEvent()))

    expect(mocks.updateCommunity).not.toHaveBeenCalled()
    expect(mocks.updateCommunityModeratedDetails).not.toHaveBeenCalled()
    expect(mocks.deleteFile).not.toHaveBeenCalled()
    expect(publishFeedback).toHaveBeenLastCalledWith({
      tone: 'error',
      message: 'communities.settings.bannerUploadError',
    })
    expect(result.current.banner.file).not.toBeNull()
    expect(result.current.form.saving).toBe(false)
  })

  it('aguarda a limpeza do upload novo quando a RPC falha', async () => {
    const cleanupRequest = createDeferred<boolean>()
    const serviceError = { code: 'TEST', message: 'save failed' }
    const publishFeedback = vi.fn()
    mocks.updateCommunity.mockResolvedValueOnce(createResult(null, serviceError))
    mocks.deleteFile.mockReturnValueOnce(cleanupRequest.promise)
    const { result } = renderController(createOptions({ publishFeedback }))
    let submission!: Promise<void>

    act(() => result.current.banner.select(createBannerFile()))
    act(() => {
      submission = result.current.form.submit(createSubmitEvent())
    })

    await waitFor(() => {
      expect(mocks.deleteFile).toHaveBeenCalledWith('viewer-a/communities/new-banner.png')
    })
    expect(result.current.form.saving).toBe(true)
    expect(publishFeedback).toHaveBeenCalledTimes(1)

    await act(async () => {
      cleanupRequest.resolve(false)
      await submission
    })

    expect(mocks.deleteFile).not.toHaveBeenCalledWith('owner/communities/old-banner.png')
    expect(publishFeedback).toHaveBeenLastCalledWith({
      tone: 'error',
      message: 'save failed',
    })
    expect(result.current.form.saving).toBe(false)
  })

  it('nao mascara o sucesso quando a limpeza do banner antigo falha', async () => {
    const publishFeedback = vi.fn()
    const reloadCommunity = vi.fn().mockResolvedValue(undefined)
    mocks.deleteFile.mockRejectedValueOnce(new Error('cleanup failed'))
    const { result } = renderController(createOptions({ publishFeedback, reloadCommunity }))

    act(() => result.current.banner.select(createBannerFile()))
    await act(async () => result.current.form.submit(createSubmitEvent()))

    expect(publishFeedback).toHaveBeenLastCalledWith({
      tone: 'success',
      message: 'communities.settings.saved',
    })
    expect(reloadCommunity).toHaveBeenCalledTimes(1)
    expect(result.current.form.saving).toBe(false)
  })

  it('limpa o upload concluido depois de uma troca de escopo sem aplicar efeitos obsoletos', async () => {
    const uploadRequest = createDeferred<{
      path: string
      publicUrl: string
      url: string
    }>()
    const publishFeedback = vi.fn()
    const reloadCommunity = vi.fn().mockResolvedValue(undefined)
    mocks.uploadCommunityBannerImage.mockReturnValueOnce(uploadRequest.promise)
    const initialOptions = createOptions({ publishFeedback, reloadCommunity })
    const { result, rerender } = renderController(initialOptions)
    let submission!: Promise<void>

    act(() => result.current.banner.select(createBannerFile()))
    act(() => {
      submission = result.current.form.submit(createSubmitEvent())
    })

    rerender({
      ...initialOptions,
      community: createCommunity('community-b'),
    })
    await waitFor(() => expect(result.current.form.saving).toBe(false))
    publishFeedback.mockClear()

    await act(async () => {
      uploadRequest.resolve({
        path: 'viewer-a/communities/stale-banner.png',
        publicUrl: '',
        url: '',
      })
      await submission
    })

    expect(mocks.deleteFile).toHaveBeenCalledWith('viewer-a/communities/stale-banner.png')
    expect(mocks.updateCommunity).not.toHaveBeenCalled()
    expect(mocks.updateCommunityModeratedDetails).not.toHaveBeenCalled()
    expect(reloadCommunity).not.toHaveBeenCalled()
    expect(publishFeedback).not.toHaveBeenCalled()
    expect(result.current.form.draft.nome).toBe('Community community-b')
  })
})
