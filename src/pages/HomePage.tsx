import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { FeaturedRecentReviewedGames } from '../components/home/FeaturedRecentReviewedGames'
import { NewReleasesCarousel } from '../components/home/NewReleasesCarousel'
import { RecentFollowingActivity } from '../components/home/RecentFollowingActivity'
import { TrendingReviews } from '../components/home/TrendingReviews'
import { formatCompactDate, formatCount } from '../components/home/homeDisplayUtils'
import { useAuth } from '../contexts/AuthContext'
import {
  getHomeFeaturedRecentReviewedGames,
  getHomeFollowingActivities,
  getHomeNewReleases,
  getHomeSiteStats,
  getHomeTrendingReviews,
  type HomeFeaturedGame,
  type HomeFollowingActivity,
  type HomeGameSummary,
  type HomeSiteStats,
  type HomeTrendingReview,
} from '../services/homeService'
import { getPublicProfilePath } from '../utils/profileRoutes'
import './HomePage.css'

interface HomeErrors {
  following: string | null
  trending: string | null
  featured: string | null
  releases: string | null
}

const EMPTY_HOME_ERRORS: HomeErrors = {
  following: null,
  trending: null,
  featured: null,
  releases: null,
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
  const [followingActivities, setFollowingActivities] = useState<HomeFollowingActivity[]>([])
  const [trendingReviews, setTrendingReviews] = useState<HomeTrendingReview[]>([])
  const [featuredGames, setFeaturedGames] = useState<HomeFeaturedGame[]>([])
  const [newReleases, setNewReleases] = useState<HomeGameSummary[]>([])
  const [siteStats, setSiteStats] = useState<HomeSiteStats>({
    games: 0,
    reviews: 0,
  })
  const [homeErrors, setHomeErrors] = useState<HomeErrors>(EMPTY_HOME_ERRORS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const fetchData = async () => {
      setLoading(true)
      setHomeErrors(EMPTY_HOME_ERRORS)

      try {
        const [
          followingResponse,
          featuredGamesResponse,
          releasesResponse,
          statsResponse,
        ] = await Promise.all([
          getHomeFollowingActivities(8, user?.id),
          getHomeFeaturedRecentReviewedGames({ daysWindow: 30, limit: 4 }),
          getHomeNewReleases(36),
          getHomeSiteStats(),
        ])

        const excludedReviewIds = followingResponse.data
          .map(activity => activity.reviewId)
          .filter((reviewId): reviewId is string => Boolean(reviewId))

        const trendingReviewsResponse = await getHomeTrendingReviews({
          minLikes: 20,
          limit: 6,
          excludedReviewIds,
        })

        if (!isMounted) return

        if (followingResponse.error) {
          console.error('Erro ao buscar atividades de quem voce segue:', followingResponse.error)
        }

        if (featuredGamesResponse.error) {
          console.error('Erro ao buscar jogos em destaque:', featuredGamesResponse.error)
        }

        if (releasesResponse.error) {
          console.error('Erro ao buscar lancamentos:', releasesResponse.error)
        }

        if (trendingReviewsResponse.error) {
          console.error('Erro ao buscar reviews em alta:', trendingReviewsResponse.error)
        }

        if (statsResponse.error) {
          console.error('Erro ao buscar numeros da plataforma:', statsResponse.error)
        }

        setFollowingActivities(followingResponse.data)
        setFeaturedGames(featuredGamesResponse.data)
        setNewReleases(releasesResponse.data)
        setTrendingReviews(trendingReviewsResponse.data)
        setSiteStats(statsResponse.data)
        setHomeErrors({
          following: followingResponse.error?.message || null,
          featured: featuredGamesResponse.error?.message || null,
          releases: releasesResponse.error?.message || null,
          trending: trendingReviewsResponse.error?.message || null,
        })
      } catch (error) {
        console.error('Erro ao montar a Home:', error)

        if (isMounted) {
          setFollowingActivities([])
          setFeaturedGames([])
          setNewReleases([])
          setTrendingReviews([])
          setHomeErrors({
            following: 'Nao foi possivel carregar atividades agora.',
            featured: 'Nao foi possivel carregar jogos em destaque agora.',
            releases: 'Nao foi possivel carregar lancamentos agora.',
            trending: 'Nao foi possivel carregar reviews em alta agora.',
          })
        }
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
  }, [user?.id])

  const heroEyebrow = user && profile?.username ? `Bem-vindo, @${profile.username}` : 'Social Gamer'
  const latestNetworkActivity = followingActivities[0] || null
  const secondaryAction = user
    ? {
        to: profile?.username ? getPublicProfilePath(profile.username) : '/profile',
        label: 'Meu perfil',
      }
    : { to: '/register', label: 'Criar conta' }

  const heroStats = [
    { value: loading ? '...' : formatCount(siteStats.games), label: 'jogos' },
    { value: loading ? '...' : formatCount(siteStats.reviews), label: 'reviews' },
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
      description: 'Monte sua lista e deixe seu perfil pronto para voltar depois.',
      ctaLabel: user ? 'Abrir perfil' : 'Entrar agora',
      ctaTo: user ? (profile?.username ? getPublicProfilePath(profile.username) : '/profile') : '/login',
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
              Explore o catalogo, acompanhe reviews relevantes e veja o que esta ganhando
              movimento na comunidade.
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
            <article className="home-hero-card home-network-card">
              <span className="home-eyebrow">Sua rede agora</span>

              {loading ? (
                <>
                  <h2>Carregando sua rede...</h2>
                  <p>Buscando as atividades mais recentes de quem voce segue.</p>
                </>
              ) : !user ? (
                <>
                  <h2>Entre para acompanhar sua rede</h2>
                  <p>Siga outros jogadores para ver reviews, favoritos e jogos adicionados aqui.</p>
                  <Link to="/login" className="home-inline-link">
                    Fazer login
                  </Link>
                </>
              ) : latestNetworkActivity ? (
                <>
                  <div className="home-network-meta">
                    <Link to={getPublicProfilePath(latestNetworkActivity.author.username)}>
                      {latestNetworkActivity.author.name}
                    </Link>
                    <span>{formatCompactDate(latestNetworkActivity.createdAt)}</span>
                  </div>

                  <h2>{latestNetworkActivity.game.title}</h2>
                  <p>{latestNetworkActivity.summary}</p>

                  <Link to={`/games/${latestNetworkActivity.game.id}`} className="home-inline-link">
                    Ver jogo
                  </Link>
                </>
              ) : (
                <>
                  <h2>Sua rede ainda esta quieta</h2>
                  <p>Siga jogadores ou explore o catalogo para encontrar novas conexoes e reviews.</p>
                  <Link to="/games" className="home-inline-link">
                    Explorar jogos
                  </Link>
                </>
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

        <NewReleasesCarousel
          items={newReleases}
          isLoading={loading}
          errorMessage={homeErrors.releases}
        />

        <section className="home-section">
          <div className="home-section-head">
            <div>
              <span className="home-eyebrow">Agora na plataforma</span>
              <h2>Jogos e movimento recente</h2>
            </div>
          </div>

          <div className="home-grid">
            <FeaturedRecentReviewedGames
              items={featuredGames}
              isLoading={loading}
              errorMessage={homeErrors.featured}
            />
            <RecentFollowingActivity
              items={followingActivities}
              isLoading={loading}
              errorMessage={homeErrors.following}
              isAuthenticated={Boolean(user)}
            />
            <TrendingReviews
              items={trendingReviews}
              isLoading={loading}
              errorMessage={homeErrors.trending}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

export default HomePage
