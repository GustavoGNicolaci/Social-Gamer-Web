import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react'
import { useSearchParams } from 'react-router-dom'
import { getRuntimeLocale } from '../../../i18n'
import { useI18n } from '../../../i18n/I18nContext'
import {
  getCatalogFacetOptions,
  getCatalogGamesPage,
} from '../../../services/gameCatalogService'
import type {
  CatalogActiveFilter,
  CatalogFacetCategory,
  CatalogFilterModalGroup,
} from '../components/CatalogFiltersModal'
import type {
  CatalogGamePreview,
  CatalogSortOption,
} from '../domain/catalogTypes'

type CatalogFilterCategory = CatalogFacetCategory

interface CatalogFilterToken {
  key: string
  category: CatalogFilterCategory
  value: string
}

export const DEFAULT_CATALOG_SORT: CatalogSortOption = 'release-desc'

export const CATALOG_SORT_OPTIONS: Array<{
  value: CatalogSortOption
  labelKey: string
}> = [
  { value: 'release-desc', labelKey: 'catalog.sort.releaseDesc' },
  { value: 'release-asc', labelKey: 'catalog.sort.releaseAsc' },
  { value: 'rating-desc', labelKey: 'catalog.sort.ratingDesc' },
  { value: 'rating-asc', labelKey: 'catalog.sort.ratingAsc' },
]

function getGamesGridColumns(viewportWidth: number) {
  if (viewportWidth <= 480) return 1
  if (viewportWidth <= 768) return 2
  if (viewportWidth <= 992) return 3
  if (viewportWidth <= 1200) return 4
  return 5
}

function getFacetLabelPrefix(
  category: CatalogFacetCategory,
  t: (key: string) => string
) {
  if (category === 'genre') return t('catalog.filter.genrePrefix')
  if (category === 'platform') return t('catalog.filter.platformPrefix')
  return t('catalog.filter.developerPrefix')
}

function sortAlphabetically(values: string[]) {
  return values.sort((left, right) => left.localeCompare(right, getRuntimeLocale()))
}

function getCatalogSortOption(value: string | null): CatalogSortOption {
  return CATALOG_SORT_OPTIONS.some(option => option.value === value)
    ? (value as CatalogSortOption)
    : DEFAULT_CATALOG_SORT
}

function buildFacetToken(
  category: CatalogFacetCategory,
  value: string
): CatalogFilterToken {
  return {
    key: `${category}-${value.toLowerCase()}`,
    category,
    value,
  }
}

function getFacetTokenLabel(
  token: CatalogFilterToken,
  t: (key: string) => string
) {
  return `${getFacetLabelPrefix(token.category as CatalogFacetCategory, t)}: ${token.value}`
}

function buildVisibleFacetOptions(
  options: string[],
  inputValue: string
) {
  const normalizedInputValue = inputValue.trim().toLowerCase()
  return normalizedInputValue.length === 0
    ? options
    : options.filter(option => option.toLowerCase().includes(normalizedInputValue))
}

export interface GamesCatalogController {
  results: {
    games: CatalogGamePreview[]
    totalPages: number
    safeCurrentPage: number
    loading: boolean
    catalogError: string | null
    rangeLabel: string
  }
  filters: {
    navbarQuery: string
    catalogSort: CatalogSortOption
    activeFilters: CatalogActiveFilter[]
    modalSearch: string
    modalGroups: CatalogFilterModalGroup[]
  }
  layout: {
    gridStyle: CSSProperties
    showFiltersModal: boolean
    showGenresModal: boolean
    selectedGameGenres: string[]
  }
  actions: {
    changePage: (page: number) => void
    updateCatalogSort: (sort: CatalogSortOption) => void
    openFiltersModal: () => void
    closeFiltersModal: () => void
    updateFiltersModalSearch: (value: string) => void
    toggleFacetFilter: (category: CatalogFacetCategory, value: string) => void
    isFacetFilterActive: (category: CatalogFacetCategory, value: string) => boolean
    clearAllFilters: () => void
    showGenres: (genres: string[]) => void
    closeGenresModal: () => void
  }
}

