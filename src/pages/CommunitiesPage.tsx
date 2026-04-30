import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CommunityFilePicker } from '../components/communities/CommunityFilePicker'
import { GameCoverImage } from '../components/GameCoverImage'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../i18n/I18nContext'
import {
  COMMUNITY_CATEGORY_VALUES,
  createCommunity,
  getCommunities,
  type CommunityCategoryValue,
  type CommunityPostingPermission,
  type CommunitySummary,
  type CommunityVisibility,
} from '../services/communityService'
import {
  searchCatalogGamesByTitle,
  type CatalogGamePreview,
} from '../services/gameCatalogService'
import { resolvePublicFileUrl, uploadCommunityBannerImage } from '../services/storageService'
import './CommunitiesPage.css'

interface CommunityDraft {
  nome: string
  descricao: string
  tipo: string
  categoria: CommunityCategoryValue | ''
  regras: string
  permissaoPostagem: CommunityPostingPermission
  visibilidade: CommunityVisibility
}

type FeedbackTone = 'success' | 'error' | 'info'

interface FeedbackState {
  tone: FeedbackTone
  message: string
}

const initialDraft: CommunityDraft = {
  nome: '',
  descricao: '',
  tipo: '',
  categoria: '',
  regras: '',
  permissaoPostagem: 'todos_membros',
  visibilidade: 'publica',
}

const POSTING_PERMISSION_OPTIONS: CommunityPostingPermission[] = [
  'todos_membros',
  'somente_admins',
  'somente_lider',
]

