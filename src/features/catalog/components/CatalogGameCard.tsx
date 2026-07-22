import { memo } from 'react'
import { Link } from 'react-router-dom'
import { GameCoverImage } from '../../../components/GameCoverImage'
import RatingCircle from '../../../components/RatingCircle'
import { useI18n } from '../../../i18n/I18nContext'
import type { CatalogGamePreview } from '../domain/catalogTypes'

interface CatalogGameCardProps {
  game: CatalogGamePreview
  onShowGenres: (genres: string[]) => void
}

function normalizeList(value: string[] | string | null | undefined) {
  if (!value) return []
  return (Array.isArray(value) ? value : [value]).map(item => item.trim()).filter(Boolean)
}

function formatList(value: string[] | string | null | undefined, fallback: string) {
  const items = normalizeList(value)
  return items.length > 0 ? items.join(', ') : fallback
}

function initial(value: string) {
  const first = value.trim().charAt(0)
  return first ? first.toUpperCase() : 'J'
}

export const CatalogGameCard = memo(function CatalogGameCard({
  game,
  onShowGenres,
}: CatalogGameCardProps) {
  const { t, locale, formatDate, formatNumber } = useI18n()
  const genres = normalizeList(game.generos)
  const displayedGenres = genres.slice(0, 2)
  const hasMoreGenres = genres.length > 2
  const averageRating = game.averageRating ?? null
  const developerLabel = formatList(game.desenvolvedora, t('common.notProvided'))
  const platformLabel = formatList(game.plataformas, t('common.notProvidedPlural'))
  const ratingAriaLabel =
    averageRating === null
      ? t('catalog.noRatingFor', { title: game.titulo })
      : t('catalog.averageFor', {
          rating: formatNumber(averageRating, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 1,
          }),
          title: game.titulo,
        })

  return (
    <article className="gp-game">
      <Link to={`/games/${game.id}`} className="gp-cover">
        {game.capa_url ? (
          <GameCoverImage
            src={game.capa_url}
            alt={t('catalog.coverAlt', { title: game.titulo })}
            width={320}
            height={480}
            sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, (max-width: 992px) 33vw, (max-width: 1200px) 25vw, 20vw"
          />
        ) : (
          <div className="gp-fallback">{initial(game.titulo)}</div>
        )}

        <div className="gp-cover-top">
          <span className="gp-date">
            {formatDate(game.data_lancamento, {
              fallback: t('common.notProvided'),
            })}
          </span>
        </div>

        <div className="gp-cover-rating">
          <RatingCircle value={averageRating} size={52} ariaLabel={ratingAriaLabel} locale={locale} />
        </div>
      </Link>

      <div className="gp-game-body">
        <div className="gp-game-head">
          <Link
            to={`/games/${game.id}`}
            className="gp-game-details-link"
            aria-label={`${game.titulo} — ${t('common.viewDetails')}`}
          >
            <h3 title={game.titulo}>{game.titulo}</h3>
            <span className="gp-details-cta">
              {t('common.viewDetails')}
            </span>
          </Link>
        </div>

        <div className="gp-tags">
          {displayedGenres.length > 0 ? (
            displayedGenres.map(genre => (
              <span key={genre} className="genre-chip gp-tag">
                {genre}
              </span>
            ))
          ) : (
            <span className="gp-muted">{t('catalog.noGenres')}</span>
          )}

          {hasMoreGenres ? (
            <button
              type="button"
              className="gp-more"
              onClick={() => onShowGenres(genres)}
              aria-haspopup="dialog"
              aria-label={t('catalog.showAllGenresFor', { title: game.titulo })}
            >
              +{genres.length - displayedGenres.length}
            </button>
          ) : null}
        </div>

        <div className="gp-meta">
          <div className="gp-meta-row">
            <span>{t('common.studio')}</span>
            <strong title={developerLabel}>{developerLabel}</strong>
          </div>
          <div className="gp-meta-row">
            <span>{t('common.platforms')}</span>
            <strong title={platformLabel}>{platformLabel}</strong>
          </div>
        </div>
      </div>
    </article>
  )
})
