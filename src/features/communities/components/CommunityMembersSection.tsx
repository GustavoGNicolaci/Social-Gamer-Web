import { useI18n } from '../../../i18n/I18nContext'
import type {
  CommunityError,
  CommunityMember,
} from '../../../services/communityService'
import { CommunityMemberCard } from './CommunityMemberCard'

interface CommunityMembersData {
  members: CommunityMember[]
  totalCount: number | null
}

interface CommunityMembersSearch {
  value: string
  onChange: (value: string) => void
}

interface CommunityMembersState {
  loading: boolean
  error: CommunityError | null
}

interface CommunityMembersPagination {
  hasMore: boolean
  loadingMore: boolean
  loadMore: () => void | Promise<void>
  retry: () => void | Promise<void>
}

interface CommunityMembersPermissions {
  currentUserId: string | null
  isModerator: boolean
  isLeader: boolean
}

interface CommunityMembersActions {
  onRequestPromote: (member: CommunityMember) => void
  onRequestDemote: (member: CommunityMember) => void
  onRequestTransferLeadership: (member: CommunityMember) => void
  onRequestKick: (member: CommunityMember) => void
}

export interface CommunityMembersSectionProps {
  data: CommunityMembersData
  search: CommunityMembersSearch
  state: CommunityMembersState
  pagination: CommunityMembersPagination
  permissions: CommunityMembersPermissions
  actions: CommunityMembersActions
}

export function CommunityMembersSection({
  data,
  search,
  state,
  pagination,
  permissions,
  actions,
}: CommunityMembersSectionProps) {
  const { t, formatNumber } = useI18n()

  return (
    <section className="community-section">
      <div className="community-section-head">
        <div>
          <h2>{t('communities.tabs.members')}</h2>
          <p>{t('communities.membersCount', {
            count: formatNumber(data.totalCount ?? data.members.length),
          })}</p>
        </div>
        <label className="communities-field community-member-search">
          <span>{t('communities.members.search')}</span>
          <input
            type="search"
            value={search.value}
            onChange={event => search.onChange(event.target.value)}
            placeholder={t('communities.members.searchPlaceholder')}
          />
        </label>
      </div>

      {state.loading ? (
        <div className="communities-state-card">{t('communities.members.loading')}</div>
      ) : data.members.length === 0 ? (
        <div className="communities-state-card">{t('communities.members.empty')}</div>
      ) : (
        <>
          <div className="community-member-list is-grid">
            {data.members.map(member => (
              <CommunityMemberCard
                key={member.usuario_id}
                member={member}
                currentUserId={permissions.currentUserId}
                isModerator={permissions.isModerator}
                isLeader={permissions.isLeader}
                onRequestPromote={actions.onRequestPromote}
                onRequestDemote={actions.onRequestDemote}
                onRequestTransferLeadership={actions.onRequestTransferLeadership}
                onRequestKick={actions.onRequestKick}
              />
            ))}
          </div>

          {pagination.hasMore ? (
            <div className="community-pagination">
              <button
                type="button"
                className="community-secondary-button"
                disabled={pagination.loadingMore}
                onClick={() => void (state.error ? pagination.retry() : pagination.loadMore())}
              >
                {pagination.loadingMore
                  ? t('communities.members.loadingMore')
                  : t('communities.members.loadMore')}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
