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
  data_lancamento: string | null
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

function formatFullDate(value: string | null | undefined, fallback = 'Data nao informada') {
  if (!value) return fallback

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return fallback

  return parsedDate.toLocaleDateString('pt-BR')
}

function formatCount(value: number) {
  return value.toLocaleString('pt-BR')
}

function getInitial(value: string) {
  const firstCharacter = value.trim().charAt(0)
  return firstCharacter ? firstCharacter.toUpperCase() : 'U'
}

function truncateText(value: string | null | undefined, maxLength = 150) {
  const normalizedValue = value?.trim() || ''

  if (!normalizedValue) return 'Compartilhe opinioes, avaliacoes e descubra o que a comunidade anda jogando.'
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

function iconProfile() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M4 20C4 17.2386 7.58172 15 12 15C16.4183 15 20 17.2386 20 20"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function iconCommunity() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8.5 11C10.433 11 12 9.433 12 7.5C12 5.567 10.433 4 8.5 4C6.567 4 5 5.567 5 7.5C5 9.433 6.567 11 8.5 11Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M15.5 10C17.1569 10 18.5 8.65685 18.5 7C18.5 5.34315 17.1569 4 15.5 4C13.8431 4 12.5 5.34315 12.5 7C12.5 8.65685 13.8431 10 15.5 10Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M3.5 19C3.5 16.7909 5.73858 15 8.5 15C11.2614 15 13.5 16.7909 13.5 19"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M12.5 19C12.5 17.3431 13.8431 16 15.5 16C17.1569 16 18.5 17.3431 18.5 19"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function iconPlayers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 6H17C18.1046 6 19 6.89543 19 8V14C19 15.1046 18.1046 16 17 16H13L9 19V16H7C5.89543 16 5 15.1046 5 14V8C5 6.89543 5.89543 6 7 6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M9 10H15M9 13H13"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function iconConnections() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 8H6C4.89543 8 4 8.89543 4 10V14C4 15.1046 4.89543 16 6 16H8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M16 8H18C19.1046 8 20 8.89543 20 10V14C20 15.1046 19.1046 16 18 16H16"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M9 12H15"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M9 9.5H15M9 14.5H15"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
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
            .limit(8),
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
            .limit(8),
          supabase
            .from('jogos')
            .select('id, titulo, capa_url, generos, data_lancamento')
            .order('id', { ascending: false })
            .limit(4),
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
            text: truncateText(
              review.texto_review || 'Compartilhou uma avaliacao com a comunidade.'
            ),
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
            text: truncateText(comment.texto, 132),
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
          .slice(0, 6)

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
            <span className="home-state-badge">Home</span>
            <h1>Carregando sua vitrine gamer</h1>
            <p>
              Estamos preparando catalogo, destaques da comunidade e atalhos para voce explorar a
              plataforma com mais clareza.
            </p>
          </section>
        </div>
      </div>
    )
  }

  const profileName = profile?.username ? `, @${profile.username}` : ''
  const heroKicker = user ? `Bem-vindo de volta${profileName}` : 'Sua proxima jogatina comeca aqui'
  const secondaryHeroAction = user
    ? { to: '/profile', label: 'Ver perfil e wishlist' }
    : { to: '/register', label: 'Entrar / criar conta' }

  const heroMetrics = [
    {
      value: formatCount(siteStats.games),
      label: 'jogos no catalogo',
      description: 'Busca e filtros para navegar com contexto.',
    },
    {
      value: formatCount(siteStats.reviews),
      label: 'avaliacoes publicadas',
      description: 'Notas reais da comunidade para apoiar a escolha.',
    },
    {
      value: formatCount(siteStats.comments),
      label: 'comentarios ativos',
      description: 'Conversas em andamento direto nas paginas dos jogos.',
    },
  ]

  const flowSteps = [
    {
      step: '01',
      title: 'Descubra',
      description: 'Explore o catalogo com filtros por genero, plataforma e estudio.',
    },
    {
      step: '02',
      title: 'Avalie',
      description: 'Leia reviews, publique sua nota e participe dos comentarios.',
    },
    {
      step: '03',
      title: 'Organize',
      description: 'Salve jogos na wishlist e mantenha seu perfil pronto para voltar quando quiser.',
    },
  ]

  const featureCards: Array<{
    title: string
    description: string
    ctaLabel: string
    ctaTo: string
    eyebrow: string
    icon: ReactNode
  }> = [
    {
      eyebrow: 'Catalogo',
      title: 'Explore jogos com filtros mais uteis',
      description:
        'Pesquise por titulo e combine genero, plataforma e estudio para encontrar mais rapido o jogo certo.',
      ctaLabel: 'Ver jogos',
      ctaTo: '/games',
      icon: iconCatalog(),
    },
    {
      eyebrow: 'Comunidade',
      title: 'Leia reviews e comentarios por jogo',
      description:
        'Cada pagina de jogo reune descricao, notas da comunidade, comentarios e contexto para decidir melhor.',
      ctaLabel: 'Abrir catalogo',
      ctaTo: '/games',
      icon: iconReview(),
    },
    {
      eyebrow: 'Wishlist',
      title: 'Guarde o que voce quer jogar depois',
      description:
        'Salve titulos direto na pagina do jogo e acompanhe sua lista de desejos no perfil.',
      ctaLabel: user ? 'Ver wishlist' : 'Entrar para salvar jogos',
      ctaTo: user ? '/profile' : '/login',
      icon: iconWishlist(),
    },
    {
      eyebrow: 'Perfil',
      title: 'Monte uma presenca com a sua cara',
      description:
        'Edite username, nome, bio e avatar para deixar seu perfil pronto para a comunidade.',
      ctaLabel: user ? 'Abrir perfil' : 'Criar conta',
      ctaTo: user ? '/profile' : '/register',
      icon: iconProfile(),
    },
  ]

  const roadmapItems: Array<{
    badge: string
    title: string
    description: string
    note: string
    icon: ReactNode
  }> = [
    {
      badge: 'Em breve',
      title: 'Comunidades tematicas',
      description:
        'Espacos por genero, franquia e estilo de jogo para reunir conversas, indicacoes e descobertas em grupo.',
      note: 'Foco em convivencia e descoberta social.',
      icon: iconCommunity(),
    },
    {
      badge: 'Planejado',
      title: 'Encontrar jogadores compativeis',
      description:
        'Sugestoes de pessoas com gostos parecidos para facilitar novas conexoes e jogatinas.',
      note: 'Mais afinidade, menos busca manual.',
      icon: iconPlayers(),
    },
    {
      badge: 'Roadmap social',
      title: 'Perfis e conexoes mais completos',
      description:
        'Perfis mais ricos, relacoes entre usuarios e sinais sociais para acompanhar quem compartilha interesses parecidos.',
      note: 'Uma plataforma em evolucao continua.',
      icon: iconConnections(),
    },
  ]

  const spotlightGames = trendingGames.slice(0, 3)
  const heroSpotlight = trendingGames[0] || null
  const heroSpotlightGenres = normalizeList(heroSpotlight?.generos).slice(0, 2).join(' | ')

  return (
    <div className="page-container">
      <div className="page-content home-page">
        <section className="home-hero">
          <div className="home-hero-copy">
            <span className="home-kicker">{heroKicker}</span>
            <h1>Descubra jogos, registre suas opinioes e acompanhe a conversa da comunidade.</h1>
            <p className="home-hero-lead">
              O Social Gamer junta catalogo, reviews, comentarios, wishlist e perfil em uma Home
              que apresenta melhor o valor da plataforma logo no primeiro contato.
            </p>

            <div className="home-hero-actions">
              <Link to="/games" className="home-action home-action-primary">
                Explorar jogos
              </Link>
              <Link
                to={secondaryHeroAction.to}
                className="home-action home-action-secondary"
              >
                {secondaryHeroAction.label}
              </Link>
            </div>

            <div className="home-hero-metrics" aria-label="Metricas da plataforma">
              {heroMetrics.map(metric => (
                <article key={metric.label} className="home-metric-card">
                  <strong>{metric.value}</strong>
                  <span>{metric.label}</span>
                  <small>{metric.description}</small>
                </article>
              ))}
            </div>
          </div>

          <div className="home-hero-panel">
            <article className="home-surface-card home-showcase-card">
              <span className="home-surface-kicker">Em destaque agora</span>
              <h2>{heroSpotlight?.titulo || 'Catalogo pronto para explorar'}</h2>
              <p>
                {heroSpotlight
                  ? `${heroSpotlightGenres || 'Multiplos generos'} com pagina dedicada, comentarios e espaco para a sua avaliacao.`
                  : 'Abra o catalogo para ver jogos, detalhes, reviews e comentarios em um fluxo mais direto.'}
              </p>

              <div className="home-showcase-list">
                {spotlightGames.length > 0 ? (
                  spotlightGames.map(game => (
                    <Link key={game.id} to={`/games/${game.id}`} className="home-showcase-link">
                      <span>{game.titulo}</span>
                      <small>{normalizeList(game.generos).slice(0, 2).join(', ') || 'Sem genero informado'}</small>
                    </Link>
                  ))
                ) : (
                  <div className="home-empty-inline">
                    Os destaques vao aparecer aqui assim que o catalogo estiver carregado.
                  </div>
                )}
              </div>
            </article>

            <article className="home-surface-card home-value-card">
              <span className="home-surface-kicker">Por que usar</span>
              <ul className="home-value-list">
                <li>Entenda rapido o que ja da para fazer na plataforma.</li>
                <li>Leia sinais reais da comunidade antes de escolher um jogo.</li>
                <li>Organize favoritos e acompanhe sua propria jornada gamer.</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="home-flow" aria-label="Como a plataforma ajuda voce">
          {flowSteps.map(step => (
            <article key={step.step} className="home-flow-card">
              <span className="home-flow-step">{step.step}</span>
              <div>
                <h2>{step.title}</h2>
                <p>{step.description}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="home-section">
          <div className="home-section-head">
            <div>
              <span className="home-section-kicker">Recursos atuais</span>
              <h2>O que voce ja pode fazer agora</h2>
            </div>
            <p>
              A Home passa a explicar melhor as funcionalidades reais do sistema sem prometer
              interacoes que ainda nao existem.
            </p>
          </div>

          <div className="home-feature-grid">
            {featureCards.map(feature => (
              <article key={feature.title} className="home-feature-card">
                <div className="home-feature-icon">{feature.icon}</div>
                <span className="home-feature-kicker">{feature.eyebrow}</span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                <Link to={feature.ctaTo} className="home-card-link">
                  {feature.ctaLabel}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="home-live-grid">
          <div className="home-panel">
            <div className="home-panel-head">
              <div>
                <span className="home-section-kicker">Conteudo vivo</span>
                <h2>Atividades recentes da comunidade</h2>
              </div>
              <p>Reviews e comentarios reais ajudam a mostrar movimento e utilidade logo na Home.</p>
            </div>

            {recentActivities.length === 0 ? (
              <div className="home-empty-state">
                <h3>Ainda nao ha atividades recentes</h3>
                <p>
                  Assim que a comunidade publicar reviews e comentarios, eles aparecerao aqui com
                  prioridade para o conteudo mais novo.
                </p>
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

                      <div className="home-activity-meta">
                        <span
                          className={`home-activity-badge${activity.type === 'comment' ? ' is-comment' : ''}`}
                        >
                          {activity.type === 'review' ? 'Review' : 'Comentario'}
                        </span>
                        {activity.score !== null ? (
                          <span className="home-score-pill">{activity.score}/10</span>
                        ) : null}
                      </div>
                    </div>

                    <h3>{activity.gameTitle}</h3>
                    <p>{activity.text}</p>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="home-panel home-panel-sidebar">
            <div className="home-panel-head">
              <div>
                <span className="home-section-kicker">Descoberta</span>
                <h2>Jogos em destaque</h2>
              </div>
              <p>Uma selecao visual para levar o usuario do interesse inicial direto para o catalogo.</p>
            </div>

            {trendingGames.length === 0 ? (
              <div className="home-empty-state home-empty-state-compact">
                <h3>Nenhum jogo em destaque agora</h3>
                <p>Quando o catalogo tiver itens disponiveis, eles vao aparecer aqui.</p>
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
                      <div>
                        <h3>{game.titulo}</h3>
                        <p>
                          {normalizeList(game.generos).slice(0, 2).join(', ') ||
                            'Genero nao informado'}
                        </p>
                      </div>
                      <span>{formatFullDate(game.data_lancamento, 'Data nao informada')}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </aside>
        </section>

        <section className="home-roadmap">
          <div className="home-section-head home-roadmap-head">
            <div>
              <span className="home-section-kicker">Em evolucao</span>
              <h2>O que vem por ai</h2>
            </div>
            <p>
              A proxima etapa da Home antecipa a direcao social da plataforma com uma secao de
              roadmap clara, bonita e sem parecer improvisada.
            </p>
          </div>

          <div className="home-roadmap-grid">
            {roadmapItems.map(item => (
              <article key={item.title} className="home-roadmap-card">
                <div className="home-roadmap-icon">{item.icon}</div>
                <span className="home-roadmap-badge">{item.badge}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <small>{item.note}</small>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default HomePage
