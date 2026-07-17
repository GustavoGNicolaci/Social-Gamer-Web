import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CommunityMember } from '../../../services/communityService'
import { CommunityMemberCard } from './CommunityMemberCard'

vi.mock('../../../i18n/I18nContext', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        'communities.role.lider': 'Leader',
        'communities.role.admin': 'Administrator',
        'communities.role.membro': 'Member',
        'communities.member.removeAdmin': 'Remove administrator',
        'communities.member.promoteAdmin': 'Promote administrator',
        'communities.member.transferLeadership': 'Transfer leadership',
        'communities.member.kick': 'Remove member',
      }
      return labels[key] ?? key
    },
  }),
}))

vi.mock('../../../components/UserAvatar', () => ({
  UserAvatar: ({ name }: { name?: string | null }) => (
    <span data-testid="member-avatar">avatar:{name}</span>
  ),
}))

function createMember(
  role: CommunityMember['cargo'] = 'membro',
  userId = 'member-a'
): CommunityMember {
  return {
    comunidade_id: 'community-a',
    usuario_id: userId,
    cargo: role,
    entrou_em: '2026-01-01T00:00:00.000Z',
    atualizado_em: '2026-01-01T00:00:00.000Z',
    usuario: {
      id: userId,
      username: 'player',
      nome_completo: null,
      avatar_path: null,
    },
  }
}

function createProps(member = createMember()) {
  return {
    member,
    currentUserId: 'leader-a',
    isModerator: false,
    isLeader: false,
    onRequestPromote: vi.fn(),
    onRequestDemote: vi.fn(),
    onRequestTransferLeadership: vi.fn(),
    onRequestKick: vi.fn(),
  }
}

function renderCard(props = createProps()) {
  return {
    props,
    ...render(
      <MemoryRouter>
        <CommunityMemberCard {...props} />
      </MemoryRouter>
    ),
  }
}

afterEach(cleanup)

describe('CommunityMemberCard', () => {
  it('preserva a raiz, link publico, avatar e rotulo do membro', () => {
    const { container } = renderCard()

    expect(container.firstElementChild).toHaveClass('community-member-card')
    expect(screen.getByRole('link', { name: /player.*Member/ })).toHaveAttribute('href', '/u/player')
    expect(screen.getByTestId('member-avatar')).toHaveTextContent('avatar:player')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('oferece ao lider as acoes tipadas para um membro comum', () => {
    const props = {
      ...createProps(),
      isModerator: true,
      isLeader: true,
    }
    renderCard(props)

    fireEvent.click(screen.getByRole('button', { name: 'Promote administrator' }))
    fireEvent.click(screen.getByRole('button', { name: 'Transfer leadership' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove member' }))

    expect(props.onRequestPromote).toHaveBeenCalledWith(props.member)
    expect(props.onRequestTransferLeadership).toHaveBeenCalledWith(props.member)
    expect(props.onRequestKick).toHaveBeenCalledWith(props.member)
    expect(props.onRequestDemote).not.toHaveBeenCalled()
  })

  it('permite rebaixar admin e limita moderadores a expulsar membros comuns', () => {
    const adminProps = {
      ...createProps(createMember('admin', 'admin-a')),
      isModerator: true,
      isLeader: true,
    }
    const { unmount } = renderCard(adminProps)

    fireEvent.click(screen.getByRole('button', { name: 'Remove administrator' }))
    expect(adminProps.onRequestDemote).toHaveBeenCalledWith(adminProps.member)
    expect(screen.queryByRole('button', { name: 'Remove member' })).not.toBeInTheDocument()

    unmount()
    const moderatorProps = {
      ...createProps(),
      isModerator: true,
    }
    renderCard(moderatorProps)
    expect(screen.getByRole('button', { name: 'Remove member' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Promote administrator' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Transfer leadership' })).not.toBeInTheDocument()
  })
})
