import { useI18n } from '../../../i18n/I18nContext'
import type {
  CommunityJoinRequest,
  CommunityReport,
  CommunityReportStatus,
} from '../../../services/communityService'

export type CommunityRequestViewFilter = 'pendente' | 'all'
export type CommunityReportViewFilter = CommunityReportStatus | 'all'

interface CommunityModerationRequests {
  items: CommunityJoinRequest[]
  filter: CommunityRequestViewFilter
  onFilterChange: (filter: CommunityRequestViewFilter) => void
  onApprove: (request: CommunityJoinRequest) => void | Promise<void>
  onReject: (request: CommunityJoinRequest) => void | Promise<void>
}

interface CommunityModerationReports {
  items: CommunityReport[]
  filter: CommunityReportViewFilter
  onFilterChange: (filter: CommunityReportViewFilter) => void
  onStatusChange: (
    report: CommunityReport,
    status: CommunityReportStatus
  ) => void | Promise<void>
}

export interface CommunityModerationSectionProps {
  loading: boolean
  requests: CommunityModerationRequests
  reports: CommunityModerationReports
}

function getAuthorName(author: { username?: string | null; nome_completo?: string | null } | null) {
  return author?.username || author?.nome_completo || 'usuario'
}

function getReportPreview(report: CommunityReport, imageLabel: string) {
  if (report.targetText) return report.targetText
  if (report.targetImagePath) return imageLabel
  return ''
}

export function CommunityModerationSection({
  loading,
  requests,
  reports,
}: CommunityModerationSectionProps) {
  const { t, formatDate } = useI18n()

  return (
    <div className="community-moderation-grid">
      <section className="community-section">
        <div className="community-section-head">
          <div>
            <h2>{t('communities.moderation.requests')}</h2>
            <p>{t('communities.moderation.requestsHelp')}</p>
          </div>
          <label className="communities-field community-compact-select">
            <span>{t('common.status')}</span>
            <select
              value={requests.filter}
              onChange={event => requests.onFilterChange(event.target.value as CommunityRequestViewFilter)}
            >
              <option value="pendente">{t('communities.requestStatus.pendente')}</option>
              <option value="all">{t('communities.moderation.all')}</option>
            </select>
          </label>
        </div>

        {loading ? (
          <div className="communities-state-card">{t('communities.moderation.loading')}</div>
        ) : requests.items.length === 0 ? (
          <div className="communities-state-card">{t('communities.moderation.noRequests')}</div>
        ) : (
          <div className="community-moderation-list">
            {requests.items.map(request => {
              const userName = request.usuario?.username || request.usuario?.nome_completo || t('common.profile')
              return (
                <article key={request.id} className="community-moderation-card">
                  <div>
                    <strong>@{userName}</strong>
                    <span>{t(`communities.requestStatus.${request.status}`)}</span>
                  </div>
                  <small>{formatDate(request.created_at, { fallback: t('common.noDate') })}</small>
                  {request.status === 'pendente' ? (
                    <div className="community-member-actions">
                      <button
                        type="button"
                        className="community-secondary-button"
                        onClick={() => void requests.onApprove(request)}
                      >
                        {t('communities.moderation.approve')}
                      </button>
                      <button
                        type="button"
                        className="community-danger-button"
                        onClick={() => void requests.onReject(request)}
                      >
                        {t('communities.moderation.reject')}
                      </button>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="community-section">
        <div className="community-section-head">
          <div>
            <h2>{t('communities.moderation.reports')}</h2>
            <p>{t('communities.moderation.reportsHelp')}</p>
          </div>
          <label className="communities-field community-compact-select">
            <span>{t('common.status')}</span>
            <select
              value={reports.filter}
              onChange={event => reports.onFilterChange(event.target.value as CommunityReportViewFilter)}
            >
              <option value="all">{t('communities.moderation.all')}</option>
              <option value="pending">{t('report.status.pending')}</option>
              <option value="under_review">{t('report.status.under_review')}</option>
              <option value="resolved">{t('report.status.resolved')}</option>
              <option value="dismissed">{t('report.status.dismissed')}</option>
            </select>
          </label>
        </div>

        {loading ? (
          <div className="communities-state-card">{t('communities.moderation.loading')}</div>
        ) : reports.items.length === 0 ? (
          <div className="communities-state-card">{t('communities.moderation.noReports')}</div>
        ) : (
          <div className="community-moderation-list">
            {reports.items.map(report => {
              const reporterName = getAuthorName(report.denunciante)
              const targetAuthorName = getAuthorName(report.targetAuthor)
              const reportPreview = getReportPreview(
                report,
                t('communities.moderation.imagePreview')
              )
              return (
                <article key={report.id} className="community-moderation-card">
                  <div className="community-report-card-head">
                    <div>
                      <strong>{t(`communities.report.type.${report.tipo_conteudo}`)}</strong>
                      <span>{t('communities.moderation.reportBy', { user: `@${reporterName}` })}</span>
                    </div>
                    <select
                      value={report.status}
                      onChange={event =>
                        void reports.onStatusChange(report, event.target.value as CommunityReportStatus)
                      }
                    >
                      <option value="pending">{t('report.status.pending')}</option>
                      <option value="under_review">{t('report.status.under_review')}</option>
                      <option value="resolved">{t('report.status.resolved')}</option>
                      <option value="dismissed">{t('report.status.dismissed')}</option>
                    </select>
                  </div>
                  <p>{t('communities.moderation.reason', { reason: t(`report.reason.${report.motivo}`) })}</p>
                  <p>{t('communities.moderation.targetAuthor', { user: `@${targetAuthorName}` })}</p>
                  {reportPreview ? <blockquote>{reportPreview}</blockquote> : null}
                  {report.descricao ? <p>{report.descricao}</p> : null}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
