import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../supabase-client'
import './HomePage.css'

interface Game {
  id: number
  titulo: string
  capa_url: string | null
  generos: string[] | string | null
}

interface Activity {
  id: string
  type: 'review' | 'comment'
  authorName: string
  authorAvatar: string | null
  gameTitle: string
  text: string
  score: number | null
  publishedAt: string
}

interface SiteStats {
  games: number
  reviews: number
  comments: number
}

interface UserSummary {
  username: string
  avatar_url: string | null
}

interface GameTitleRelation {
  titulo: string
}

interface ReviewRow {
  id: string
  texto_review: string | null
  nota: number | null
  data_publicacao: string
  jogos: GameTitleRelation | GameTitleRelation[] | null
  usuarios: UserSummary | UserSummary[] | null
}

interface CommentReviewRelation {
  jogos: GameTitleRelation | GameTitleRelation[] | null
}

interface CommentRow {
  id: string
  texto: string
  data_comentario: string
  usuarios: UserSummary | UserSummary[] | null
  avaliacoes: CommentReviewRelation | CommentReviewRelation[] | null
}

function resolveRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function normalizeList(value: string[] | string | null | undefined) {
  if (!value) return []
  return (Array.isArray(value) ? value : [value]).map(item => item.trim()).filter(Boolean)
}

function formatCompactDate(value: string | null | undefined, fallback = 'Agora') {
  if (!value) return fallback

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return fallback

  return parsedDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  })
}

function formatCount(value: number) {
  return value.toLocaleString('pt-BR')
}

function getInitial(value: string) {
  const firstCharacter = value.trim().charAt(0)
  return firstCharacter ? firstCharacter.toUpperCase() : 'U'
}

function truncateText(value: string | null | undefined, maxLength = 96) {
  const normalizedValue = value?.trim() || ''

  if (!normalizedValue) return 'Nova atividade publicada na comunidade.'
  if (normalizedValue.length <= maxLength) return normalizedValue

  return `${normalizedValue.slice(0, maxLength - 3).trim()}...`
}

