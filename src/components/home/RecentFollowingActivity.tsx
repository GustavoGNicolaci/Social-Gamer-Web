import { Link } from 'react-router-dom'
import { UserAvatar } from '../UserAvatar'
import type { HomeFollowingActivity } from '../../services/homeService'
import { getPublicProfilePath } from '../../utils/profileRoutes'
import { formatCompactDate } from './homeDisplayUtils'

interface RecentFollowingActivityProps {
  items: HomeFollowingActivity[]
  isLoading: boolean
  errorMessage: string | null
  isAuthenticated: boolean
}

function getActivityTag(activity: HomeFollowingActivity) {
  if (activity.type === 'review') return 'Review'
  if (activity.isFavorite) return 'Favorito'
  return activity.statusValue || 'Status'
}

export function RecentFollowingActivity({
  items,
  isLoading,
  errorMessage,
  isAuthenticated,
}: RecentFollowingActivityProps) {
  return (
    <div className="home-panel">
      <div className="home-panel-heading">
        <div>
          <h3 className="home-panel-title">Atividades de quem voce segue</h3>
          <p>Reviews e jogos adicionados pelos perfis que fazem parte da sua rede.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="home-empty-state">
          <p>Buscando atividades recentes...</p>
        </div>
      ) : errorMessage ? (
        <div className="home-empty-state is-error">
          <p>{errorMessage}</p>
        </div>
      ) : !isAuthenticated ? (
        <div className="home-empty-state">
          <p>Entre para ver as atividades das pessoas que voce segue.</p>
          <Link to="/login" className="home-inline-link">
            Fazer login
          </Link>
        </div>
      ) : items.length === 0 ? (
        <div className="home-empty-state">
          <p>Quando pessoas que voce segue publicarem reviews ou adicionarem jogos, tudo aparece aqui.</p>
        </div>
      ) : (
        <div className="home-activity-list">
          {items.map(activity => (
            <article key={activity.id} className="home-activity-card">
              <div className="home-activity-top">
                <Link
                  to={getPublicProfilePath(activity.author.username)}
                  className="home-user-chip"
                >
                  <UserAvatar
                    name={activity.author.name}
                    avatarPath={activity.author.avatarPath}
                    imageClassName="home-user-avatar"
                    fallbackClassName="home-user-avatar-fallback"
                  />

                  <div>
                    <strong>{activity.author.name}</strong>
                    <span>{formatCompactDate(activity.createdAt)}</span>
                  </div>
                </Link>

                {activity.score !== null ? (
                  <span className="home-score-pill">{activity.score}/10</span>
                ) : (
                  <span className="home-tag">{getActivityTag(activity)}</span>
                )}
              </div>

              <Link to={`/games/${activity.game.id}`} className="home-card-title-link">
                {activity.game.title}
              </Link>
              <p>{activity.summary}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
