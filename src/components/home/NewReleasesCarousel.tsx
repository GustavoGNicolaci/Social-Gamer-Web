import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { GameCoverImage } from '../GameCoverImage'
import type { HomeGameSummary } from '../../services/homeService'
import { useI18n } from '../../i18n/I18nContext'
import { formatFullDate, getInitial } from './homeDisplayUtils'
import { HomePanelState } from './HomePanelState'

interface NewReleasesCarouselProps {
  items: HomeGameSummary[]
  isLoading: boolean
  errorMessage: string | null
}

function getItemsPerPage(viewportWidth: number) {
  if (viewportWidth <= 480) return 1
  if (viewportWidth <= 768) return 2
  if (viewportWidth <= 992) return 3
  if (viewportWidth <= 1200) return 4
  return 6
}

function chunkItems(items: HomeGameSummary[], chunkSize: number) {
  const groups: HomeGameSummary[][] = []

  for (let index = 0; index < items.length; index += chunkSize) {
    groups.push(items.slice(index, index + chunkSize))
  }

  return groups
}

export function NewReleasesCarousel({
  items,
  isLoading,
  errorMessage,
}: NewReleasesCarouselProps) {
  const { t } = useI18n()
  const [itemsPerPage, setItemsPerPage] = useState(() =>
    typeof window === 'undefined' ? 6 : getItemsPerPage(window.innerWidth)
  )
  const [currentPage, setCurrentPage] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const syncItemsPerPage = () => {
      setItemsPerPage(getItemsPerPage(window.innerWidth))
    }

    syncItemsPerPage()
    window.addEventListener('resize', syncItemsPerPage)

    return () => {
      window.removeEventListener('resize', syncItemsPerPage)
    }
  }, [])

  const pages = useMemo(() => chunkItems(items, itemsPerPage), [items, itemsPerPage])
  const totalPages = pages.length
  const safeCurrentPage = Math.min(currentPage, Math.max(totalPages - 1, 0))
  const visiblePageItems = pages[safeCurrentPage] || []
  const canGoPrevious = safeCurrentPage > 0
  const canGoNext = safeCurrentPage < totalPages - 1

  const carouselStyle = {
    '--home-release-columns': String(itemsPerPage),
  } as CSSProperties

  return (
    <section className="home-section home-releases-section">
      <div className="home-section-head">
        <div>
          <span className="home-eyebrow">{t('home.releases.eyebrow')}</span>
          <h2>{t('home.releases.title')}</h2>
        </div>
      </div>

      <div className="home-release-shell" style={carouselStyle}>
        {isLoading ? (
          <div
            className="home-release-skeleton-grid"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <span className="home-sr-only">{t('home.releases.loading')}</span>
            {Array.from({ length: itemsPerPage }, (_, index) => (
              <div key={`release-skeleton-${index}`} className="home-release-card is-skeleton" aria-hidden="true">
                <span className="home-release-skeleton-cover" />
                <span className="home-release-skeleton-line is-short" />
                <span className="home-release-skeleton-line" />
              </div>
            ))}
          </div>
        ) : errorMessage ? (
          <HomePanelState message={errorMessage} tone="error" />
        ) : items.length === 0 ? (
          <HomePanelState message={t('home.releases.empty')} />
        ) : (
          <>
            {canGoPrevious ? (
              <button
                type="button"
                className="home-carousel-arrow home-carousel-arrow--prev"
                onClick={() => setCurrentPage(Math.max(safeCurrentPage - 1, 0))}
                aria-label={t('home.releases.previous')}
              >
                <ChevronLeft aria-hidden="true" />
              </button>
            ) : null}

            <div className="home-release-viewport">
              <div className="home-release-track">
                <div key={`home-release-page-${safeCurrentPage}`} className="home-release-page">
                  {visiblePageItems.map(game => (
                    <Link key={game.id} to={`/games/${game.id}`} className="home-release-card">
                      <div className="home-release-cover">
                        {game.coverUrl ? (
                          <GameCoverImage
                            src={game.coverUrl}
                            alt={t('catalog.coverAlt', { title: game.title })}
                            sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, (max-width: 992px) 33vw, (max-width: 1200px) 25vw, 17vw"
                          />
                        ) : (
                          <div className="home-release-fallback">{getInitial(game.title)}</div>
                        )}
                      </div>

                      <div className="home-release-body">
                        <span>{formatFullDate(game.releaseDate)}</span>
                        <h3>{game.title}</h3>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="home-carousel-status" aria-live="polite" aria-atomic="true">
              <span>{safeCurrentPage + 1}</span>
              <span aria-hidden="true">/</span>
              <span>{totalPages}</span>
            </div>

            {canGoNext ? (
              <button
                type="button"
                className="home-carousel-arrow home-carousel-arrow--next"
                onClick={() => setCurrentPage(Math.min(safeCurrentPage + 1, totalPages - 1))}
                aria-label={t('home.releases.next')}
              >
                <ChevronRight aria-hidden="true" />
              </button>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}