function iconCatalog() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6.5C4 5.11929 5.11929 4 6.5 4H19C19.5523 4 20 4.44772 20 5V17.5C20 18.8807 18.8807 20 17.5 20H6.5C5.11929 20 4 18.8807 4 17.5V6.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M8 8H16M8 12H16M8 16H12"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function iconReview() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3L14.7807 8.63322L21 9.52786L16.5 13.9139L17.5614 20.1088L12 17.1832L6.43853 20.1088L7.5 13.9139L3 9.52786L9.21926 8.63322L12 3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function iconWishlist() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 20L5.4 13.7C3.2 11.6 3.2 8.2 5.4 6.1C7.1 4.5 9.8 4.5 11.5 6.1L12 6.6L12.5 6.1C14.2 4.5 16.9 4.5 18.6 6.1C20.8 8.2 20.8 11.6 18.6 13.7L12 20Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function HomePage() {
  const { user, profile } = useAuth()
  const [recentActivities, setRecentActivities] = useState<Activity[]>([])
  const [trendingGames, setTrendingGames] = useState<Game[]>([])
  const [siteStats, setSiteStats] = useState<SiteStats>({
    games: 0,
    reviews: 0,
    comments: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const fetchData = async () => {
      try {
        const [
          reviewsResponse,
          commentsResponse,
          featuredGamesResponse,
          gameCountResponse,
          reviewCountResponse,
          commentCountResponse,
        ] = await Promise.all([
          supabase
            .from('avaliacoes')
            .select(`
              id,
              texto_review,
              nota,
              data_publicacao,
              jogos!inner(titulo),
              usuarios!inner(username, avatar_url)
            `)
            .order('data_publicacao', { ascending: false })
            .limit(6),
          supabase
            .from('comentarios')
            .select(`
              id,
              texto,
              data_comentario,
              usuarios!inner(username, avatar_url),
              avaliacoes!inner(
                jogos!inner(titulo)
              )
            `)
            .order('data_comentario', { ascending: false })
            .limit(6),
          supabase
            .from('jogos')
            .select('id, titulo, capa_url, generos')
            .order('id', { ascending: false })
            .limit(3),
          supabase.from('jogos').select('id', { count: 'exact', head: true }),
          supabase.from('avaliacoes').select('id', { count: 'exact', head: true }),
          supabase.from('comentarios').select('id', { count: 'exact', head: true }),
        ])

        if (!isMounted) return

        if (reviewsResponse.error) {
          console.error('Erro ao buscar avaliacoes recentes:', reviewsResponse.error)
        }

        if (commentsResponse.error) {
          console.error('Erro ao buscar comentarios recentes:', commentsResponse.error)
        }

        if (featuredGamesResponse.error) {
          console.error('Erro ao buscar jogos em destaque:', featuredGamesResponse.error)
        }

        const reviewActivities = ((reviewsResponse.data || []) as ReviewRow[]).map(review => {
          const reviewGame = resolveRelation(review.jogos)
          const reviewUser = resolveRelation(review.usuarios)

          return {
            id: review.id,
            type: 'review' as const,
            authorName: reviewUser?.username || 'Usuario',
            authorAvatar: reviewUser?.avatar_url || null,
            gameTitle: reviewGame?.titulo || 'Jogo desconhecido',
            text: truncateText(review.texto_review || 'Nova avaliacao publicada.'),
            score: review.nota ?? null,
            publishedAt: review.data_publicacao,
          }
        })

        const commentActivities = ((commentsResponse.data || []) as CommentRow[]).map(comment => {
          const commentUser = resolveRelation(comment.usuarios)
          const relatedReview = resolveRelation(comment.avaliacoes)
          const relatedGame = resolveRelation(relatedReview?.jogos)

          return {
            id: comment.id,
            type: 'comment' as const,
            authorName: commentUser?.username || 'Usuario',
            authorAvatar: commentUser?.avatar_url || null,
            gameTitle: relatedGame?.titulo || 'uma avaliacao',
            text: truncateText(comment.texto, 88),
            score: null,
            publishedAt: comment.data_comentario,
          }
        })

        const mergedActivities = [...reviewActivities, ...commentActivities]
          .sort(
            (leftActivity, rightActivity) =>
              new Date(rightActivity.publishedAt).getTime() -
              new Date(leftActivity.publishedAt).getTime()
          )
          .slice(0, 4)

        setRecentActivities(mergedActivities)
        setTrendingGames(((featuredGamesResponse.data || []) as Game[]) || [])
        setSiteStats({
          games: gameCountResponse.count || 0,
          reviews: reviewCountResponse.count || 0,
          comments: commentCountResponse.count || 0,
        })
      } catch (error) {
        console.error('Erro ao montar a Home:', error)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void fetchData()

    return () => {
      isMounted = false
    }
  }, [])

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-content home-page">
          <section className="home-state-card">
            <span className="home-eyebrow">Home</span>
            <h1>Carregando...</h1>
            <p>Preparando seus destaques e atalhos principais.</p>
          </section>
        </div>
      </div>
    )
  }

  const heroEyebrow = user && profile?.username ? `Bem-vindo, @${profile.username}` : 'Social Gamer'
  const secondaryAction = user
    ? { to: '/profile', label: 'Meu perfil' }
    : { to: '/register', label: 'Criar conta' }
  const featuredGame = trendingGames[0] || null
  const featuredGenres = normalizeList(featuredGame?.generos).slice(0, 2).join(', ')

  const heroStats = [
    { value: formatCount(siteStats.games), label: 'jogos' },
    { value: formatCount(siteStats.reviews), label: 'reviews' },
    { value: formatCount(siteStats.comments), label: 'comentarios' },
  ]

  const featureCards: Array<{
    title: string
    description: string
    ctaLabel: string
    ctaTo: string
    icon: ReactNode
  }> = [
    {
      title: 'Explorar jogos',
      description: 'Busque e filtre o catalogo em poucos cliques.',
      ctaLabel: 'Abrir catalogo',
      ctaTo: '/games',
      icon: iconCatalog(),
    },
    {
      title: 'Ver opinioes',
      description: 'Leia reviews e comentarios direto na pagina de cada jogo.',
      ctaLabel: 'Ver jogos',
      ctaTo: '/games',
      icon: iconReview(),
    },
    {
      title: 'Salvar favoritos',
      description: 'Monte sua wishlist e deixe seu perfil pronto para voltar depois.',
      ctaLabel: user ? 'Abrir perfil' : 'Entrar agora',
      ctaTo: user ? '/profile' : '/login',
      icon: iconWishlist(),
    },
  ]

  return (
    <div className="page-container">
      <div className="page-content home-page">
        <section className="home-hero">
          <div className="home-hero-copy">
            <span className="home-eyebrow">{heroEyebrow}</span>
            <h1>Descubra jogos e guarde o que vale sua proxima jogatina.</h1>
            <p className="home-hero-text">
              Explore o catalogo, veja o que a comunidade achou e organize sua lista com mais
              clareza.
            </p>

            <div className="home-hero-actions">
              <Link to="/games" className="home-button home-button-primary">
                Explorar jogos
              </Link>
              <Link to={secondaryAction.to} className="home-button home-button-secondary">
                {secondaryAction.label}
              </Link>
            </div>

            <div className="home-stats" aria-label="Numeros da plataforma">
              {heroStats.map(stat => (
                <article key={stat.label} className="home-stat-card">
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </article>
              ))}
            </div>
          </div>

          <div className="home-hero-side">
            <article className="home-hero-card">
              <span className="home-eyebrow">Destaque</span>
              <h2>{featuredGame?.titulo || 'Catalogo pronto para explorar'}</h2>
              <p>
                {featuredGame
                  ? featuredGenres || 'Veja detalhes, reviews e comentarios da comunidade.'
                  : 'Entre no catalogo para encontrar seu proximo jogo.'}
              </p>

              {featuredGame ? (
                <Link to={`/games/${featuredGame.id}`} className="home-inline-link">
                  Ver pagina do jogo
                </Link>
              ) : (
                <Link to="/games" className="home-inline-link">
                  Ir para o catalogo
                </Link>
              )}
            </article>
          </div>
        </section>

        <section className="home-section">
          <div className="home-section-head">
            <div>
              <span className="home-eyebrow">Essencial</span>
              <h2>O que voce pode fazer aqui</h2>
            </div>
          </div>

          <div className="home-feature-grid">
            {featureCards.map(feature => (
              <article key={feature.title} className="home-feature-card">
                <div className="home-feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                <Link to={feature.ctaTo} className="home-inline-link">
                  {feature.ctaLabel}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section">
          <div className="home-section-head">
            <div>
              <span className="home-eyebrow">Agora na plataforma</span>
              <h2>Jogos e atividade recente</h2>
            </div>
          </div>

          <div className="home-grid">
            <div className="home-panel">
              <h3 className="home-panel-title">Jogos em destaque</h3>

              {trendingGames.length === 0 ? (
                <div className="home-empty-state">
                  <p>Nenhum jogo disponivel no momento.</p>
                </div>
              ) : (
                <div className="home-spotlight-list">
                  {trendingGames.map(game => (
                    <Link key={game.id} to={`/games/${game.id}`} className="home-spotlight-card">
                      <div className="home-spotlight-cover">
                        {game.capa_url ? (
                          <img src={game.capa_url} alt={`Capa do jogo ${game.titulo}`} />
                        ) : (
                          <div className="home-spotlight-fallback">{getInitial(game.titulo)}</div>
                        )}
                      </div>

                      <div className="home-spotlight-copy">
                        <h3>{game.titulo}</h3>
                        <p>{normalizeList(game.generos).slice(0, 2).join(', ') || 'Sem genero informado'}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="home-panel">
              <h3 className="home-panel-title">Movimento recente</h3>

              {recentActivities.length === 0 ? (
                <div className="home-empty-state">
                  <p>As novas reviews e comentarios vao aparecer aqui.</p>
                </div>
              ) : (
                <div className="home-activity-list">
                  {recentActivities.map(activity => (
                    <article key={`${activity.type}-${activity.id}`} className="home-activity-card">
                      <div className="home-activity-top">
                        <div className="home-user-chip">
                          {activity.authorAvatar ? (
                            <img
                              src={activity.authorAvatar}
                              alt={`Avatar de ${activity.authorName}`}
                              className="home-user-avatar"
                            />
                          ) : (
                            <span className="home-user-avatar home-user-avatar-fallback">
                              {getInitial(activity.authorName)}
                            </span>
                          )}

                          <div>
                            <strong>{activity.authorName}</strong>
                            <span>{formatCompactDate(activity.publishedAt)}</span>
                          </div>
                        </div>

                        {activity.score !== null ? (
                          <span className="home-score-pill">{activity.score}/10</span>
                        ) : (
                          <span className="home-tag">Comentario</span>
                        )}
                      </div>

                      <h4>{activity.gameTitle}</h4>
                      <p>{activity.text}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default HomePage
