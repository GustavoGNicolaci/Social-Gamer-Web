import { Link } from 'react-router-dom'
import type { ProfileReviewItem } from '../../services/reviewService'
import './ProfileReviewsSection.css'

interface ProfileReviewsSectionProps {
  items: ProfileReviewItem[]
  isLoading: boolean
  errorMessage: string | null
  countLabel: string
  isOwnerView: boolean
}

function formatCompactDate(value: string | null | undefined, fallback = 'Data nao informada') {
  if (!value) return fallback

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return fallback

  return parsedDate.toLocaleDateString('pt-BR', {
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
  return `${score.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}/10`
}

export function ProfileReviewsSection({
  items,
  isLoading,
  errorMessage,
  countLabel,
  isOwnerView,
}: ProfileReviewsSectionProps) {
  const hasReviews = items.length > 0

  return (
    <section className="profile-card profile-reviews-section">
      <div className="profile-card-glow profile-card-glow-left"></div>
      <div className="profile-card-glow profile-card-glow-right"></div>

      <div className="profile-reviews-content">
        <div className="profile-section-head">
          <div className="profile-section-copy">
            <span className="profile-section-label">Reviews</span>
            <h2>Seu historico de avaliacoes do catalogo</h2>
            <p>
              Consulte rapidamente as notas que voce ja publicou e volte para qualquer jogo com um clique.
            </p>
          </div>

          <div className="profile-meta-item profile-reviews-summary">
            <span>Total publicado</span>
            <strong>{isLoading ? '...' : countLabel}</strong>
          </div>
        </div>

        {isLoading ? (
          <div className="profile-reviews-empty">
            <h3>Carregando suas reviews</h3>
            <p>Estamos reunindo as avaliacoes que voce publicou no catalogo.</p>
          </div>
        ) : errorMessage ? (
          <div className="profile-reviews-empty">
            <h3>Ocorreu um problema ao carregar suas reviews</h3>
            <p>{errorMessage}</p>
          </div>
        ) : !hasReviews ? (
          <div className="profile-reviews-empty">
            <h3>
              {isOwnerView
                ? 'Voce ainda nao publicou nenhuma review'
                : 'Este perfil ainda nao publicou nenhuma review'}
            </h3>
            <p>
              {isOwnerView
                ? 'Quando voce avaliar um jogo com nota ou comentario, ele vai aparecer aqui.'
                : 'Quando este usuario publicar reviews, elas vao aparecer aqui.'}
            </p>
            {isOwnerView ? (
              <Link to="/games" className="profile-secondary-button profile-reviews-link">
                Explorar jogos
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="profile-reviews-grid">
            {items.map(review => {
              const visibleTitle = review.jogo?.titulo || 'Jogo indisponivel'

              return (
                <article key={review.id} className="profile-reviews-card">
                  <Link to={`/games/${review.jogo_id}`} className="profile-reviews-card-link">
                    <div className="profile-reviews-card-cover">
                      {review.jogo?.capa_url ? (
                        <img
                          src={review.jogo.capa_url}
                          alt={`Capa do jogo ${visibleTitle}`}
                        />
                      ) : (
                        <div className="profile-reviews-card-fallback">{getInitial(visibleTitle)}</div>
                      )}
                    </div>

                    <div className="profile-reviews-card-body">
                      <div className="profile-reviews-card-meta">
                        <span className="profile-reviews-score-pill">
                          Nota {formatScoreLabel(review.nota)}
                        </span>
                        <span className="profile-reviews-date">
                          Avaliado em {formatCompactDate(review.data_publicacao)}
                        </span>
                      </div>

                      <h3>{visibleTitle}</h3>

                      {review.texto_review ? (
                        <p className="profile-reviews-comment">{review.texto_review}</p>
                      ) : (
                        <p className="profile-reviews-comment is-empty">
                          Review sem comentario. Apenas a nota foi registrada.
                        </p>
                      )}

                      <span className="profile-reviews-cta">Ver detalhes do jogo</span>
                    </div>
                  </Link>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
