import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CatalogGamePreview,
  CatalogGamesPage,
  CatalogResult,
} from '../features/catalog/domain/catalogTypes'

const catalogMocks = vi.hoisted(() => ({
  getCatalogFacetOptions: vi.fn(),
  getCatalogGamesPage: vi.fn(),
}))

vi.mock('../services/gameCatalogService', () => ({
  getCatalogFacetOptions: catalogMocks.getCatalogFacetOptions,
  getCatalogGamesPage: catalogMocks.getCatalogGamesPage,
}))

vi.mock('../i18n/I18nContext', () => ({
  useI18n: () => ({
    formatDate: (value: string) => new Date(value).toLocaleDateString('en-US'),
    formatNumber: (value: number) => String(value),
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'catalog.filter.genrePrefix') return 'Genre'
      if (key === 'catalog.filter.platformPrefix') return 'Platform'
      if (key === 'catalog.filter.developerPrefix') return 'Studio'
      if (key === 'catalog.globalSearchChip') return `Search: ${params?.query}`
      if (key === 'catalog.globalSearchActive') {
        return `Search ${params?.query}: ${params?.range}`
      }
      if (key === 'catalog.range') {
        return `${params?.start}-${params?.end}/${params?.total}`
      }
      return key
    },
  }),
}))

import GamesPage from './GamesPage'

const game: CatalogGamePreview = {
  id: 7,
  igdbId: 'igdb-7',
  title: 'Hades',
  titulo: 'Hades',
  coverUrl: 'https://example.com/hades.jpg',
  capa_url: 'https://example.com/hades.jpg',
  developer: ['Supergiant Games'],
  desenvolvedora: ['Supergiant Games'],
  genres: ['Action', 'Roguelike', 'Indie'],
  generos: ['Action', 'Roguelike', 'Indie'],
  releaseDate: '2020-09-17',
  data_lancamento: '2020-09-17',
  platforms: ['PC'],
  plataformas: ['PC'],
  sourcePrimary: 'igdb',
  importStatus: 'ready',
  averageRating: 9.2,
  reviewCount: 12,
}

function LocationProbe() {
  const location = useLocation()
  return <span data-testid="location-search">{location.search}</span>
}

function QueryNavigationProbe() {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate('/games?q=second')}>
      switch-query
    </button>
  )
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, reject, resolve }
}

function renderGamesPage(initialEntry = '/games') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/games"
          element={
            <>
              <GamesPage />
              <LocationProbe />
              <QueryNavigationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  setViewportWidth(1280)
  catalogMocks.getCatalogFacetOptions.mockResolvedValue({
    data: {
      genres: ['Roguelike', 'Action'],
      platforms: ['PC'],
      developers: ['Supergiant Games'],
    },
    error: null,
  })
  catalogMocks.getCatalogGamesPage.mockResolvedValue({
    data: {
      items: [game],
      totalCount: 160,
      totalPages: 8,
      page: 1,
      pageSize: 20,
    },
    error: null,
  })
})

afterEach(cleanup)

