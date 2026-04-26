import { Link } from 'react-router-dom'
import { UserAvatar } from '../UserAvatar'
import type { HomeTrendingReview } from '../../services/homeService'
import { useI18n } from '../../i18n/I18nContext'
import { getPublicProfilePath } from '../../utils/profileRoutes'
import { formatCompactDate, formatCount } from './homeDisplayUtils'

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
        <div className="home-empty-state">
          <p>{t('home.trending.loading')}</p>
        </div>
      ) : errorMessage ? (
        <div className="home-empty-state is-error">
          <p>{errorMessage}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="home-empty-state">
          <p>{t('home.trending.empty')}</p>
        </div>
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
                <Link to={`/games/${review.game.id}`} className="home-card-title-link">
                  {review.game.title}
                </Link>
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
