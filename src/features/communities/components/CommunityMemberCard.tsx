import { Link } from 'react-router-dom'
import { UserAvatar } from '../../../components/UserAvatar'
import { useI18n } from '../../../i18n/I18nContext'
import type { CommunityMember } from '../../../services/communityService'
import { getOptionalPublicProfilePath } from '../../../utils/profileRoutes'

export interface CommunityMemberCardProps {
  member: CommunityMember
  currentUserId: string | null
  isModerator: boolean
  isLeader: boolean
  onRequestPromote: (member: CommunityMember) => void
  onRequestDemote: (member: CommunityMember) => void
  onRequestTransferLeadership: (member: CommunityMember) => void
  onRequestKick: (member: CommunityMember) => void
}

function getMemberName(member: CommunityMember) {
  return member.usuario?.username || member.usuario?.nome_completo || 'usuario'
}

export function CommunityMemberCard({
  member,
  currentUserId,
  isModerator,
  isLeader,
  onRequestPromote,
  onRequestDemote,
  onRequestTransferLeadership,
  onRequestKick,
}: CommunityMemberCardProps) {
  const { t } = useI18n()
  const memberName = getMemberName(member)
  const memberPath = getOptionalPublicProfilePath(member.usuario?.username)
  const canKick = isModerator && member.cargo === 'membro'
  const canManageAdmin = isLeader && member.cargo !== 'lider'
  const canTransfer = isLeader && member.usuario_id !== currentUserId
  const roleLabel = member.cargo === 'lider'
    ? t('communities.role.lider')
    : member.cargo === 'admin'
      ? t('communities.role.admin')
      : t('communities.role.membro')
  const authorContent = (
    <>
      <UserAvatar
        name={memberName}
        avatarPath={member.usuario?.avatar_path}
        imageClassName="community-member-avatar"
        fallbackClassName="community-member-avatar-fallback"
      />
      <span>
        <strong>@{memberName}</strong>
        <span>{roleLabel}</span>
      </span>
    </>
  )

  return (
    <article className="community-member-card">
      <div className="community-member-header">
        {memberPath ? (
          <Link to={memberPath} className="community-member-author">
            {authorContent}
          </Link>
        ) : (
          <div className="community-member-author">{authorContent}</div>
        )}
      </div>

      {canKick || canManageAdmin || canTransfer ? (
        <div className="community-member-actions">
          {canManageAdmin ? (
            <button
              type="button"
              className="community-secondary-button"
              onClick={() => (
                member.cargo === 'admin'
                  ? onRequestDemote(member)
                  : onRequestPromote(member)
              )}
            >
              {member.cargo === 'admin'
                ? t('communities.member.removeAdmin')
                : t('communities.member.promoteAdmin')}
            </button>
          ) : null}

          {canTransfer ? (
            <button
              type="button"
              className="community-secondary-button"
              onClick={() => onRequestTransferLeadership(member)}
            >
              {t('communities.member.transferLeadership')}
            </button>
          ) : null}

          {canKick ? (
            <button
              type="button"
              className="community-danger-button"
              onClick={() => onRequestKick(member)}
            >
              {t('communities.member.kick')}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
