import { Link } from 'react-router-dom'
import { ContentReportModal } from '../../../components/reviews/ContentReportModal'
import { useI18n } from '../../../i18n/I18nContext'
import { REVIEW_SCORE_OPTIONS } from '../domain/reviewConstants'
import {
  getInitialVisibleCommentCount,
  type GameReviewsSectionController,
} from '../hooks/gameReviewControllerContracts'
import { GameReviewCard } from './GameReviewCard'

export type GameReviewsSectionProps = GameReviewsSectionController

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
      <section id="game-community" className="game-details-reviews">
        <div className="game-details-section-heading">
          <div>
            <span className="game-details-panel-kicker">{t('game.details.community')}</span>
            <h2>{t('game.details.reviewsHeading')}</h2>
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
              <label className="game-details-form-label">{t('game.details.yourScore')}</label>
              <div
                className="game-details-rating-grid"
                role="radiogroup"
                aria-label={t('game.details.scoreAria')}
              >
                {REVIEW_SCORE_OPTIONS.map(scoreOption => (
                  <button
                    key={scoreOption}
                    type="button"
                    className={`game-details-rating-button${score === scoreOption ? ' is-selected' : ''}`}
                    onClick={() => setScore(scoreOption)}
                    aria-pressed={score === scoreOption}
                  >
                    {scoreOption}
                  </button>
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
          <p className={`game-details-feedback is-${formFeedback.tone}`}>
            {formFeedback.message}
          </p>
        ) : null}

        <div className="game-details-review-list">
          {error && total === 0 ? (
            <div className="game-details-empty-card">
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
