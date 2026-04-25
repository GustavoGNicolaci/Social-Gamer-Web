import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { HomeGameSummary } from '../../services/homeService'
import { formatFullDate, getInitial } from './homeDisplayUtils'

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
  const canGoPrevious = safeCurrentPage > 0
  const canGoNext = safeCurrentPage < totalPages - 1

  const carouselStyle = {
    '--home-release-columns': String(itemsPerPage),
  } as CSSProperties

  const trackStyle = {
    transform: `translateX(-${safeCurrentPage * 100}%)`,
  }

  return (
    <section className="home-section home-releases-section">
      <div className="home-section-head">
        <div>
          <span className="home-eyebrow">Lancamentos</span>
          <h2>Jogos lancamentos</h2>
        </div>
      </div>

      <div className="home-release-shell" style={carouselStyle}>
        {isLoading ? (
          <div className="home-empty-state">
            <p>Carregando lancamentos recentes...</p>
          </div>
        ) : errorMessage ? (
          <div className="home-empty-state is-error">
            <p>{errorMessage}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="home-empty-state">
            <p>Nenhum lancamento encontrado no catalogo.</p>
          </div>
        ) : (
          <>
            {canGoPrevious ? (
              <button
                type="button"
                className="home-carousel-arrow home-carousel-arrow--prev"
                onClick={() => setCurrentPage(Math.max(safeCurrentPage - 1, 0))}
                aria-label="Mostrar lancamentos anteriores"
              >
                <span aria-hidden="true">&lt;</span>
              </button>
            ) : null}

            <div className="home-release-viewport">
              <div className="home-release-track" style={trackStyle}>
                {pages.map((pageItems, pageIndex) => (
                  <div key={`home-release-page-${pageIndex}`} className="home-release-page">
                    {pageItems.map(game => (
                      <Link key={game.id} to={`/games/${game.id}`} className="home-release-card">
                        <div className="home-release-cover">
                          {game.coverUrl ? (
                            <img src={game.coverUrl} alt={`Capa do jogo ${game.title}`} />
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
                ))}
              </div>
            </div>

            {canGoNext ? (
              <button
                type="button"
                className="home-carousel-arrow home-carousel-arrow--next"
                onClick={() => setCurrentPage(Math.min(safeCurrentPage + 1, totalPages - 1))}
                aria-label="Mostrar proximos lancamentos"
              >
                <span aria-hidden="true">&gt;</span>
              </button>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}
