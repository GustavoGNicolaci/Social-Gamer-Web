import { Link } from 'react-router-dom'
import { GameCoverImage } from '../GameCoverImage'
import type { HomeFeaturedGame } from '../../services/homeService'
import { formatCompactDate, formatRating, getInitial } from './homeDisplayUtils'

interface FeaturedRecentReviewedGamesProps {
  items: HomeFeaturedGame[]
  isLoading: boolean
  errorMessage: string | null
}

function getReviewCountLabel(game: HomeFeaturedGame) {
  const count = game.recentReviewCount || game.totalReviewCount

  if (count === 1) return '1 review recente'
  if (game.recentReviewCount > 0) return `${count} reviews recentes`
  if (count > 0) return `${count} reviews no total`

  return 'Catalogo'
}

export function FeaturedRecentReviewedGames({
  items,
  isLoading,
  errorMessage,
}: FeaturedRecentReviewedGamesProps) {
  return (
    <div className="home-panel">
      <div className="home-panel-heading">
        <div>
          <h3 className="home-panel-title">Jogos em destaque</h3>
          <p>Jogos com mais reviews publicadas nos ultimos 30 dias.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="home-empty-state">
          <p>Calculando jogos com reviews recentes...</p>
        </div>
      ) : errorMessage ? (
        <div className="home-empty-state is-error">
          <p>{errorMessage}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="home-empty-state">
          <p>Nenhum jogo recebeu reviews recentes suficientes no momento.</p>
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
                      alt={`Capa do jogo ${game.title}`}
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
                  <p>{game.genres.slice(0, 2).join(', ') || 'Sem genero informado'}</p>
                  <div className="home-spotlight-meta">
                    <span>{getReviewCountLabel(game)}</span>
                    {averageRating ? <span>Media {averageRating}/10</span> : null}
                    {game.latestReviewAt ? (
                      <span>Ultima em {formatCompactDate(game.latestReviewAt)}</span>
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
