import type { KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, MessageSquareText, Star } from 'lucide-react'
import { ContentReportModal } from '../../../components/reviews/ContentReportModal'
import { useI18n } from '../../../i18n/I18nContext'
import { REVIEW_SCORE_OPTIONS } from '../domain/reviewConstants'
import {
  getInitialVisibleCommentCount,
  type GameReviewsSectionController,
} from '../hooks/gameReviewControllerContracts'
import { GameReviewCard } from './GameReviewCard'

export type GameReviewsSectionProps = GameReviewsSectionController

function handleScoreKeyboardNavigation(
  event: KeyboardEvent<HTMLDivElement>,
  currentScore: number,
  setScore: (score: number) => void
) {
  const isPrevious = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
  const isNext = event.key === 'ArrowRight' || event.key === 'ArrowDown'
  const isBoundary = event.key === 'Home' || event.key === 'End'

  if (!isPrevious && !isNext && !isBoundary) return

  event.preventDefault()
  const currentIndex = REVIEW_SCORE_OPTIONS.findIndex(option => option === currentScore)
  const safeCurrentIndex = currentIndex === -1 ? (isPrevious ? 1 : -1) : currentIndex
  const nextIndex = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? REVIEW_SCORE_OPTIONS.length - 1
      : isPrevious
        ? Math.max(safeCurrentIndex - 1, 0)
        : Math.min(safeCurrentIndex + 1, REVIEW_SCORE_OPTIONS.length - 1)
  const nextScore = REVIEW_SCORE_OPTIONS[nextIndex]

  setScore(nextScore)
  event.currentTarget
    .querySelector<HTMLInputElement>(`input[value="${nextScore}"]`)
    ?.focus()
}

