import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CommunityJoinRequest,
  CommunityMember,
  CommunityPost,
  CommunityPostComment,
  CommunitySummary,
} from '../services/communityService'
import CommunityDetailsPage from './CommunityDetailsPage'

const serviceMocks = vi.hoisted(() => ({
  approveCommunityJoinRequest: vi.fn(),
  getCommunityById: vi.fn(),
  getCommunityJoinRequests: vi.fn(),
  getCommunityMembers: vi.fn(),
  getCommunityPosts: vi.fn(),
  getCommunityReports: vi.fn(),
  getCommunityCommentAnchor: vi.fn(),
  getCommunityCommentTarget: vi.fn(),
  getCommunityPostById: vi.fn(),
  getCommunityPostCommentsPage: vi.fn(),
}))

const authMocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
}))

const i18nMocks = vi.hoisted(() => ({
  t: vi.fn((key: string) => key),
  formatDate: vi.fn((value: string) => value),
  formatNumber: vi.fn((value: number) => String(value)),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: authMocks.user }),
}))

vi.mock('../i18n/I18nContext', () => ({
  useI18n: () => ({
    t: i18nMocks.t,
    formatDate: i18nMocks.formatDate,
    formatNumber: i18nMocks.formatNumber,
  }),
}))

vi.mock('../components/communities/CommunityAboutCard', () => ({
  CommunityAboutCard: ({ community }: { community: CommunitySummary }) => (
    <section data-testid="community-about">{community.nome}</section>
  ),
}))

vi.mock('../components/communities/CommunityConfirmModal', () => ({
  CommunityConfirmModal: () => <div data-testid="community-confirm-modal" />,
}))

vi.mock('../components/communities/CommunityFilePicker', () => ({
  CommunityFilePicker: () => <div data-testid="community-file-picker" />,
}))

vi.mock('../components/communities/CommunityPostCard', () => ({
  CommunityPostCard: ({
    activeAnchorId,
    post,
    onLoadMoreComments,
  }: {
    activeAnchorId: string
    post: CommunityPost
    onLoadMoreComments: (post: CommunityPost) => Promise<boolean>
  }) => (
    <article
      data-testid="community-post-card"
      data-active-anchor={activeAnchorId}
      data-post-id={post.id}
      data-comment-ids={post.comentarios?.map(comment => comment.id).join(',') || ''}
      data-comments-next-offset={String(post.commentsNextOffset ?? '')}
    >
      <button type="button" onClick={() => void onLoadMoreComments(post)}>
        load-more-comments
      </button>
    </article>
  ),
}))

vi.mock('../components/communities/CommunityReportModal', () => ({
  CommunityReportModal: () => <div data-testid="community-report-modal" />,
}))

vi.mock('../components/UserAvatar', () => ({
  UserAvatar: () => <div data-testid="user-avatar" />,
}))

vi.mock('../services/storageService', () => ({
  deleteFile: vi.fn(),
  resolvePublicFileUrl: () => null,
  uploadCommunityBannerImage: vi.fn(),
  uploadCommunityPostImage: vi.fn(),
}))

vi.mock('../utils/profileRoutes', () => ({
  getOptionalPublicProfilePath: () => null,
}))

vi.mock('../services/communityService', () => ({
  COMMUNITY_CATEGORY_VALUES: ['acao', 'aventura', 'rpg'],
  approveCommunityJoinRequest: serviceMocks.approveCommunityJoinRequest,
  createCommunityComment: vi.fn(),
  createCommunityPost: vi.fn(),
  deleteCommunity: vi.fn(),
  deleteCommunityComment: vi.fn(),
  deleteCommunityPost: vi.fn(),
  getCommunityById: serviceMocks.getCommunityById,
  getCommunityJoinRequests: serviceMocks.getCommunityJoinRequests,
  getCommunityMembers: serviceMocks.getCommunityMembers,
  getCommunityPosts: serviceMocks.getCommunityPosts,
  getCommunityReports: serviceMocks.getCommunityReports,
  getCommunityCommentAnchor: serviceMocks.getCommunityCommentAnchor,
  getCommunityCommentTarget: serviceMocks.getCommunityCommentTarget,
  getCommunityPostById: serviceMocks.getCommunityPostById,
  getCommunityPostCommentsPage: serviceMocks.getCommunityPostCommentsPage,
  mergeCommunityComments: (current: Array<{ id: string }>, incoming: Array<{ id: string }>) => {
    const byId = new Map(current.map(comment => [comment.id, comment]))
    incoming.forEach(comment => byId.set(comment.id, comment))
    return [...byId.values()]
  },
  joinCommunity: vi.fn(),
  leaveCommunity: vi.fn(),
  rejectCommunityJoinRequest: vi.fn(),
  removeCommunityMember: vi.fn(),
  submitCommunityReport: vi.fn(),
  toggleCommunityPostPinned: vi.fn(),
  toggleCommunityPostReaction: vi.fn(),
  toggleCommunityPostSave: vi.fn(),
  transferCommunityLeadership: vi.fn(),
  updateCommunity: vi.fn(),
  updateCommunityMemberRole: vi.fn(),
  updateCommunityModeratedDetails: vi.fn(),
  updateCommunityPostingPermission: vi.fn(),
  updateCommunityReportStatus: vi.fn(),
}))

