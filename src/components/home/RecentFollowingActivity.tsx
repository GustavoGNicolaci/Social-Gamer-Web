import { Link } from 'react-router-dom'
import { UserAvatar } from '../UserAvatar'
import type { HomeFollowingActivity } from '../../services/homeService'
import { useI18n } from '../../i18n/I18nContext'
import { getPublicProfilePath } from '../../utils/profileRoutes'
import { formatCompactDate } from './homeDisplayUtils'
import { HomePanelState } from './HomePanelState'

interface RecentFollowingActivityProps {
  items: HomeFollowingActivity[]
  isLoading: boolean
  errorMessage: string | null
  isAuthenticated: boolean
}

function getActivityTag(activity: HomeFollowingActivity, t: ReturnType<typeof useI18n>['t']) {
  if (activity.type === 'review') return t('common.review')
  if (activity.isFavorite) return t('common.favorite')
  return activity.statusValue || 'Status'
}

export function RecentFollowingActivity({
  items,
  isLoading,
  errorMessage,
  isAuthenticated,
}: RecentFollowingActivityProps) {
  const { t } = useI18n()

  return (
    <div className="home-panel">
      <div className="home-panel-heading">
        <div>
          <h3 className="home-panel-title">{t('home.activity.title')}</h3>
          <p>{t('home.activity.description')}</p>
        </div>
      </div>

      {isLoading ? (
        <HomePanelState message={t('home.activity.loading')} tone="loading" rows={4} />
      ) : errorMessage ? (
        <HomePanelState message={errorMessage} tone="error" />
      ) : !isAuthenticated ? (
        <div className="home-empty-state" role="status">
          <p>{t('home.activity.login')}</p>
          <Link to="/login" className="home-inline-link">
            {t('auth.login.submit')}
          </Link>
        </div>
      ) : items.length === 0 ? (
        <HomePanelState message={t('home.activity.empty')} />
      ) : (
        <div className="home-activity-list">
          {items.map(activity => (
            <article key={activity.id} className="home-activity-card">
              <div className="home-activity-top">
                <Link
                  to={getPublicProfilePath(activity.author.username)}
                  className="home-user-chip"
                >
                  <UserAvatar
                    name={activity.author.name}
                    avatarPath={activity.author.avatarPath}
                    imageClassName="home-user-avatar"
                    fallbackClassName="home-user-avatar-fallback"
                  />

                  <div>
                    <strong>{activity.author.name}</strong>
                    <span>{formatCompactDate(activity.createdAt)}</span>
                  </div>
                </Link>

                {activity.score !== null ? (
                  <span className="home-score-pill">{activity.score}/10</span>
                ) : (
                  <span className="home-tag">{getActivityTag(activity, t)}</span>
                )}
              </div>

              <h4 className="home-card-title-heading">
                <Link to={`/games/${activity.game.id}`} className="home-card-title-link">
                  {activity.game.title}
                </Link>
              </h4>
              <p>{activity.summary}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