export function GameReviewsSection({
  form,
  list,
  report,
  actions,
}: GameReviewsSectionProps) {
  const { t, formatNumber } = useI18n()
  const {
    authenticated,
    score,
    setScore,
    text,
    setText,
    submitting: formSubmitting,
    feedback: formFeedback,
    editing,
    submit,
  } = form
  const {
    userId,
    total,
    visible,
    error,
    commentCounts,
    commentTotals,
    commentText,
    submittingComments,
    pendingReviews,
    pendingComments,
    deletingReviews,
    loadingMoreReviews,
    loadingComments,
    hidden,
  } = list
  const {
    target,
    feedback: reportFeedback,
    submitting: reportSubmitting,
    removing: reportRemoving,
  } = report
  const reviewFormHeading = editing
    ? t('game.details.editReview')
    : t('game.details.writeReview')
  const reviewFormDescription = editing
    ? t('game.details.reviewHelp')
    : t('game.details.reviewPlaceholder')

  return (
    <>
      <section
        id="game-community"
        className="game-details-reviews"
        aria-labelledby="game-reviews-heading"
      >
        <div className="game-details-section-heading">
          <div>
            <span className="game-details-panel-kicker">{t('game.details.community')}</span>
            <h2 id="game-reviews-heading">{t('game.details.reviewsHeading')}</h2>
            <p>{t('game.details.reviewsDescription')}</p>
          </div>
        </div>

        {authenticated ? (
          <form onSubmit={submit} className="game-details-review-form">
            <div className="game-details-review-form-head">
              <div>
                <strong>{reviewFormHeading}</strong>
                <p>{reviewFormDescription}</p>
              </div>
              {editing ? (
                <span className="game-details-review-form-badge">
                  {t('game.details.reviewAlreadyPublished')}
                </span>
              ) : null}
            </div>

            <div className="game-details-form-block">
              <span id="game-review-score-label" className="game-details-form-label">
                <Star size={16} aria-hidden="true" />
                {t('game.details.yourScore')}
              </span>
              <span id="game-review-score-help" className="game-details-visually-hidden">
                {t('game.details.scoreAria')}
              </span>
              <div
                className="game-details-rating-grid"
                role="radiogroup"
                aria-labelledby="game-review-score-label"
                aria-describedby="game-review-score-help"
                onKeyDown={event =>
                  handleScoreKeyboardNavigation(event, score, setScore)
                }
              >
                {REVIEW_SCORE_OPTIONS.map(scoreOption => (
                  <label key={scoreOption} className="game-details-rating-option">
                    <input
                      type="radio"
                      name="game-review-score"
                      value={scoreOption}
                      checked={score === scoreOption}
                      onChange={() => setScore(scoreOption)}
                    />
                    <span>{scoreOption}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="game-details-form-block">
              <label htmlFor="game-review-text" className="game-details-form-label">
                {t('game.details.commentOptional')}{' '}
                <span className="game-details-form-caption">({t('common.optional')})</span>
              </label>
              <textarea
                id="game-review-text"
                className="game-details-textarea"
                value={text}
                onChange={event => setText(event.target.value)}
                placeholder={t('game.details.reviewPlaceholder')}
              />
            </div>

            <div className="game-details-review-form-footer">
              <span className="game-details-form-helper">
                {t('game.details.reviewHelper')}
              </span>
              <button
                type="submit"
                disabled={formSubmitting}
                className="game-button game-details-primary-button game-details-submit-button"
              >
                {formSubmitting
                  ? t('game.details.submittingReview')
                  : editing
                    ? t('game.details.updateReview')
                    : t('game.details.submitReview')}
              </button>
            </div>
          </form>
        ) : (
          <div className="game-details-login-card">
            <div>
              <span className="game-details-panel-kicker">{t('game.details.participate')}</span>
              <h3>{t('game.details.loginToReview')}</h3>
              <p>{t('game.details.loginToReviewText')}</p>
            </div>

            <Link to="/login" className="game-button game-details-primary-button">
              {t('auth.login.submit')}
            </Link>
          </div>
        )}

        {formFeedback ? (
          <p
            className={`game-details-feedback is-${formFeedback.tone}`}
            role={formFeedback.tone === 'error' ? 'alert' : 'status'}
          >
            {formFeedback.message}
          </p>
        ) : null}

        <div className="game-details-review-list">
          {error && total === 0 ? (
            <div className="game-details-empty-card">
              <span className="game-details-empty-icon" aria-hidden="true">
                <AlertCircle size={24} />
              </span>
              <h3>{t('game.details.reviewLoadErrorTitle')}</h3>
              <p>{error}</p>
              <button
                type="button"
                className="game-button game-details-secondary-button"
                onClick={() => void actions.refreshReviews()}
              >
                {t('common.tryAgain')}
              </button>
            </div>
          ) : total === 0 ? (
            <div className="game-details-empty-card">
              <span className="game-details-empty-icon" aria-hidden="true">
                <MessageSquareText size={24} />
              </span>
              <h3>{t('game.details.noReviewsTitle')}</h3>
              <p>{t('game.details.noReviewsText')}</p>
            </div>
          ) : (
            <>
              {visible.map(review => (
                <GameReviewCard
                  key={review.id}
                  review={review}
                  currentUserId={userId}
                  visibleCommentCount={
                    commentCounts[review.id] ??
                    getInitialVisibleCommentCount(review.comentarios.length)
                  }
                  totalCommentCount={commentTotals[review.id] ?? review.comentarios.length}
                  commentText={commentText[review.id] || ''}
                  isSubmittingComment={Boolean(submittingComments[review.id])}
                  isLoadingComments={Boolean(loadingComments[review.id])}
                  isReviewReactionPending={pendingReviews.includes(review.id)}
                  isReviewDeletePending={deletingReviews.includes(review.id)}
                  pendingCommentReactionIds={pendingComments}
                  onToggleReviewLike={actions.reviewLike}
                  onToggleReviewDislike={actions.reviewDislike}
                  onDeleteReview={actions.reviewDelete}
                  onToggleCommentLike={actions.commentLike}
                  onToggleCommentDislike={actions.commentDislike}
                  onDeleteComment={actions.commentDelete}
                  onOpenReportModal={actions.openReport}
                  onExpandComments={actions.expandComments}
                  onSubmitComment={actions.submitComment}
                  onCommentTextChange={(reviewId, value) =>
                    actions.setCommentText(currentComments => ({
                      ...currentComments,
                      [reviewId]: value,
                    }))
                  }
                />
              ))}

              {hidden > 0 ? (
                <button
                  type="button"
                  className="game-details-reviews-expand-button"
                  onClick={() => void actions.expandReviews()}
                  disabled={loadingMoreReviews}
                  aria-label={t('game.details.moreReviewsAria', {
                    count: formatNumber(hidden),
                  })}
                >
                  {t('game.details.moreReviews')}
                </button>
              ) : null}
            </>
          )}
        </div>
      </section>

      {target ? (
        <ContentReportModal
          key={`${target.targetType}-${target.targetId}-${target.currentReport?.id || 'new'}`}
          targetType={target.targetType}
          targetLabel={
            target.targetType === 'review'
              ? t('game.details.reviewTarget', { author: target.authorName })
              : t('game.details.commentTarget', { author: target.authorName })
          }
          currentReport={target.currentReport}
          feedback={reportFeedback}
          isSubmitting={reportSubmitting}
          isRemoving={reportRemoving}
          onClose={actions.closeReport}
          onSubmit={actions.submitReport}
          onRemove={actions.removeReport}
        />
      ) : null}
    </>
  )
}
