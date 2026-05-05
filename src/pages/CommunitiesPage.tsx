import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, Search, Users } from 'lucide-react'
import { CommunityCreateModal } from '../components/communities/CommunityCreateModal'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../i18n/I18nContext'
import {
  COMMUNITY_CATEGORY_VALUES,
  getCommunities,
  type CommunityCategoryValue,
  type CommunitySummary,
} from '../services/communityService'
import { resolvePublicFileUrl } from '../services/storageService'
import './CommunitiesPage.css'

type FeedbackTone = 'success' | 'error' | 'info'

interface FeedbackState {
  tone: FeedbackTone
  message: string
}

const COMMUNITIES_PAGE_SIZE = 9

function getCommunityImage(community: CommunitySummary) {
  return resolvePublicFileUrl(community.banner_path) || community.jogo?.capa_url || null
}

function getCommunityCategoryLabel(
  category: string | null,
  t: (key: string, params?: Record<string, string | number>) => string
) {
  if (!category) return ''
  return COMMUNITY_CATEGORY_VALUES.includes(category as CommunityCategoryValue)
    ? t(`communities.category.${category}`)
    : category
}

function CommunitiesPage() {
  const { user } = useAuth()
  const { t, formatNumber } = useI18n()

  const [communities, setCommunities] = useState<CommunitySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState('')
  const [categoriaFilter, setCategoriaFilter] = useState<CommunityCategoryValue | ''>('')
  const [currentPage, setCurrentPage] = useState(1)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const tipoOptions = useMemo(
    () =>
      Array.from(new Set(communities.map(community => community.tipo).filter(Boolean) as string[]))
        .sort((a, b) => a.localeCompare(b)),
    [communities]
  )

  const totalPages = Math.max(1, Math.ceil(communities.length / COMMUNITIES_PAGE_SIZE))
  const currentCommunities = useMemo(() => {
    const startIndex = (currentPage - 1) * COMMUNITIES_PAGE_SIZE
    return communities.slice(startIndex, startIndex + COMMUNITIES_PAGE_SIZE)
  }, [communities, currentPage])

  const loadCommunities = useCallback(async (options: { preserveFeedback?: boolean } = {}) => {
    setLoading(true)
    const result = await getCommunities(
      {
        search,
        tipo: tipoFilter || undefined,
        categoria: categoriaFilter || undefined,
        limit: 100,
      },
      user?.id
    )

    setCommunities(result.data)
    if (result.error) {
      setFeedback({ tone: 'error', message: result.error.message })
    } else if (!options.preserveFeedback) {
      setFeedback(null)
    }
    setLoading(false)
    return result
  }, [categoriaFilter, search, tipoFilter, user?.id])

  useEffect(() => {
    setCurrentPage(1)
  }, [categoriaFilter, search, tipoFilter])

  useEffect(() => {
    setCurrentPage(current => Math.min(current, totalPages))
  }, [totalPages])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCommunities()
    }, 180)

    return () => window.clearTimeout(timeoutId)
  }, [loadCommunities])

  const handleCommunityCreated = useCallback(async () => {
    setCurrentPage(1)
    const result = await loadCommunities({ preserveFeedback: true })
    setFeedback(
      result.error
        ? { tone: 'error', message: result.error.message }
        : { tone: 'success', message: t('communities.create.success') }
    )
  }, [loadCommunities, t])

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="communities-page">
          <section className="communities-hero">
            <div className="communities-hero-copy">
              <span className="communities-kicker">{t('communities.kicker')}</span>
              <h1>{t('communities.heroTitle')}</h1>
              <p>{t('communities.heroText')}</p>
            </div>

            <button
              type="button"
              className="communities-create-trigger"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus size={20} aria-hidden="true" />
              <span>{t('communities.create.open')}</span>
            </button>
          </section>

          <section className="communities-layout">
            <div className="communities-main">
              <div className="communities-toolbar">
                <label className="communities-field communities-search-field">
                  <span>{t('common.search')}</span>
                  <div className="communities-search-control">
                    <Search size={18} aria-hidden="true" />
                    <input
                      type="search"
                      value={search}
                      onChange={event => setSearch(event.target.value)}
                      placeholder={t('communities.searchPlaceholder')}
                    />
                  </div>
                </label>

                <label className="communities-field">
                  <span>{t('communities.field.theme')}</span>
                  <select value={tipoFilter} onChange={event => setTipoFilter(event.target.value)}>
                    <option value="">{t('communities.filter.allThemes')}</option>
                    {tipoOptions.map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="communities-field">
                  <span>{t('communities.field.category')}</span>
                  <select
                    value={categoriaFilter}
                    onChange={event => setCategoriaFilter(event.target.value as CommunityCategoryValue | '')}
                  >
                    <option value="">{t('communities.filter.allCategories')}</option>
                    {COMMUNITY_CATEGORY_VALUES.map(option => (
                      <option key={option} value={option}>
                        {t(`communities.category.${option}`)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {feedback ? (
                <p className={`communities-feedback is-${feedback.tone}`}>{feedback.message}</p>
              ) : null}

              {loading ? (
                <div className="communities-state-card">{t('communities.loading')}</div>
              ) : communities.length === 0 ? (
                <div className="communities-state-card">
                  <Users size={22} aria-hidden="true" />
                  <span>{t('communities.empty')}</span>
                </div>
              ) : (
                <>
                  <div className="communities-grid">
                    {currentCommunities.map(community => {
                      const imageUrl = getCommunityImage(community)
                      const categoryLabel = getCommunityCategoryLabel(community.categoria, t)
                      const meta = [community.tipo, categoryLabel, community.jogo?.titulo]
                        .filter(Boolean)
                        .join(' / ')

                      return (
                        <Link
                          key={community.id}
                          to={`/comunidades/${community.id}`}
                          className="community-card"
                        >
                          <div className="community-card-media">
                            {imageUrl ? (
                              <>
                                <img className="community-media-backdrop" src={imageUrl} alt="" aria-hidden="true" />
                                <img className="community-media-foreground" src={imageUrl} alt="" />
                              </>
                            ) : (
                              <div className="community-card-fallback">
                                {community.nome.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>

                          <div className="community-card-copy">
                            <div className="community-card-meta-row">
                              <span>{meta || t('communities.general')}</span>
                              <span>{t(`communities.visibility.${community.visibilidade}`)}</span>
                            </div>
                            <h2>{community.nome}</h2>
                            <p>{community.descricao || t('communities.noDescription')}</p>
                          </div>

                          <div className="community-card-stats">
                            <span>
                              <Users size={16} aria-hidden="true" />
                              <strong>{formatNumber(community.membros_count)}</strong>
                              {t('communities.members')}
                            </span>
                            <span>
                              <strong>{formatNumber(community.posts_count)}</strong>
                              {t('communities.posts')}
                            </span>
                          </div>
                        </Link>
                      )
                    })}
                  </div>

                  {totalPages > 1 ? (
                    <nav className="community-pagination" aria-label={t('communities.pagination.label')}>
                      <button
                        type="button"
                        className="community-pagination-button"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                      >
                        <ChevronLeft size={18} aria-hidden="true" />
                        <span>{t('communities.pagination.previous')}</span>
                      </button>
                      <span className="community-pagination-label">
                        {t('communities.pagination.pageLabel', {
                          page: currentPage,
                          total: totalPages,
                        })}
                      </span>
                      <button
                        type="button"
                        className="community-pagination-button"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                      >
                        <span>{t('communities.pagination.next')}</span>
                        <ChevronRight size={18} aria-hidden="true" />
                      </button>
                    </nav>
                  ) : null}
                </>
              )}
            </div>
          </section>
        </div>
      </div>

      {isCreateModalOpen ? (
        <CommunityCreateModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={handleCommunityCreated}
        />
      ) : null}
    </div>
  )
}

export default CommunitiesPage
