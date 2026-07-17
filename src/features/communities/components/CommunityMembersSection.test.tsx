import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CommunityMember } from '../../../services/communityService'
import { CommunityMembersSection } from './CommunityMembersSection'

vi.mock('../../../i18n/I18nContext', () => ({
  useI18n: () => ({
    t: (key: string, params?: { count?: string }) => {
      const labels: Record<string, string> = {
        'communities.tabs.members': 'Members',
        'communities.membersCount': `${params?.count ?? '0'} members`,
        'communities.members.search': 'Search members',
        'communities.members.searchPlaceholder': 'Type a username',
        'communities.members.loading': 'Loading members',
        'communities.members.empty': 'No members',
        'communities.members.loadingMore': 'Loading more members',
        'communities.members.loadMore': 'Load more members',
      }
      return labels[key] ?? key
    },
    formatNumber: (value: number) => String(value),
  }),
}))

vi.mock('./CommunityMemberCard', () => ({
  CommunityMemberCard: ({ member }: { member: CommunityMember }) => (
    <article data-testid={`member-${member.usuario_id}`}>
      {member.usuario_id}
    </article>
  ),
}))

function createMember(userId: string): CommunityMember {
  return {
    comunidade_id: 'community-a',
    usuario_id: userId,
    cargo: 'membro',
    entrou_em: '2026-01-01T00:00:00.000Z',
    atualizado_em: '2026-01-01T00:00:00.000Z',
    usuario: null,
  }
}

const members = [createMember('user-a'), createMember('user-b')]

function createProps() {
  return {
    data: {
      members,
      totalCount: 12,
    },
    search: {
      value: '',
      onChange: vi.fn(),
    },
    state: {
      loading: false,
      error: null,
    },
    pagination: {
      hasMore: true,
      loadingMore: false,
      loadMore: vi.fn(),
      retry: vi.fn(),
    },
    permissions: {
      currentUserId: 'leader-a',
      isModerator: true,
      isLeader: true,
    },
    actions: {
      onRequestPromote: vi.fn(),
      onRequestDemote: vi.fn(),
      onRequestTransferLeadership: vi.fn(),
      onRequestKick: vi.fn(),
    },
  }
}

afterEach(cleanup)

describe('CommunityMembersSection', () => {
  it('preserva a raiz, renderiza total/lista e encaminha a busca', () => {
    const props = createProps()
    const { container } = render(<CommunityMembersSection {...props} />)

    expect(container.firstElementChild).toHaveClass('community-section')
    expect(screen.getByRole('heading', { name: 'Members' })).toBeInTheDocument()
    expect(screen.getByText('12 members')).toBeInTheDocument()
    expect(screen.getAllByTestId(/^member-/)).toHaveLength(2)

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search members' }), {
      target: { value: 'player' },
    })
    expect(props.search.onChange).toHaveBeenCalledWith('player')
  })

  it('mantem os estados de carregamento e vazio', () => {
    const props = createProps()
    const { rerender } = render(
      <CommunityMembersSection
        {...props}
        state={{ ...props.state, loading: true }}
      />
    )
    expect(screen.getByText('Loading members')).toHaveClass('communities-state-card')

    rerender(
      <CommunityMembersSection
        {...props}
        data={{ members: [], totalCount: 0 }}
      />
    )
    expect(screen.getByText('No members')).toHaveClass('communities-state-card')
  })

  it('carrega a proxima pagina, tenta novamente em erro e bloqueia durante a carga', () => {
    const props = createProps()
    const { rerender } = render(<CommunityMembersSection {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Load more members' }))
    expect(props.pagination.loadMore).toHaveBeenCalledTimes(1)
    expect(props.pagination.retry).not.toHaveBeenCalled()

    rerender(
      <CommunityMembersSection
        {...props}
        state={{
          loading: false,
          error: { code: 'LOAD_MORE', message: 'failed' },
        }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Load more members' }))
    expect(props.pagination.retry).toHaveBeenCalledTimes(1)

    rerender(
      <CommunityMembersSection
        {...props}
        pagination={{ ...props.pagination, loadingMore: true }}
      />
    )
    expect(screen.getByRole('button', { name: 'Loading more members' })).toBeDisabled()
  })
})
