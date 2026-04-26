import { Link } from 'react-router-dom'
import { GameCoverImage } from '../GameCoverImage'
import type { HomeFeaturedGame } from '../../services/homeService'
import { useI18n } from '../../i18n/I18nContext'
import { formatCompactDate, formatRating, getInitial } from './homeDisplayUtils'

interface FeaturedRecentReviewedGamesProps {
  items: HomeFeaturedGame[]
  isLoading: boolean
  errorMessage: string | null
}

function getReviewCountLabel(game: HomeFeaturedGame, t: ReturnType<typeof useI18n>['t']) {
  const count = game.recentReviewCount || game.totalReviewCount

  if (count === 1) return t('home.featured.recentOne')
  if (game.recentReviewCount > 0) return t('home.featured.recentMany', { count })
  if (count > 0) return t('home.featured.totalMany', { count })

  return t('home.featured.catalog')
}

export function FeaturedRecentReviewedGames({
  items,
  isLoading,
  errorMessage,
}: FeaturedRecentReviewedGamesProps) {
  const { t } = useI18n()

  return (
    <div className="home-panel">
      <div className="home-panel-heading">
        <div>
          <h3 className="home-panel-title">{t('home.featured.title')}</h3>
          <p>{t('home.featured.description')}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="home-empty-state">
          <p>{t('home.featured.loading')}</p>
        </div>
      ) : errorMessage ? (
        <div className="home-empty-state is-error">
          <p>{errorMessage}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="home-empty-state">
          <p>{t('home.featured.empty')}</p>
        </div>
      ) : (
        <div className="home-spotlight-list">
          {items.map(game => {
            const averageRating = formatRating(game.averageRating)

            return (
              <Link key={game.id} to={`/games/${game.id}`} className="home-spotlight-card">
                <div className="home-spotlight-cover">
                  {game.coverUrl ? (
                    <GameCoverImage
                      src={game.coverUrl}
                      alt={t('catalog.coverAlt', { title: game.title })}
                      width={152}
                      height={192}
                      sizes="76px"
                    />
                  ) : (
                    <div className="home-spotlight-fallback">{getInitial(game.title)}</div>
                  )}
                </div>

                <div className="home-spotlight-copy">
                  <h3>{game.title}</h3>
                  <p>{game.genres.slice(0, 2).join(', ') || t('common.noGenreProvided')}</p>
                  <div className="home-spotlight-meta">
                    <span>{getReviewCountLabel(game, t)}</span>
                    {averageRating ? <span>{t('home.featured.average', { rating: averageRating })}</span> : null}
                    {game.latestReviewAt ? (
                      <span>{t('home.featured.latest', { date: formatCompactDate(game.latestReviewAt) })}</span>
                    ) : null}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
