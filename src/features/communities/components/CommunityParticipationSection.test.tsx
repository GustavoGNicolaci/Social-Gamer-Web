import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CommunitySummary } from '../../../services/communityService'
import { CommunityParticipationSection } from './CommunityParticipationSection'

vi.mock('../../../i18n/I18nContext', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        'communities.participation.kicker': 'Participation',
        'communities.participation.title': 'Your community access',
        'communities.participation.role': 'Role: ',
        'communities.participation.status': 'Status: ',
        'communities.participation.postingRule': 'Posting: ',
        'communities.participation.statusApproved': 'Approved',
        'communities.participation.statusNotMember': 'Not a member',
        'communities.participation.leaderHelp': 'Leader help',
        'communities.participation.adminHelp': 'Admin help',
        'communities.participation.memberHelp': 'Member help',
        'communities.participation.pendingHelp': 'Pending help',
        'communities.participation.visitorHelp': 'Visitor help',
        'communities.role.lider': 'Leader',
        'communities.role.admin': 'Administrator',
        'communities.role.membro': 'Member',
        'communities.role.visitor': 'Visitor',
        'communities.permission.todos_membros': 'All members',
        'communities.private.text': 'Private community help',
        'communities.private.requestSent': 'Request sent',
        'communities.private.requestJoin': 'Request to join',
        'communities.loginToJoin': 'Log in to join',
        'communities.leave': 'Leave community',
        'communities.join': 'Join community',
      }
      return labels[key] ?? key
    },
  }),
}))

function createCommunity(
  overrides: Partial<CommunitySummary> = {}
): CommunitySummary {
  return {
    id: 'community-a',
    nome: 'Community',
    descricao: null,
    banner_path: null,
    tipo: null,
    jogo_id: null,
    categoria: null,
    regras: null,
    permissao_postagem: 'todos_membros',
    visibilidade: 'publica',
    lider_id: 'leader-a',
    membros_count: 1,
    posts_count: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    jogo: null,
    lider: null,
    currentUserRole: null,
    currentUserJoinRequestStatus: null,
    canPost: false,
    canViewContent: true,
    ...overrides,
  }
}

function renderSection(
  community: CommunitySummary,
  options: {
    isAuthenticated?: boolean
    onJoin?: () => void
    onRequestLeave?: () => void
  } = {}
) {
  const props = {
    community,
    isAuthenticated: options.isAuthenticated ?? true,
    onJoin: options.onJoin ?? vi.fn(),
    onRequestLeave: options.onRequestLeave ?? vi.fn(),
  }

  return {
    props,
    ...render(
      <MemoryRouter>
        <CommunityParticipationSection {...props} />
      </MemoryRouter>
    ),
  }
}

afterEach(cleanup)

describe('CommunityParticipationSection', () => {
  it('preserva o DOM e mostra o estado do proprietario sem acao de saida', () => {
    const { container } = renderSection(createCommunity({ currentUserRole: 'lider' }))
    const root = container.querySelector('.community-member-settings-card')

    expect(root).toHaveClass('community-section')
    expect(screen.getByRole('heading', { name: 'Your community access' })).toBeInTheDocument()
    expect(screen.getByText('Leader')).toBeInTheDocument()
    expect(screen.getByText('Approved')).toBeInTheDocument()
    expect(screen.getByText('Leader help')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('permite ao membro solicitar a saida', () => {
    const onRequestLeave = vi.fn()
    renderSection(
      createCommunity({ currentUserRole: 'membro' }),
      { onRequestLeave }
    )

    fireEvent.click(screen.getByRole('button', { name: 'Leave community' }))
    expect(onRequestLeave).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Member help')).toBeInTheDocument()
  })

  it('preserva a solicitacao de entrada em comunidade privada', () => {
    const onJoin = vi.fn()
    renderSection(
      createCommunity({ visibilidade: 'privada' }),
      { onJoin }
    )

    expect(screen.getByText('Private community help')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Request to join' }))
    expect(onJoin).toHaveBeenCalledTimes(1)
  })

  it('mantem o link de login e bloqueia nova acao quando a solicitacao esta pendente', () => {
    const { rerender } = renderSection(
      createCommunity({ visibilidade: 'privada' }),
      { isAuthenticated: false }
    )
    expect(screen.getByRole('link', { name: 'Log in to join' })).toHaveAttribute('href', '/login')

    rerender(
      <MemoryRouter>
        <CommunityParticipationSection
          community={createCommunity({
            visibilidade: 'privada',
            currentUserJoinRequestStatus: 'pendente',
          })}
          isAuthenticated
          onJoin={vi.fn()}
          onRequestLeave={vi.fn()}
        />
      </MemoryRouter>
    )
    expect(screen.getByRole('button', { name: 'Request sent' })).toBeDisabled()
    expect(screen.getByText('Pending help')).toBeInTheDocument()
  })
})
