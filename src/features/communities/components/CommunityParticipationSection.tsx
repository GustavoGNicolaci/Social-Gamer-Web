import { Link } from 'react-router-dom'
import { useI18n } from '../../../i18n/I18nContext'
import type { CommunitySummary } from '../../../services/communityService'

export interface CommunityParticipationSectionProps {
  community: CommunitySummary
  isAuthenticated: boolean
  onJoin: () => void | Promise<void>
  onRequestLeave: () => void
}

export function CommunityParticipationSection({
  community,
  isAuthenticated,
  onJoin,
  onRequestLeave,
}: CommunityParticipationSectionProps) {
  const { t } = useI18n()
  const roleLabel = community.currentUserRole === 'lider'
    ? t('communities.role.lider')
    : community.currentUserRole === 'admin'
      ? t('communities.role.admin')
      : community.currentUserRole === 'membro'
        ? t('communities.role.membro')
        : t('communities.role.visitor')
  const isPending = community.currentUserJoinRequestStatus === 'pendente'
  const memberStatus = community.currentUserRole
    ? t('communities.participation.statusApproved')
    : isPending
      ? t('communities.private.requestSent')
      : t('communities.participation.statusNotMember')
  const participationHelp = community.currentUserRole === 'lider'
    ? t('communities.participation.leaderHelp')
    : community.currentUserRole === 'admin'
      ? t('communities.participation.adminHelp')
      : community.currentUserRole === 'membro'
        ? t('communities.participation.memberHelp')
        : isPending
          ? t('communities.participation.pendingHelp')
          : community.visibilidade === 'privada'
            ? t('communities.private.text')
            : t('communities.participation.visitorHelp')

  return (
    <section className="community-section community-member-settings-card">
      <div className="community-member-settings-head">
        <div>
          <span className="communities-kicker">{t('communities.participation.kicker')}</span>
          <h2>{t('communities.participation.title')}</h2>
        </div>
        <p>{participationHelp}</p>
      </div>

      <div className="community-participation-status">
        <span>
          <strong>{t('communities.participation.role')}</strong>
          {roleLabel}
        </span>
        <span>
          <strong>{t('communities.participation.status')}</strong>
          {memberStatus}
        </span>
        <span>
          <strong>{t('communities.participation.postingRule')}</strong>
          {t(`communities.permission.${community.permissao_postagem}`)}
        </span>
      </div>

      <div className="community-participation-actions">
        {!isAuthenticated ? (
          <Link to="/login" className="communities-primary-link">
            {t('communities.loginToJoin')}
          </Link>
        ) : community.currentUserRole ? (
          community.currentUserRole !== 'lider' ? (
            <button
              type="button"
              className="community-danger-button"
              onClick={onRequestLeave}
            >
              {t('communities.leave')}
            </button>
          ) : null
        ) : isPending ? (
          <button type="button" className="community-secondary-button" disabled>
            {t('communities.private.requestSent')}
          </button>
        ) : (
          <button type="button" className="communities-primary-button" onClick={() => void onJoin()}>
            {community.visibilidade === 'privada'
              ? t('communities.private.requestJoin')
              : t('communities.join')}
          </button>
        )}
      </div>
    </section>
  )
}