describe('GamesPage catalog contract', () => {
  it('keeps the loading state visible until the catalog request resolves', async () => {
    const catalogRequest = createDeferred<CatalogResult<CatalogGamesPage>>()
    catalogMocks.getCatalogGamesPage.mockReturnValue(catalogRequest.promise)

    renderGamesPage()

    expect(
      await screen.findByRole('heading', { name: 'catalog.loadingTitle' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'common.games' })
    ).not.toBeInTheDocument()

    catalogRequest.resolve({
      data: {
        items: [game],
        totalCount: 1,
        totalPages: 1,
        page: 1,
        pageSize: 20,
      },
      error: null,
    })

    expect(
      await screen.findByRole('heading', { name: 'common.games' })
    ).toBeInTheDocument()
  })

  it('preserves the catalog error feedback and empty result DOM', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    catalogMocks.getCatalogGamesPage.mockResolvedValue({
      data: {
        items: [],
        totalCount: 0,
        totalPages: 0,
        page: 1,
        pageSize: 20,
      },
      error: { message: 'catalog unavailable' },
    })

    renderGamesPage()

    expect(
      await screen.findByRole('heading', { name: 'catalog.emptyTitle' })
    ).toBeInTheDocument()
    expect(screen.getByText('catalog unavailable')).toHaveClass(
      'gp-panel-footnote',
      'is-warning'
    )
    expect(consoleError).toHaveBeenCalledWith(
      'Erro ao buscar jogos:',
      expect.objectContaining({ message: 'catalog unavailable' })
    )
    consoleError.mockRestore()
  })

  it('renders the stable empty state without presenting an error', async () => {
    catalogMocks.getCatalogGamesPage.mockResolvedValue({
      data: {
        items: [],
        totalCount: 0,
        totalPages: 0,
        page: 1,
        pageSize: 20,
      },
      error: null,
    })

    const { container } = renderGamesPage()

    expect(
      await screen.findByRole('heading', { name: 'catalog.emptyTitle' })
    ).toBeInTheDocument()
    expect(screen.getByText('catalog.emptyText')).toHaveClass('gp-muted')
    expect(container.querySelector('.gp-panel-footnote.is-warning')).toBeNull()
    expect(container.querySelector('article.gp-game')).toBeNull()
  })

  it('ignores an obsolete catalog response after a rapid query change', async () => {
    const firstRequest = createDeferred<CatalogResult<CatalogGamesPage>>()
    const secondRequest = createDeferred<CatalogResult<CatalogGamesPage>>()
    const secondGame = {
      ...game,
      id: 8,
      igdbId: 'igdb-8',
      title: 'Second Game',
      titulo: 'Second Game',
    }
    catalogMocks.getCatalogGamesPage.mockImplementation(
      ({ query }: { query?: string }) =>
        query === 'first' ? firstRequest.promise : secondRequest.promise
    )

    renderGamesPage('/games?q=first')

    await waitFor(() => {
      expect(catalogMocks.getCatalogGamesPage).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'first' })
      )
    })
    fireEvent.click(screen.getByRole('button', { name: 'switch-query' }))
    await waitFor(() => {
      expect(catalogMocks.getCatalogGamesPage).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'second' })
      )
    })

    secondRequest.resolve({
      data: {
        items: [secondGame],
        totalCount: 1,
        totalPages: 1,
        page: 1,
        pageSize: 20,
      },
      error: null,
    })

    expect(
      await screen.findByRole('heading', { name: 'Second Game' })
    ).toBeInTheDocument()

    firstRequest.resolve({
      data: {
        items: [game],
        totalCount: 1,
        totalPages: 1,
        page: 1,
        pageSize: 20,
      },
      error: null,
    })

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Second Game' })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('heading', { name: 'Hades' })
      ).not.toBeInTheDocument()
    })
  })

  it('preserves the route query, sort, card DOM classes, and game links', async () => {
    const { container } = renderGamesPage('/games?q=hades&sort=rating-desc')

    expect(
      await screen.findByRole('heading', { name: 'common.games' })
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(catalogMocks.getCatalogGamesPage).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        query: 'hades',
        genres: [],
        platforms: [],
        developers: [],
        sort: 'rating-desc',
      })
    })

    expect(screen.getByLabelText('catalog.sortAria')).toHaveValue('rating-desc')
    expect(screen.getByTestId('location-search')).toHaveTextContent(
      '?q=hades&sort=rating-desc'
    )
    expect(screen.getByText('Search: hades')).toHaveClass('gp-chip', 'gp-chip--static')
    expect(container.querySelector('.gp-grid')).toHaveStyle({
      '--gp-grid-columns': '5',
    })
    expect(container.querySelector('article.gp-game')).toBeInTheDocument()
    expect(container.querySelectorAll('a[href="/games/7"]')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Hades — common.viewDetails' })).toHaveAttribute(
      'href',
      '/games/7'
    )
  })

  it('keeps facet filters internal while retaining q and sort in the URL', async () => {
    renderGamesPage('/games?q=hades&sort=release-asc')

    await screen.findByRole('heading', { name: 'common.games' })
    fireEvent.click(screen.getByRole('button', { name: 'catalog.allFilters' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Action' }))

    await waitFor(() => {
      expect(catalogMocks.getCatalogGamesPage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          query: 'hades',
          genres: ['Action'],
          platforms: [],
          developers: [],
          sort: 'release-asc',
        })
      )
    })

    expect(screen.getByTestId('location-search')).toHaveTextContent(
      '?q=hades&sort=release-asc'
    )
    expect(screen.getByRole('button', { name: 'Action' })).toHaveClass('is-active')
    expect(screen.getAllByText('Genre: Action')).toHaveLength(2)
  })

  it('shows the current page plus the next three and advances that window', async () => {
    catalogMocks.getCatalogGamesPage.mockImplementation(
      async ({ page, pageSize }: { page: number; pageSize: number }) => ({
        data: {
          items: [game],
          totalCount: 160,
          totalPages: 8,
          page,
          pageSize,
        },
        error: null,
      })
    )
    renderGamesPage()

    await screen.findByRole('heading', { name: 'common.games' })
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(screen.getByRole('button', { name: '4' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '5' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '2' }))

    await waitFor(() => {
      expect(catalogMocks.getCatalogGamesPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2, pageSize: 20 })
      )
    })
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument()
  })

  it.each([
    [480, 4],
    [481, 8],
    [769, 12],
    [993, 16],
    [1201, 20],
  ])(
    'uses the preserved responsive page size at %ipx',
    async (viewportWidth, expectedPageSize) => {
      setViewportWidth(viewportWidth)
      renderGamesPage()

      await waitFor(() => {
        expect(catalogMocks.getCatalogGamesPage).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 1,
            pageSize: expectedPageSize,
          })
        )
      })

      act(() => {
        window.dispatchEvent(new Event('resize'))
      })
      expect(catalogMocks.getCatalogGamesPage).toHaveBeenCalled()
    }
  )

  it('preserves the extra-genres modal and closes it with Escape', async () => {
    renderGamesPage()

    await screen.findByRole('heading', { name: 'common.games' })
    fireEvent.click(screen.getByRole('button', { name: 'catalog.showAllGenresFor' }))

    expect(
      await screen.findByRole('heading', { name: 'catalog.allGameGenres' })
    ).toBeInTheDocument()
    expect(screen.getByText('Indie')).toHaveClass('genre-chip', 'gp-tag')

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'catalog.allGameGenres' })
      ).not.toBeInTheDocument()
    })
  })
})
