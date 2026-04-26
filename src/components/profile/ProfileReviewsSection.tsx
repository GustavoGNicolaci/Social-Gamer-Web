import { memo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GameCoverImage } from '../GameCoverImage'
import type { ProfileReviewItem } from '../../services/reviewService'
import { formatLocalizedDate, formatLocalizedNumber } from '../../i18n'
import { useI18n } from '../../i18n/I18nContext'
import './ProfileReviewsSection.css'

interface ProfileReviewsSectionProps {
  items: ProfileReviewItem[]
  isLoading: boolean
  errorMessage: string | null
  countLabel: string
  totalCount: number | null
  hasMore: boolean
  isLoadingMore: boolean
  isOwnerView: boolean
  onDeleteReview?: (reviewId: string) => Promise<{ ok: boolean; message?: string }>
  onLoadMore: () => Promise<void>
}

function formatCompactDate(value: string | null | undefined, fallback = 'Data nao informada') {
  return formatLocalizedDate(value, {
    fallback,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getInitial(value: string) {
  const firstCharacter = value.trim().charAt(0)
  return firstCharacter ? firstCharacter.toUpperCase() : 'J'
}

function formatScoreLabel(score: number) {
  return `${formatLocalizedNumber(score, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}/10`
}

export const ProfileReviewsSection = memo(function ProfileReviewsSection({
  items,
  isLoading,
  errorMessage,
  countLabel,
  totalCount,
  hasMore,
  isLoadingMore,
  isOwnerView,
  onDeleteReview,
  onLoadMore,
}: ProfileReviewsSectionProps) {
  const { t, formatNumber } = useI18n()
  const [removingReviewIds, setRemovingReviewIds] = useState<string[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const hasReviews = items.length > 0
  const remainingReviewsCount =
    totalCount === null ? 0 : Math.max(totalCount - items.length, 0)

  const handleDeleteReview = async (reviewId: string) => {
    if (!onDeleteReview) return

    setActionError(null)
    setRemovingReviewIds(currentIds =>
      currentIds.includes(reviewId) ? currentIds : [...currentIds, reviewId]
    )

    const result = await onDeleteReview(reviewId)

    setRemovingReviewIds(currentIds => currentIds.filter(currentId => currentId !== reviewId))

    if (!result.ok) {
      setActionError(result.message || t('profileReviews.delete'))
    }
  }

  return (
    <section className="profile-card profile-reviews-section">
      <div className="profile-card-glow profile-card-glow-left"></div>
      <div className="profile-card-glow profile-card-glow-right"></div>

      <div className="profile-reviews-content">
        <div className="profile-section-head">
          <div className="profile-section-copy">
            <span className="profile-section-label">{t('common.reviews')}</span>
            <h2>
              {isOwnerView
                ? t('profileReviews.ownerTitle')
                : t('profileReviews.publicTitle')}
            </h2>
            <p>
              {isOwnerView
                ? t('profileReviews.ownerText')
                : t('profileReviews.publicText')}
            </p>
          </div>

          <div className="profile-meta-item profile-reviews-summary">
            <span>{t('profileReviews.totalPublished')}</span>
            <strong>{isLoading ? t('common.loadingShort') : countLabel}</strong>
          </div>
        </div>

        {isLoading ? (
          <div className="profile-reviews-empty">
            <h3>{isOwnerView ? t('profileReviews.loadingOwner') : t('profileReviews.loadingPublic')}</h3>
            <p>
              {isOwnerView
                ? t('profileReviews.loadingOwnerText')
                : t('profileReviews.loadingPublicText')}
            </p>
            <div className="profile-reviews-skeleton-grid" aria-hidden="true">
              {Array.from({ length: 4 }, (_, index) => (
                <span key={`reviews-skeleton-${index}`} className="profile-reviews-skeleton-card" />
              ))}
            </div>
          </div>
        ) : errorMessage ? (
          <div className="profile-reviews-empty">
            <h3>{t('profileReviews.errorTitle')}</h3>
            <p>{errorMessage}</p>
          </div>
        ) : !hasReviews ? (
          <div className="profile-reviews-empty">
            <h3>
              {isOwnerView
                ? t('profileReviews.emptyOwner')
                : t('profileReviews.emptyPublic')}
            </h3>
            <p>
              {isOwnerView
                ? t('profileReviews.emptyOwnerText')
                : t('profileReviews.emptyPublicText')}
            </p>
            {isOwnerView ? (
              <Link to="/games" className="profile-secondary-button profile-reviews-link">
                {t('common.exploreGames')}
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <div className="profile-reviews-grid">
              {items.map(review => {
              const visibleTitle = review.jogo?.titulo || t('common.gameUnavailable')
              const isRemovingReview = removingReviewIds.includes(review.id)

              return (
                <article
                  key={review.id}
                  className={`profile-reviews-card${isRemovingReview ? ' is-removing' : ''}`}
                >
                  <Link to={`/games/${review.jogo_id}`} className="profile-reviews-card-link">
                    <div className="profile-reviews-card-cover">
                      {review.jogo?.capa_url ? (
                        <GameCoverImage
                          src={review.jogo.capa_url}
                          alt={t('catalog.coverAlt', { title: visibleTitle })}
                          width={360}
                          height={160}
                          sizes="(max-width: 768px) 100vw, 33vw"
                        />
                      ) : (
                        <div className="profile-reviews-card-fallback">{getInitial(visibleTitle)}</div>
                      )}
                    </div>

                    <div className="profile-reviews-card-body">
                      <div className="profile-reviews-card-meta">
                        <span className="profile-reviews-score-pill">
                          {t('profileReviews.score', { score: formatScoreLabel(review.nota) })}
                        </span>
                        <span className="profile-reviews-date">
                          {t('profileReviews.reviewedAt', {
                            date: formatCompactDate(review.data_publicacao, t('profile.dateFallback')),
                          })}
                        </span>
                      </div>

                      <h3>{visibleTitle}</h3>

                      {review.texto_review ? (
                        <p className="profile-reviews-comment">{review.texto_review}</p>
                      ) : (
                        <p className="profile-reviews-comment is-empty">
                          {t('profileReviews.noComment')}
                        </p>
                      )}

                      <span className="profile-reviews-cta">{t('common.viewGameDetails')}</span>
                    </div>
                  </Link>

                  {isOwnerView && onDeleteReview ? (
                    <div className="profile-reviews-card-actions">
                      <button
                        type="button"
                        className="profile-secondary-button profile-reviews-delete-button"
                        onClick={() => void handleDeleteReview(review.id)}
                        disabled={isRemovingReview}
                      >
                        {isRemovingReview ? t('common.deleting') : t('profileReviews.delete')}
                      </button>
                    </div>
                  ) : null}
                </article>
              )
            })}
            </div>

            {hasMore ? (
              <button
                type="button"
                className="profile-secondary-button profile-reviews-link"
                onClick={() => void onLoadMore()}
                disabled={isLoadingMore}
              >
                {isLoadingMore
                  ? t('common.loading')
                  : remainingReviewsCount > 0
                    ? t('profileReviews.moreWithCount', { count: formatNumber(remainingReviewsCount) })
                    : t('profileReviews.more')}
              </button>
            ) : null}
          </>
        )}

        {actionError ? <p className="profile-feedback is-error">{actionError}</p> : null}
      </div>
    </section>
  )
})
