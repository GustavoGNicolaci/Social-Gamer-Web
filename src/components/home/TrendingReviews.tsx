import { Link } from 'react-router-dom'
import { UserAvatar } from '../UserAvatar'
import type { HomeTrendingReview } from '../../services/homeService'
import { useI18n } from '../../i18n/I18nContext'
import { getPublicProfilePath } from '../../utils/profileRoutes'
import { formatCompactDate, formatCount } from './homeDisplayUtils'
import { HomePanelState } from './HomePanelState'

interface TrendingReviewsProps {
  items: HomeTrendingReview[]
  isLoading: boolean
  errorMessage: string | null
}

function getLikeLabel(value: number, t: ReturnType<typeof useI18n>['t']) {
  return value === 1
    ? t('home.trending.likeOne')
    : t('home.trending.likeMany', { count: formatCount(value) })
}

export function TrendingReviews({ items, isLoading, errorMessage }: TrendingReviewsProps) {
  const { t } = useI18n()

  return (
    <div className="home-panel">
      <div className="home-panel-heading">
        <div>
          <h3 className="home-panel-title">{t('home.trending.title')}</h3>
          <p>{t('home.trending.description')}</p>
        </div>
      </div>

      {isLoading ? (
        <HomePanelState message={t('home.trending.loading')} tone="loading" rows={4} />
      ) : errorMessage ? (
        <HomePanelState message={errorMessage} tone="error" />
      ) : items.length === 0 ? (
        <HomePanelState message={t('home.trending.empty')} />
      ) : (
        <div className="home-activity-list">
          {items.map(review => (
            <article key={review.id} className="home-activity-card home-trending-review-card">
              <div className="home-activity-top">
                <Link to={getPublicProfilePath(review.author.username)} className="home-user-chip">
                  <UserAvatar
                    name={review.author.name}
                    avatarPath={review.author.avatarPath}
                    imageClassName="home-user-avatar"
                    fallbackClassName="home-user-avatar-fallback"
                  />

                  <div>
                    <strong>{review.author.name}</strong>
                    <span>{formatCompactDate(review.publishedAt)}</span>
                  </div>
                </Link>

                <span className="home-like-pill">{getLikeLabel(review.likesCount, t)}</span>
              </div>

              <div className="home-card-title-row">
                <h4 className="home-card-title-heading">
                  <Link to={`/games/${review.game.id}`} className="home-card-title-link">
                    {review.game.title}
                  </Link>
                </h4>
                {review.score !== null ? (
                  <span className="home-score-pill">{review.score}/10</span>
                ) : null}
              </div>

              <p>{review.summary}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
