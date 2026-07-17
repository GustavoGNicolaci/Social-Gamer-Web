import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  CommunityJoinRequest,
  CommunityReport,
} from '../../../services/communityService'
import { CommunityModerationSection } from './CommunityModerationSection'

vi.mock('../../../i18n/I18nContext', () => ({
  useI18n: () => ({
    t: (key: string, params?: { user?: string; reason?: string }) => {
      const labels: Record<string, string> = {
        'communities.moderation.requests': 'Join requests',
        'communities.moderation.requestsHelp': 'Review membership requests',
        'communities.moderation.reports': 'Reports',
        'communities.moderation.reportsHelp': 'Review reports',
        'communities.moderation.loading': 'Loading moderation',
        'communities.moderation.noRequests': 'No requests',
        'communities.moderation.noReports': 'No reports',
        'communities.moderation.approve': 'Approve',
        'communities.moderation.reject': 'Reject',
        'communities.moderation.all': 'All',
        'communities.moderation.reportBy': `Reported by ${params?.user ?? ''}`,
        'communities.moderation.reason': `Reason: ${params?.reason ?? ''}`,
        'communities.moderation.targetAuthor': `Target: ${params?.user ?? ''}`,
        'communities.moderation.imagePreview': 'Image',
        'communities.requestStatus.pendente': 'Pending',
        'communities.report.type.post': 'Post',
        'report.status.pending': 'Pending',
        'report.status.under_review': 'Under review',
        'report.status.resolved': 'Resolved',
        'report.status.dismissed': 'Dismissed',
        'report.reason.spam': 'Spam',
        'common.status': 'Status',
        'common.profile': 'Profile',
        'common.noDate': 'No date',
      }
      return labels[key] ?? key
    },
    formatDate: (value: string) => `date:${value}`,
  }),
}))

function createJoinRequest(): CommunityJoinRequest {
  return {
    id: 'request-a',
    comunidade_id: 'community-a',
    usuario_id: 'user-a',
    status: 'pendente',
    decidido_por: null,
    decidido_em: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    usuario: {
      id: 'user-a',
      username: 'player',
      nome_completo: null,
      avatar_path: null,
    },
    moderador: null,
  }
}

function createReport(): CommunityReport {
  return {
    id: 'report-a',
    comunidade_id: 'community-a',
    denunciante_id: 'reporter-a',
    tipo_conteudo: 'post',
    post_id: 'post-a',
    comentario_id: null,
    motivo: 'spam',
    descricao: 'Details',
    status: 'pending',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    denunciante: {
      id: 'reporter-a',
      username: 'reporter',
      nome_completo: null,
      avatar_path: null,
    },
    targetText: 'Reported text',
    targetImagePath: null,
    targetAuthor: {
      id: 'author-a',
      username: 'author',
      nome_completo: null,
      avatar_path: null,
    },
    targetCreatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function createProps() {
  return {
    loading: false,
    requests: {
      items: [createJoinRequest()],
      filter: 'pendente' as const,
      onFilterChange: vi.fn(),
      onApprove: vi.fn(),
      onReject: vi.fn(),
    },
    reports: {
      items: [createReport()],
      filter: 'all' as const,
      onFilterChange: vi.fn(),
      onStatusChange: vi.fn(),
    },
  }
}

afterEach(cleanup)

describe('CommunityModerationSection', () => {
  it('preserva a raiz e renderiza os cards de solicitacoes e denuncias', () => {
    const props = createProps()
    const { container } = render(<CommunityModerationSection {...props} />)

    expect(container.firstElementChild).toHaveClass('community-moderation-grid')
    expect(screen.getByRole('heading', { name: 'Join requests' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument()
    expect(screen.getByText('@player')).toBeInTheDocument()
    expect(screen.getByText('Reported text')).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(2)
  })

  it('encaminha filtros e todas as acoes do moderador', () => {
    const props = createProps()
    render(<CommunityModerationSection {...props} />)

    const requestsSection = screen.getByRole('heading', { name: 'Join requests' }).closest('section')
    const reportsSection = screen.getByRole('heading', { name: 'Reports' }).closest('section')
    expect(requestsSection).not.toBeNull()
    expect(reportsSection).not.toBeNull()

    fireEvent.click(within(requestsSection!).getByRole('button', { name: 'Approve' }))
    fireEvent.click(within(requestsSection!).getByRole('button', { name: 'Reject' }))
    expect(props.requests.onApprove).toHaveBeenCalledWith(props.requests.items[0])
    expect(props.requests.onReject).toHaveBeenCalledWith(props.requests.items[0])

    fireEvent.change(within(requestsSection!).getByRole('combobox', { name: 'Status' }), {
      target: { value: 'all' },
    })
    expect(props.requests.onFilterChange).toHaveBeenCalledWith('all')

    const reportSelects = within(reportsSection!).getAllByRole('combobox')
    fireEvent.change(reportSelects[0], { target: { value: 'resolved' } })
    fireEvent.change(reportSelects[1], { target: { value: 'dismissed' } })
    expect(props.reports.onFilterChange).toHaveBeenCalledWith('resolved')
    expect(props.reports.onStatusChange).toHaveBeenCalledWith(
      props.reports.items[0],
      'dismissed'
    )
  })

  it('mantem os estados de carregamento e vazio nas duas secoes', () => {
    const props = createProps()
    const { rerender } = render(
      <CommunityModerationSection {...props} loading />
    )
    expect(screen.getAllByText('Loading moderation')).toHaveLength(2)

    rerender(
      <CommunityModerationSection
        {...props}
        requests={{ ...props.requests, items: [] }}
        reports={{ ...props.reports, items: [] }}
      />
    )
    expect(screen.getByText('No requests')).toHaveClass('communities-state-card')
    expect(screen.getByText('No reports')).toHaveClass('communities-state-card')
  })
})
