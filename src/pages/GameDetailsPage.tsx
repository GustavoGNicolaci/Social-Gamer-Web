import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { GameDetailsOverview } from '../features/catalog/components/GameDetailsOverview'
import { useGameStatusAction } from '../features/catalog/hooks/useGameStatusAction'
import { useGameWishlistAction } from '../features/catalog/hooks/useGameWishlistAction'
import { GameReviewsSection } from '../features/reviews/components/GameReviewsSection'
import { useGameReviewsController } from '../features/reviews/hooks/useGameReviewsController'
import {
  getCatalogGameDetailsById,
  type CatalogGameDetails,
} from '../services/gameCatalogService'
import { useI18n } from '../i18n/I18nContext'
import './GameDetailsPage.css'

function GameDetailsPage() {
  const { id } = useParams()
  const location = useLocation()
  const { user } = useAuth()
  const { t } = useI18n()
  const parsedGameId = Number(id)
  const routeGameId = id && !Number.isNaN(parsedGameId) ? parsedGameId : null

  const [game, setGame] = useState<CatalogGameDetails | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const reviewsController = useGameReviewsController({
    gameId: routeGameId,
    currentUserId: user?.id ?? null,
    locationHash: location.hash,
    t,
  })
  const {
    reviews,
    ratingSummary,
    totalComments,
    loading: reviewsLoading,
  } = reviewsController.overview
  const {
    wishlistLoading,
    wishlistSaving,
    isInWishlist,
    wishlistFeedback,
    toggleWishlist: handleWishlistToggle,
  } = useGameWishlistAction({
    userId: user?.id,
    gameId: game?.id ?? null,
    t,
  })
  const {
    gameStatusLoading,
    gameStatusSaving,
    pendingGameStatus,
    gameStatusEntry,
    gameStatusFeedback,
    saveStatus: handleSaveGameStatus,
  } = useGameStatusAction({
    userId: user?.id,
    gameId: game?.id ?? null,
    t,
  })

  useEffect(() => {
    let isMounted = true

    const fetchCatalogGame = async () => {
      if (routeGameId === null) {
        if (isMounted) {
          setGame(null)
          setCatalogLoading(false)
        }
        return
      }

      setCatalogLoading(true)
      const gameResult = await getCatalogGameDetailsById(routeGameId)

      if (!isMounted) return

      if (gameResult.error) {
        console.error('Erro ao buscar jogo:', gameResult.error)
        setGame(null)
      } else {
        setGame(gameResult.data)
      }

      setCatalogLoading(false)
    }

    void fetchCatalogGame()

    return () => {
      isMounted = false
    }
  }, [routeGameId])

  const loading = catalogLoading || reviewsLoading

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-content game-details-page">
          <section className="game-details-state-card">
            <span className="game-details-state-badge">{t('game.details.badge')}</span>
            <h1>{t('game.details.loadingTitle')}</h1>
            <p>{t('game.details.loadingText')}</p>
          </section>
        </div>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="page-container">
        <div className="page-content game-details-page">
          <section className="game-details-state-card">
            <span className="game-details-state-badge">{t('game.details.badge')}</span>
            <h1>{t('game.details.notFoundTitle')}</h1>
            <p>{t('game.details.notFoundText')}</p>
            <div className="game-details-state-actions">
              <Link to="/games" className="game-button game-details-secondary-button">
                {t('common.goBackToCatalog')}
              </Link>
            </div>
          </section>
        </div>
      </div>
    )
  }

  const fallbackTotalAvaliacoes = reviews.length
  const fallbackMediaAvaliacoes =
    fallbackTotalAvaliacoes > 0
      ? reviews.reduce((scoreTotal, review) => scoreTotal + review.nota, 0) / fallbackTotalAvaliacoes
      : null
  const totalAvaliacoes = ratingSummary?.reviewCount ?? fallbackTotalAvaliacoes
  const mediaAvaliacoes = ratingSummary?.averageRating ?? fallbackMediaAvaliacoes
  return (
    <div className="page-container">
      <div className="page-content game-details-page">
        <GameDetailsOverview
          game={game}
          summary={{
            average: mediaAvaliacoes,
            reviews: totalAvaliacoes,
            comments: totalComments,
          }}
          userActions={{
            authenticated: Boolean(user),
            wishlist: {
              loading: wishlistLoading,
              saving: wishlistSaving,
              saved: isInWishlist,
              feedback: wishlistFeedback,
              toggle: handleWishlistToggle,
            },
            status: {
              loading: gameStatusLoading,
              saving: gameStatusSaving,
              pending: pendingGameStatus,
              current: gameStatusEntry?.status ?? null,
              feedback: gameStatusFeedback,
              select: handleSaveGameStatus,
            },
          }}
        />

        <GameReviewsSection {...reviewsController.section} />
      </div>
    </div>
  )
}

export default GameDetailsPage
