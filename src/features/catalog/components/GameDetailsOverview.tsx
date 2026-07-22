import { GameCoverImage } from '../../../components/GameCoverImage'
import RatingCircle from '../../../components/RatingCircle'
import { useI18n } from '../../../i18n/I18nContext'
import type { CatalogGameDetails } from '../../../services/gameCatalogService'
import {
  GameDetailsUserActions,
  type GameDetailsUserActionsProps,
} from './GameDetailsUserActions'

export interface GameDetailsOverviewProps {
  game: CatalogGameDetails
  summary: {
    average: number | null
    reviews: number
    comments: number
  }
  userActions: GameDetailsUserActionsProps
}

function normalizeGameList(value: string[] | string | null | undefined) {
  if (!value) return []
  return Array.isArray(value) ? value.filter(Boolean) : [value]
}

function formatGameList(value: string[] | string | null | undefined, fallback: string) {
  const items = normalizeGameList(value)
  return items.length > 0 ? items.join(', ') : fallback
}

function getGameTitleInitial(name: string) {
  const firstCharacter = name.trim().charAt(0)
  return firstCharacter ? firstCharacter.toUpperCase() : 'U'
}

export function GameDetailsOverview({
  game,
  summary,
  userActions,
}: GameDetailsOverviewProps) {
  const { t, formatDate, formatNumber, locale } = useI18n()
  const genres = normalizeGameList(game.generos)
  const releaseDate = formatDate(game.data_lancamento, {
    fallback: t('common.notProvided'),
  })
  const description = game.description?.trim() || t('game.details.noDescription')
  const averageRatingLabel = summary.average !== null
    ? formatNumber(summary.average, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
    : t('game.details.noRatingYet')
  const totalReviewsLabel = summary.reviews === 1
    ? t('game.details.totalReviews.one')
    : t('game.details.totalReviews.many', { count: formatNumber(summary.reviews) })
  const totalCommentsLabel = summary.comments === 1
    ? t('game.details.comments.one')
    : t('game.details.comments.many', { count: formatNumber(summary.comments) })
  const ratingAriaLabel = summary.average === null
    ? t('catalog.noRatingFor', { title: game.titulo })
    : t('catalog.averageFor', {
        rating: averageRatingLabel,
        title: game.titulo,
      })

  return (
    <>
      <section className="game-details-hero">
        <div className="game-details-hero-glow game-details-hero-glow-left"></div>
        <div className="game-details-hero-glow game-details-hero-glow-right"></div>

        <div className="game-details-hero-grid">
          <div className="game-details-cover-card">
            {game.capa_url ? (
              <GameCoverImage
                src={game.capa_url}
                alt={t('catalog.coverAlt', { title: game.titulo })}
                className="game-details-cover-image"
                width={320}
                height={480}
                sizes="(max-width: 480px) 280px, (max-width: 900px) 320px, 320px"
                eager
              />
            ) : (
              <div className="game-details-cover-fallback">
                <span>{getGameTitleInitial(game.titulo)}</span>
              </div>
            )}

            <div className="game-details-cover-top">
              <span className="game-details-pill">{t('game.details.catalogBadge')}</span>
              <span className="game-details-cover-date">{releaseDate}</span>
            </div>

            <div className="game-details-cover-bottom">
              <div className="game-details-score-chip">
                <RatingCircle
                  value={summary.average}
                  size={48}
                  strokeWidth={4}
                  ariaLabel={ratingAriaLabel}
                  locale={locale}
                />
                <span className="game-details-score-copy">
                  <span className="game-details-score-label">
                    {t('game.details.averageRating')}
                  </span>
                  <strong>
                    {summary.average !== null ? `${averageRatingLabel}/10` : averageRatingLabel}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          <div className="game-details-hero-copy">
            <span className="game-details-eyebrow">{t('game.details.gameDetails')}</span>
            <h1>{game.titulo}</h1>

            <div className="game-details-chip-section">
              <span className="game-details-chip-label">{t('game.details.categories')}</span>

              <div className="game-details-chip-row">
                {genres.length > 0 ? (
                  genres.map(genre => (
                    <span key={genre} className="genre-chip game-details-chip">
                      {genre}
                    </span>
                  ))
                ) : (
                  <span className="game-details-muted-chip">
                    {t('game.details.genreMissing')}
                  </span>
                )}
              </div>
            </div>

            <GameDetailsUserActions {...userActions} />
          </div>
        </div>
      </section>

      <section className="game-details-highlights" aria-label={t('game.details.gameDetails')}>
        <article className="game-details-highlight-card">
          <span className="game-details-highlight-label">{t('game.details.developer')}</span>
          <strong>{formatGameList(game.desenvolvedora, t('common.notProvided'))}</strong>
        </article>

        <article className="game-details-highlight-card">
          <span className="game-details-highlight-label">{t('game.details.platforms')}</span>
          <strong>{formatGameList(game.plataformas, t('common.notProvidedPlural'))}</strong>
        </article>

        <article className="game-details-highlight-card">
          <span className="game-details-highlight-label">{t('game.details.releaseDate')}</span>
          <strong>{releaseDate}</strong>
        </article>

        <article className="game-details-highlight-card">
          <span className="game-details-highlight-label">{t('game.details.community')}</span>
          <strong>
            {summary.average !== null
              ? `${averageRatingLabel}/10`
              : t('game.details.noRatingYet')}
          </strong>
          <small>{`${totalReviewsLabel} | ${totalCommentsLabel}`}</small>
        </article>
      </section>

      <section className="game-details-info-grid">
        <article className="game-details-panel game-details-panel-full">
          <span className="game-details-panel-kicker">{t('game.details.description')}</span>
          <h2>{t('game.details.aboutTitle')}</h2>
          <p className="game-details-description-body">{description}</p>
          {game.descriptionFallback ? (
            <p className="game-details-description-note">
              {t('game.details.descriptionFallbackEnglish')}
            </p>
          ) : null}
        </article>
      </section>
    </>
  )
}