export function useGamesCatalogController(): GamesCatalogController {
  const { t, formatNumber } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()
  const [games, setGames] = useState<CatalogGamePreview[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [availableFacets, setAvailableFacets] = useState({
    genres: [] as string[],
    platforms: [] as string[],
    developers: [] as string[],
  })
  const [facetFilters, setFacetFilters] = useState<CatalogFilterToken[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [gridColumns, setGridColumns] = useState(() =>
    typeof window === 'undefined' ? 5 : getGamesGridColumns(window.innerWidth)
  )
  const [showGenresModal, setShowGenresModal] = useState(false)
  const [selectedGameGenres, setSelectedGameGenres] = useState<string[]>([])
  const [showFiltersModal, setShowFiltersModal] = useState(false)
  const [filtersModalSearch, setFiltersModalSearch] = useState('')

  const navbarQuery = searchParams.get('q')?.trim() || ''
  const catalogSort = getCatalogSortOption(searchParams.get('sort'))
  const trimmedModalSearch = filtersModalSearch.trim()
  const itemsPerPage = gridColumns * 4

  const genreFilterTokens = useMemo(
    () => facetFilters.filter(filter => filter.category === 'genre'),
    [facetFilters]
  )
  const platformFilterTokens = useMemo(
    () => facetFilters.filter(filter => filter.category === 'platform'),
    [facetFilters]
  )
  const developerFilterTokens = useMemo(
    () => facetFilters.filter(filter => filter.category === 'developer'),
    [facetFilters]
  )
  const selectedGenres = useMemo(
    () => genreFilterTokens.map(filter => filter.value),
    [genreFilterTokens]
  )
  const selectedPlatforms = useMemo(
    () => platformFilterTokens.map(filter => filter.value),
    [platformFilterTokens]
  )
  const selectedDevelopers = useMemo(
    () => developerFilterTokens.map(filter => filter.value),
    [developerFilterTokens]
  )

  useEffect(() => {
    let isMounted = true

    const fetchGames = async () => {
      setLoading(true)
      setCatalogError(null)

      const result = await getCatalogGamesPage({
        page: currentPage,
        pageSize: itemsPerPage,
        query: navbarQuery,
        genres: selectedGenres,
        platforms: selectedPlatforms,
        developers: selectedDevelopers,
        sort: catalogSort,
      })

      if (!isMounted) return

      if (result.error) {
        console.error('Erro ao buscar jogos:', result.error)
        setGames([])
        setTotalCount(0)
        setTotalPages(0)
        setCatalogError(result.error.message)
        setLoading(false)
        return
      }

      const nextGames = result.data.items
      setGames(nextGames)
      setTotalCount(result.data.totalCount)
      setTotalPages(result.data.totalPages)
      setLoading(false)
    }

    void fetchGames()

    return () => {
      isMounted = false
    }
  }, [
    catalogSort,
    currentPage,
    itemsPerPage,
    navbarQuery,
    selectedDevelopers,
    selectedGenres,
    selectedPlatforms,
  ])

  useEffect(() => {
    let isMounted = true

    const fetchFacets = async () => {
      const result = await getCatalogFacetOptions(navbarQuery)

      if (!isMounted) return

      if (result.error) {
        console.error('Erro ao buscar filtros do catalogo:', result.error)
        setAvailableFacets({ genres: [], platforms: [], developers: [] })
        return
      }

      setAvailableFacets(result.data)
    }

    void fetchFacets()

    return () => {
      isMounted = false
    }
  }, [navbarQuery])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const syncGridColumns = () => {
      setGridColumns(getGamesGridColumns(window.innerWidth))
    }

    syncGridColumns()
    window.addEventListener('resize', syncGridColumns)

    return () => {
      window.removeEventListener('resize', syncGridColumns)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowGenresModal(false)
        setShowFiltersModal(false)
      }
    }

    if (!showGenresModal && !showFiltersModal) {
      return
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showFiltersModal, showGenresModal])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setCurrentPage(1)
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [catalogSort, facetFilters, navbarQuery])

  useEffect(() => {
    if (showFiltersModal) return

    const timeoutId = window.setTimeout(() => {
      setFiltersModalSearch('')
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [showFiltersModal])

  const updateNavbarQuery = useCallback(
    (value: string) => {
      const trimmedValue = value.trim()

      setSearchParams(
        currentParams => {
          const nextParams = new URLSearchParams(currentParams)

          if (trimmedValue) {
            nextParams.set('q', trimmedValue)
          } else {
            nextParams.delete('q')
          }

          return nextParams
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const updateCatalogSort = useCallback(
    (nextSort: CatalogSortOption) => {
      setSearchParams(
        currentParams => {
          const nextParams = new URLSearchParams(currentParams)
          nextParams.set('sort', nextSort)

          return nextParams
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const toggleFacetFilter = useCallback(
    (category: CatalogFacetCategory, value: string) => {
      setFacetFilters(currentFilters => {
        const normalizedValue = value.trim().toLowerCase()
        const alreadyExists = currentFilters.some(
          token =>
            token.category === category &&
            token.value.toLowerCase() === normalizedValue
        )

        if (alreadyExists) {
          return currentFilters.filter(
            token =>
              !(
                token.category === category &&
                token.value.toLowerCase() === normalizedValue
              )
          )
        }

        return [...currentFilters, buildFacetToken(category, value)]
      })
    },
    []
  )

  const isFacetFilterActive = useCallback(
    (category: CatalogFacetCategory, value: string) =>
      facetFilters.some(
        token =>
          token.category === category &&
          token.value.toLowerCase() === value.toLowerCase()
      ),
    [facetFilters]
  )

  const allGenres = useMemo(
    () => sortAlphabetically([...availableFacets.genres]),
    [availableFacets.genres]
  )
  const allPlatforms = useMemo(
    () => sortAlphabetically([...availableFacets.platforms]),
    [availableFacets.platforms]
  )
  const allDevelopers = useMemo(
    () => sortAlphabetically([...availableFacets.developers]),
    [availableFacets.developers]
  )

  const clearAllFilters = useCallback(() => {
    setFacetFilters([])
    setCurrentPage(1)
    setFiltersModalSearch('')

    if (navbarQuery) {
      updateNavbarQuery('')
    }
  }, [navbarQuery, updateNavbarQuery])

  const activeFilters = useMemo<CatalogActiveFilter[]>(
    () => [
      ...(navbarQuery
        ? [
            {
              key: `navbar-query-${navbarQuery.toLowerCase()}`,
              label: t('catalog.globalSearchChip', { query: navbarQuery }),
              onRemove: () => updateNavbarQuery(''),
            },
          ]
        : []),
      ...facetFilters.map(filter => ({
        key: filter.key,
        label: getFacetTokenLabel(filter, t),
        onRemove: () =>
          setFacetFilters(currentFilters =>
            currentFilters.filter(
              currentFilter => currentFilter.key !== filter.key
            )
          ),
      })),
    ],
    [facetFilters, navbarQuery, t, updateNavbarQuery]
  )

  const modalGenreOptions = useMemo(
    () => buildVisibleFacetOptions(allGenres, trimmedModalSearch),
    [allGenres, trimmedModalSearch]
  )
  const modalPlatformOptions = useMemo(
    () => buildVisibleFacetOptions(allPlatforms, trimmedModalSearch),
    [allPlatforms, trimmedModalSearch]
  )
  const modalDeveloperOptions = useMemo(
    () => buildVisibleFacetOptions(allDevelopers, trimmedModalSearch),
    [allDevelopers, trimmedModalSearch]
  )

  const safeCurrentPage =
    totalPages === 0 ? 1 : Math.min(currentPage, totalPages)
  const visibleStart =
    totalCount === 0 ? 0 : (safeCurrentPage - 1) * itemsPerPage + 1
  const visibleEnd =
    totalCount === 0
      ? 0
      : Math.min(visibleStart + games.length - 1, totalCount)
  const rangeLabel =
    totalCount === 0
      ? t('catalog.rangeEmpty')
      : t('catalog.range', {
          start: formatNumber(visibleStart),
          end: formatNumber(visibleEnd),
          total: formatNumber(totalCount),
        })

  const gridStyle = useMemo(
    () =>
      ({
        '--gp-grid-columns': String(gridColumns),
      }) as CSSProperties,
    [gridColumns]
  )

  const modalGroups = useMemo<CatalogFilterModalGroup[]>(
    () => [
      {
        key: 'genre-modal',
        category: 'genre',
        title: t('common.genres'),
        options: modalGenreOptions,
      },
      {
        key: 'platform-modal',
        category: 'platform',
        title: t('common.platforms'),
        options: modalPlatformOptions,
      },
      {
        key: 'developer-modal',
        category: 'developer',
        title: t('common.studios'),
        options: modalDeveloperOptions,
      },
    ],
    [modalDeveloperOptions, modalGenreOptions, modalPlatformOptions, t]
  )

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      const timeoutId = window.setTimeout(() => {
        setCurrentPage(totalPages)
      }, 0)

      return () => {
        window.clearTimeout(timeoutId)
      }
    }
  }, [currentPage, totalPages])

  const showGenres = useCallback((genres: string[]) => {
    setSelectedGameGenres(genres)
    setShowGenresModal(true)
  }, [])
  const openFiltersModal = useCallback(() => setShowFiltersModal(true), [])
  const closeFiltersModal = useCallback(() => setShowFiltersModal(false), [])
  const closeGenresModal = useCallback(() => setShowGenresModal(false), [])

  return {
    results: {
      games,
      totalPages,
      safeCurrentPage,
      loading,
      catalogError,
      rangeLabel,
    },
    filters: {
      navbarQuery,
      catalogSort,
      activeFilters,
      modalSearch: filtersModalSearch,
      modalGroups,
    },
    layout: {
      gridStyle,
      showFiltersModal,
      showGenresModal,
      selectedGameGenres,
    },
    actions: {
      changePage: setCurrentPage,
      updateCatalogSort,
      openFiltersModal,
      closeFiltersModal,
      updateFiltersModalSearch: setFiltersModalSearch,
      toggleFacetFilter,
      isFacetFilterActive,
      clearAllFilters,
      showGenres,
      closeGenresModal,
    },
  }
}
