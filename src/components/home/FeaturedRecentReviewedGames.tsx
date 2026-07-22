import { Link } from 'react-router-dom'
import { GameCoverImage } from '../GameCoverImage'
import type { HomeFeaturedGame } from '../../services/homeService'
import { useI18n } from '../../i18n/I18nContext'
import { formatCompactDate, formatRating, getInitial } from './homeDisplayUtils'
import { HomePanelState } from './HomePanelState'

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
        <HomePanelState message={t('home.featured.loading')} tone="loading" rows={4} />
      ) : errorMessage ? (
        <HomePanelState message={errorMessage} tone="error" />
      ) : items.length === 0 ? (
        <HomePanelState message={t('home.featured.empty')} />
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
                  <h4>{game.title}</h4>
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