function makeCommunity(overrides: Partial<CommunitySummary> = {}): CommunitySummary {
  return {
    id: 'community-1',
    nome: 'Comunidade de caracterizacao',
    descricao: 'Descricao da comunidade.',
    banner_path: null,
    tipo: 'Geral',
    jogo_id: null,
    categoria: 'aventura',
    regras: null,
    permissao_postagem: 'todos_membros',
    visibilidade: 'publica',
    lider_id: 'leader-1',
    membros_count: 3,
    posts_count: 0,
    created_at: '2026-07-13T12:00:00.000Z',
    updated_at: '2026-07-13T12:00:00.000Z',
    jogo: null,
    lider: null,
    currentUserRole: null,
    currentUserJoinRequestStatus: null,
    canPost: false,
    canViewContent: true,
    ...overrides,
  }
}

function makeMember(userId: string): CommunityMember {
  return {
    comunidade_id: 'community-1',
    usuario_id: userId,
    cargo: 'membro',
    entrou_em: '2026-07-13T12:00:00.000Z',
    atualizado_em: '2026-07-13T12:00:00.000Z',
    usuario: {
      id: userId,
      username: userId,
      nome_completo: null,
      avatar_path: null,
    },
  }
}

function makeJoinRequest(id: string): CommunityJoinRequest {
  return {
    id,
    comunidade_id: 'community-1',
    usuario_id: `user-${id}`,
    status: 'pendente',
    decidido_por: null,
    decidido_em: null,
    created_at: '2026-07-13T12:00:00.000Z',
    updated_at: '2026-07-13T12:00:00.000Z',
    usuario: {
      id: `user-${id}`,
      username: `user-${id}`,
      nome_completo: null,
      avatar_path: null,
    },
    moderador: null,
  }
}

function makePost(overrides: Partial<CommunityPost> = {}): CommunityPost {
  return {
    id: 'post-1',
    comunidade_id: 'community-1',
    autor_id: 'author-1',
    texto: 'Post',
    imagem_path: null,
    imagem_url: null,
    curtidas_count: 0,
    dislikes_count: 0,
    comentarios_count: 0,
    created_at: '2026-07-13T12:00:00.000Z',
    updated_at: '2026-07-13T12:00:00.000Z',
    fixado: false,
    fixado_em: null,
    fixado_por: null,
    autor: null,
    comentarios: [],
    commentsNextOffset: 0,
    currentUserReaction: null,
    savedByCurrentUser: false,
    canInteract: false,
    canDelete: false,
    canPin: false,
    ...overrides,
  }
}

function makeComment(index: number): CommunityPostComment {
  return {
    id: `comment-${index}`,
    post_id: 'post-1',
    comunidade_id: 'community-1',
    autor_id: `commenter-${index}`,
    texto: `Comment ${index}`,
    created_at: `2026-07-${String(index).padStart(2, '0')}T12:00:00.000Z`,
    updated_at: `2026-07-${String(index).padStart(2, '0')}T12:00:00.000Z`,
    autor: null,
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(resolvePromise => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}

function renderPage(initialEntry = '/comunidades/community-1') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/comunidades/:id" element={<CommunityDetailsPage />} />
      </Routes>
    </MemoryRouter>
  )
}

function CommunityRouteNavigation() {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate('/comunidades/community-2#community-comment-comment-new')}
    >
      navigate-community-2
    </button>
  )
}