const COMMUNITIES_PAGE_SIZE = 6

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
  const navigate = useNavigate()

  const [communities, setCommunities] = useState<CommunitySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState('')
  const [categoriaFilter, setCategoriaFilter] = useState<CommunityCategoryValue | ''>('')
  const [currentPage, setCurrentPage] = useState(1)
  const [draft, setDraft] = useState<CommunityDraft>(initialDraft)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null)
  const [selectedGame, setSelectedGame] = useState<CatalogGamePreview | null>(null)
  const [gameSearch, setGameSearch] = useState('')
  const [gameResults, setGameResults] = useState<CatalogGamePreview[]>([])
  const [gameSearchLoading, setGameSearchLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

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

  const loadCommunities = useCallback(async () => {
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
    setFeedback(result.error ? { tone: 'error', message: result.error.message } : null)
    setLoading(false)
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

  useEffect(() => {
    const query = gameSearch.trim()
    if (query.length < 2) {
      setGameResults([])
      setGameSearchLoading(false)
      return
    }

    let isActive = true
    setGameSearchLoading(true)

    const timeoutId = window.setTimeout(async () => {
      const result = await searchCatalogGamesByTitle(query, { limit: 5 })
      if (!isActive) return
      setGameResults(result.data)
      setGameSearchLoading(false)
    }, 240)

    return () => {
      isActive = false
      window.clearTimeout(timeoutId)
    }
  }, [gameSearch])

  useEffect(() => {
    if (!bannerFile) {
      setBannerPreviewUrl(null)
      return
    }

    const previewUrl = URL.createObjectURL(bannerFile)
    setBannerPreviewUrl(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [bannerFile])

  const updateDraft = <K extends keyof CommunityDraft>(field: K, value: CommunityDraft[K]) => {
    setDraft(currentDraft => ({
      ...currentDraft,
      [field]: value,
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || submitting) return

    const normalizedName = draft.nome.trim()
    if (normalizedName.length < 3) {
      setFeedback({ tone: 'error', message: t('communities.create.nameMin') })
      return
    }

    setSubmitting(true)
    setFeedback(null)

    try {
      let bannerPath: string | null = null
      if (bannerFile) {
        const uploadResult = await uploadCommunityBannerImage(bannerFile, user.id)
        if (!uploadResult) {
          setFeedback({ tone: 'error', message: t('communities.create.bannerUploadError') })
          setSubmitting(false)
          return
        }
        bannerPath = uploadResult.path
      }

      const result = await createCommunity({
        nome: normalizedName,
        descricao: draft.descricao,
        bannerPath,
        tipo: draft.tipo,
        jogoId: selectedGame?.id || null,
        categoria: draft.categoria || null,
        regras: draft.regras,
        permissaoPostagem: draft.permissaoPostagem,
        visibilidade: draft.visibilidade,
      })

      if (result.error || !result.data) {
        setFeedback({
          tone: 'error',
          message: result.error?.message || t('communities.create.error'),
        })
        return
      }

      setDraft(initialDraft)
      setBannerFile(null)
      setSelectedGame(null)
      setGameSearch('')
      navigate(`/comunidades/${result.data.id}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="communities-page">
          <section className="communities-hero">
            <div>
              <span className="communities-kicker">{t('communities.kicker')}</span>
              <h1>{t('communities.heroTitle')}</h1>
              <p>{t('communities.heroText')}</p>
            </div>
          </section>

          <section className="communities-layout">
            <div className="communities-main">
              <div className="communities-toolbar">
                <label className="communities-field">
                  <span>{t('common.search')}</span>
                  <input
                    type="search"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder={t('communities.searchPlaceholder')}
                  />
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
                  {t('communities.empty')}
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
                          <strong>{formatNumber(community.membros_count)}</strong>
                          <span>{t('communities.members')}</span>
                          <strong>{formatNumber(community.posts_count)}</strong>
                          <span>{t('communities.posts')}</span>
                        </div>
                      </Link>
                    )
                    })}
                  </div>

                  {totalPages > 1 ? (
                    <nav className="community-pagination" aria-label={t('communities.pagination.label')}>
                      <button
                        type="button"
                        className="community-secondary-button"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                      >
                        {t('communities.pagination.previous')}
                      </button>
                      <span>
                        {t('communities.pagination.pageLabel', {
                          page: currentPage,
                          total: totalPages,
                        })}
                      </span>
                      <button
                        type="button"
                        className="community-secondary-button"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                      >
                        {t('communities.pagination.next')}
                      </button>
                    </nav>
                  ) : null}
                </>
              )}
            </div>

            <aside className="communities-create-panel">
              <div className="communities-panel-head">
                <span className="communities-kicker">{t('communities.create.kicker')}</span>
                <h2>{t('communities.create.title')}</h2>
              </div>

              {!user ? (
                <div className="communities-login-card">
                  <p>{t('communities.create.loginText')}</p>
                  <Link to="/login" className="communities-primary-link">
                    {t('common.login')}
                  </Link>
                </div>
              ) : (
                <form className="communities-form" onSubmit={handleSubmit}>
                  <label className="communities-field">
                    <span>{t('communities.field.name')}</span>
                    <input
                      value={draft.nome}
                      onChange={event => updateDraft('nome', event.target.value)}
                      maxLength={80}
                      required
                    />
                  </label>

                  <label className="communities-field">
                    <span>{t('communities.field.description')}</span>
                    <textarea
                      value={draft.descricao}
                      onChange={event => updateDraft('descricao', event.target.value)}
                      maxLength={600}
                    />
                  </label>

                  <div className="communities-form-grid">
                    <label className="communities-field">
                      <span>{t('communities.field.theme')}</span>
                      <input
                        value={draft.tipo}
                        onChange={event => updateDraft('tipo', event.target.value)}
                        placeholder={t('communities.field.themePlaceholder')}
                      />
                    </label>

                    <label className="communities-field">
                      <span>{t('communities.field.category')}</span>
                      <select
                        value={draft.categoria}
                        onChange={event =>
                          updateDraft('categoria', event.target.value as CommunityCategoryValue | '')
                        }
                      >
                        <option value="">{t('communities.field.categoryPlaceholder')}</option>
                        {COMMUNITY_CATEGORY_VALUES.map(option => (
                          <option key={option} value={option}>
                            {t(`communities.category.${option}`)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="communities-field">
                    <span>{t('communities.field.relatedGame')}</span>
                    <input
                      value={selectedGame ? selectedGame.titulo : gameSearch}
                      onChange={event => {
                        setSelectedGame(null)
                        setGameSearch(event.target.value)
                      }}
                      placeholder={t('communities.field.relatedGamePlaceholder')}
                    />
                  </label>

                  {gameSearchLoading ? (
                    <p className="communities-helper">{t('communities.create.searchingGames')}</p>
                  ) : gameResults.length > 0 && !selectedGame ? (
                    <div className="communities-game-results">
                      {gameResults.map(game => (
                        <button
                          key={game.id}
                          type="button"
                          onClick={() => {
                            setSelectedGame(game)
                            setGameSearch(game.titulo)
                            setGameResults([])
                          }}
                        >
                          <span className="communities-game-thumb">
                            {game.capa_url ? (
                              <GameCoverImage
                                src={game.capa_url}
                                alt={game.titulo}
                                width={44}
                                height={44}
                              />
                            ) : (
                              game.titulo.charAt(0).toUpperCase()
                            )}
                          </span>
                          <span>{game.titulo}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className="communities-form-grid">
                    <label className="communities-field">
                      <span>{t('communities.field.postingPermission')}</span>
                      <select
                        value={draft.permissaoPostagem}
                        onChange={event =>
                          updateDraft(
                            'permissaoPostagem',
                            event.target.value as CommunityPostingPermission
                          )
                        }
                      >
                        {POSTING_PERMISSION_OPTIONS.map(option => (
                          <option key={option} value={option}>
                            {t(`communities.permission.${option}`)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="communities-field">
                      <span>{t('communities.field.visibility')}</span>
                      <select
                        value={draft.visibilidade}
                        onChange={event =>
                          updateDraft('visibilidade', event.target.value as CommunityVisibility)
                        }
                      >
                        <option value="publica">{t('communities.visibility.publica')}</option>
                        <option value="privada">{t('communities.visibility.privada')}</option>
                      </select>
                    </label>
                  </div>

                  <label className="communities-field">
                    <span>{t('communities.field.rules')}</span>
                    <textarea
                      value={draft.regras}
                      onChange={event => updateDraft('regras', event.target.value)}
                      maxLength={3000}
                    />
                  </label>

                  <CommunityFilePicker
                    label={t('communities.field.banner')}
                    buttonLabel={t('communities.upload.chooseBanner')}
                    removeLabel={t('communities.upload.removeImage')}
                    uploadingLabel={t('communities.upload.uploading')}
                    previewAlt={t('communities.create.bannerPreview')}
                    helperText={t('communities.upload.bannerHelper')}
                    file={bannerFile}
                    previewUrl={bannerPreviewUrl}
                    disabled={submitting}
                    isUploading={submitting && Boolean(bannerFile)}
                    onChange={setBannerFile}
                  />

                  <button type="submit" className="communities-primary-button" disabled={submitting}>
                    {submitting ? t('communities.create.creating') : t('communities.create.submit')}
                  </button>
                </form>
              )}
            </aside>
          </section>
        </div>
      </div>
    </div>
  )
}

export default CommunitiesPage