function renderPageWithNavigation(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <CommunityRouteNavigation />
      <Routes>
        <Route path="/comunidades/:id" element={<CommunityDetailsPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('CommunityDetailsPage characterization', () => {
  beforeEach(() => {
    authMocks.user = null
    serviceMocks.approveCommunityJoinRequest.mockResolvedValue({ data: null, error: null })
    serviceMocks.getCommunityById.mockResolvedValue({ data: makeCommunity(), error: null })
    serviceMocks.getCommunityMembers.mockResolvedValue({ data: [], totalCount: 0, error: null })
    serviceMocks.getCommunityPosts.mockResolvedValue({ data: [], totalCount: 0, error: null })
    serviceMocks.getCommunityJoinRequests.mockResolvedValue({ data: [], error: null })
    serviceMocks.getCommunityReports.mockResolvedValue({ data: [], error: null })
    serviceMocks.getCommunityCommentTarget.mockResolvedValue({ data: null, error: null })
    serviceMocks.getCommunityCommentAnchor.mockResolvedValue({
      data: { found: false, commentOffset: null, pageOffset: null, totalCount: 0 },
      error: null,
    })
    serviceMocks.getCommunityPostById.mockResolvedValue({ data: null, error: null })
    serviceMocks.getCommunityPostCommentsPage.mockResolvedValue({
      data: { comments: [], totalCount: 0, nextOffset: 0 },
      error: null,
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('mantem o estado de carregamento ate o resumo da comunidade chegar', async () => {
    const request = createDeferred<{ data: CommunitySummary; error: null }>()
    serviceMocks.getCommunityById.mockReturnValue(request.promise)

    renderPage()

    expect(screen.getByText('communities.details.loading')).toBeInTheDocument()

    request.resolve({ data: makeCommunity({ nome: 'Comunidade carregada' }), error: null })

    expect(
      await screen.findByRole('heading', { name: 'Comunidade carregada' })
    ).toBeInTheDocument()
  })

  it('renderiza a comunidade publica e carrega o conteudo permitido', async () => {
    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'Comunidade de caracterizacao' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'communities.tabs.posts' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'communities.tabs.members' })).toBeInTheDocument()

    await waitFor(() => {
      expect(serviceMocks.getCommunityMembers).toHaveBeenCalledWith('community-1', {
        search: '',
        limit: 24,
        offset: 0,
      })
      expect(serviceMocks.getCommunityPosts).toHaveBeenCalledWith(
        'community-1',
        undefined,
        null,
        { page: 1, pageSize: 8 }
      )
    })
  })

  it('mostra o total paginado e carrega a proxima pagina de membros sob demanda', async () => {
    const firstPage = Array.from({ length: 24 }, (_, index) => makeMember(`member-${index + 1}`))
    serviceMocks.getCommunityMembers
      .mockResolvedValueOnce({ data: firstPage, totalCount: 25, error: null })
      .mockResolvedValueOnce({ data: [makeMember('member-25')], totalCount: 25, error: null })

    renderPage()
    await screen.findByRole('heading', { name: 'Comunidade de caracterizacao' })
    fireEvent.click(screen.getByRole('button', { name: 'communities.tabs.members' }))

    const loadMoreButton = await screen.findByRole('button', {
      name: 'communities.members.loadMore',
    })
    expect(i18nMocks.formatNumber).toHaveBeenCalledWith(25)

    fireEvent.click(loadMoreButton)

    await waitFor(() => {
      expect(serviceMocks.getCommunityMembers).toHaveBeenLastCalledWith('community-1', {
        search: '',
        limit: 24,
        offset: 24,
      })
      expect(screen.getByText('@member-25')).toBeInTheDocument()
    })
  })

  it('preserva o estado de comunidade nao encontrada quando a consulta falha sem dados', async () => {
    serviceMocks.getCommunityById.mockResolvedValue({
      data: null,
      error: { message: 'Falha controlada' },
    })

    renderPage()

    expect(await screen.findByText('communities.details.notFound')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'communities.details.back' })).toHaveAttribute(
      'href',
      '/comunidades'
    )
  })

  it('nao consulta posts ou membros quando a comunidade privada bloqueia o conteudo', async () => {
    serviceMocks.getCommunityById.mockResolvedValue({
      data: makeCommunity({
        nome: 'Comunidade privada',
        visibilidade: 'privada',
        canViewContent: false,
      }),
      error: null,
    })

    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'Comunidade privada' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'communities.tabs.posts' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'communities.tabs.members' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'communities.tabs.memberSettings' }))
    expect(await screen.findByText('communities.private.text')).toBeInTheDocument()

    await waitFor(() => {
      expect(serviceMocks.getCommunityMembers).not.toHaveBeenCalled()
      expect(serviceMocks.getCommunityPosts).not.toHaveBeenCalled()
    })
  })

  it('sincroniza o erro bruto do controller de feed com o feedback existente', async () => {
    serviceMocks.getCommunityPosts.mockResolvedValue({
      data: [],
      totalCount: null,
      error: { code: 'FEED_ERROR', message: 'Falha controlada do feed' },
    })

    renderPage()

    expect(await screen.findByText('Falha controlada do feed')).toHaveClass(
      'communities-feedback',
      'is-error'
    )
  })

  it('preserva deep links validos e nao derruba a rota com hash malformado', async () => {
    serviceMocks.getCommunityPosts.mockResolvedValue({
      data: [{ id: 'post-1' }],
      totalCount: 1,
      error: null,
    })

    const validRoute = renderPage('/comunidades/community-1#comment-valid%20anchor')
    await screen.findByRole('heading', { name: 'Comunidade de caracterizacao' })
    fireEvent.click(screen.getByRole('button', { name: 'communities.tabs.posts' }))
    expect(await screen.findByTestId('community-post-card')).toHaveAttribute(
      'data-active-anchor',
      'comment-valid anchor'
    )

    validRoute.unmount()
    renderPage('/comunidades/community-1#comment-%E0%A4%A')
    expect(await screen.findByRole('heading', {
      name: 'Comunidade de caracterizacao',
    })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'communities.tabs.posts' }))
    expect(await screen.findByTestId('community-post-card')).toHaveAttribute(
      'data-active-anchor',
      'comment-%E0%A4%A'
    )
  })

  it('resolves a community comment deep link through its bounded anchor page', async () => {
    const previewPost = makePost({
      comentarios: [1, 2, 3].map(makeComment),
      comentarios_count: 6,
      commentsNextOffset: 3,
    })
    serviceMocks.getCommunityPosts.mockResolvedValue({
      data: [],
      totalCount: 1,
      error: null,
    })
    serviceMocks.getCommunityCommentTarget.mockResolvedValue({
      data: { id: 'comment-5', postId: 'post-1', communityId: 'community-1' },
      error: null,
    })
    serviceMocks.getCommunityPostById.mockResolvedValue({
      data: previewPost,
      error: null,
    })
    serviceMocks.getCommunityCommentAnchor.mockResolvedValue({
      data: { found: true, commentOffset: 4, pageOffset: 3, totalCount: 6 },
      error: null,
    })
    serviceMocks.getCommunityPostCommentsPage.mockResolvedValue({
      data: { comments: [4, 5, 6].map(makeComment), totalCount: 6, nextOffset: 6 },
      error: null,
    })

    renderPage('/comunidades/community-1#community-comment-comment-5')

    const card = await screen.findByTestId('community-post-card')
    await waitFor(() => {
      expect(serviceMocks.getCommunityCommentTarget).toHaveBeenCalledWith('comment-5')
      expect(serviceMocks.getCommunityPostById).toHaveBeenCalledWith(
        'post-1',
        undefined,
        null
      )
      expect(serviceMocks.getCommunityCommentAnchor).toHaveBeenCalledWith(
        'post-1',
        'comment-5',
        3
      )
      expect(serviceMocks.getCommunityPostCommentsPage).toHaveBeenCalledWith('post-1', {
        limit: 3,
        offset: 3,
      })
      expect(card).toHaveAttribute(
        'data-comment-ids',
        'comment-1,comment-2,comment-3,comment-4,comment-5,comment-6'
      )
      expect(card).toHaveAttribute('data-comments-next-offset', '6')
    })
  })

  it('deduplicates requests for the same next comment page', async () => {
    const request = createDeferred<{
      data: { comments: CommunityPostComment[]; totalCount: number; nextOffset: number }
      error: null
    }>()
    serviceMocks.getCommunityPosts.mockResolvedValue({
      data: [makePost({
        comentarios: [1, 2, 3].map(makeComment),
        comentarios_count: 6,
        commentsNextOffset: 3,
      })],
      totalCount: 1,
      error: null,
    })
    serviceMocks.getCommunityPostCommentsPage.mockReturnValue(request.promise)

    renderPage()
    await screen.findByRole('heading', { name: 'Comunidade de caracterizacao' })
    fireEvent.click(screen.getByRole('button', { name: 'communities.tabs.posts' }))
    const button = await screen.findByRole('button', { name: 'load-more-comments' })
    fireEvent.click(button)
    fireEvent.click(button)

    expect(serviceMocks.getCommunityPostCommentsPage).toHaveBeenCalledTimes(1)
    expect(serviceMocks.getCommunityPostCommentsPage).toHaveBeenCalledWith('post-1', {
      limit: 3,
      offset: 3,
    })

    request.resolve({
      data: { comments: [4, 5, 6].map(makeComment), totalCount: 6, nextOffset: 6 },
      error: null,
    })

    await waitFor(() => {
      expect(screen.getByTestId('community-post-card')).toHaveAttribute(
        'data-comment-ids',
        'comment-1,comment-2,comment-3,comment-4,comment-5,comment-6'
      )
    })
  })

  it('discards an anchor response after the community route changes', async () => {
    const oldTargetRequest = createDeferred<{
      data: { id: string; postId: string; communityId: string }
      error: null
    }>()
    serviceMocks.getCommunityById.mockImplementation(async (communityId: string) => ({
      data: makeCommunity({
        id: communityId,
        nome: communityId === 'community-2' ? 'Second community' : 'First community',
      }),
      error: null,
    }))
    serviceMocks.getCommunityCommentTarget.mockImplementation((commentId: string) => (
      commentId === 'comment-old'
        ? oldTargetRequest.promise
        : Promise.resolve({ data: null, error: null })
    ))

    renderPageWithNavigation(
      '/comunidades/community-1#community-comment-comment-old'
    )
    await waitFor(() => {
      expect(serviceMocks.getCommunityCommentTarget).toHaveBeenCalledWith('comment-old')
    })

    fireEvent.click(screen.getByRole('button', { name: 'navigate-community-2' }))
    expect(await screen.findByRole('heading', { name: 'Second community' }))
      .toBeInTheDocument()

    await act(async () => {
      oldTargetRequest.resolve({
        data: { id: 'comment-old', postId: 'post-old', communityId: 'community-2' },
        error: null,
      })
      await Promise.resolve()
    })

    expect(serviceMocks.getCommunityCommentAnchor).not.toHaveBeenCalledWith(
      'post-old',
      'comment-old',
      3
    )
  })

  it('recarrega resumo, membros, posts e moderacao em ordem apos aprovar uma solicitacao', async () => {
    authMocks.user = { id: 'moderator-1' }
    const moderatorCommunity = makeCommunity({
      currentUserRole: 'admin',
      canPost: true,
    })
    const joinRequest = makeJoinRequest('request-1')
    serviceMocks.getCommunityById.mockResolvedValue({ data: moderatorCommunity, error: null })
    serviceMocks.getCommunityJoinRequests.mockResolvedValue({ data: [joinRequest], error: null })

    renderPage()
    await screen.findByRole('heading', { name: 'Comunidade de caracterizacao' })
    fireEvent.click(screen.getByRole('button', { name: 'communities.tabs.moderation' }))
    const approveButton = await screen.findByRole('button', {
      name: 'communities.moderation.approve',
    })

    const reloadOrder: string[] = []
    serviceMocks.getCommunityById.mockImplementation(async () => {
      reloadOrder.push('community')
      return { data: moderatorCommunity, error: null }
    })
    serviceMocks.getCommunityMembers.mockImplementation(async () => {
      reloadOrder.push('members')
      return { data: [], totalCount: 0, error: null }
    })
    serviceMocks.getCommunityPosts.mockImplementation(async () => {
      reloadOrder.push('posts')
      return { data: [], totalCount: 0, error: null }
    })
    serviceMocks.getCommunityJoinRequests.mockImplementation(async () => {
      reloadOrder.push('requests')
      return { data: [], error: null }
    })
    serviceMocks.getCommunityReports.mockImplementation(async () => {
      reloadOrder.push('reports')
      return { data: [], error: null }
    })

    fireEvent.click(approveButton)

    await waitFor(() => {
      expect(serviceMocks.approveCommunityJoinRequest).toHaveBeenCalledWith('request-1')
      expect(reloadOrder).toEqual([
        'community',
        'members',
        'posts',
        'requests',
        'reports',
      ])
    })
  })
})
