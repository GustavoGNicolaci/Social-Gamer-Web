import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GameCoverImage } from '../components/GameCoverImage'
import { useAuth } from '../contexts/AuthContext'
import {
  createCommunity,
  getCommunities,
  type CommunityPostingPermission,
  type CommunitySummary,
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
  categoria: string
  regras: string
  permissaoPostagem: CommunityPostingPermission
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
}

const POSTING_PERMISSION_OPTIONS: Array<{ value: CommunityPostingPermission; label: string }> = [
  { value: 'todos_membros', label: 'Todos os membros' },
  { value: 'somente_admins', label: 'Lider e administradores' },
  { value: 'somente_lider', label: 'Somente lider' },
]

function getCommunityImage(community: CommunitySummary) {
  return resolvePublicFileUrl(community.banner_path) || community.jogo?.capa_url || null
}

function getCommunityMeta(community: CommunitySummary) {
  return [community.tipo, community.categoria, community.jogo?.titulo].filter(Boolean).join(' / ')
}

function uniqueSorted(values: Array<string | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((a, b) =>
    a.localeCompare(b, 'pt-BR')
  )
}

function CommunitiesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [communities, setCommunities] = useState<CommunitySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState('')
  const [categoriaFilter, setCategoriaFilter] = useState('')
  const [draft, setDraft] = useState<CommunityDraft>(initialDraft)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [selectedGame, setSelectedGame] = useState<CatalogGamePreview | null>(null)
  const [gameSearch, setGameSearch] = useState('')
  const [gameResults, setGameResults] = useState<CatalogGamePreview[]>([])
  const [gameSearchLoading, setGameSearchLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const tipoOptions = useMemo(() => uniqueSorted(communities.map(community => community.tipo)), [communities])
  const categoriaOptions = useMemo(
    () => uniqueSorted(communities.map(community => community.categoria)),
    [communities]
  )

  const loadCommunities = useCallback(async () => {
    setLoading(true)
    const result = await getCommunities(
      {
        search,
        tipo: tipoFilter || undefined,
        categoria: categoriaFilter || undefined,
      },
      user?.id
    )

    setCommunities(result.data)
    setFeedback(result.error ? { tone: 'error', message: result.error.message } : null)
    setLoading(false)
  }, [categoriaFilter, search, tipoFilter, user?.id])

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

  const updateDraft = <K extends keyof CommunityDraft>(field: K, value: CommunityDraft[K]) => {
    setDraft(currentDraft => ({
      ...currentDraft,
      [field]: value,
    }))
  }

  const handleBannerChange = (event: ChangeEvent<HTMLInputElement>) => {
    setBannerFile(event.target.files?.[0] || null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || submitting) return

    const normalizedName = draft.nome.trim()
    if (normalizedName.length < 3) {
      setFeedback({ tone: 'error', message: 'Informe um nome com pelo menos 3 caracteres.' })
      return
    }

    setSubmitting(true)
    setFeedback(null)

    try {
      let bannerPath: string | null = null
      if (bannerFile) {
        const uploadResult = await uploadCommunityBannerImage(bannerFile, user.id)
        if (!uploadResult) {
          setFeedback({ tone: 'error', message: 'Nao foi possivel enviar o banner.' })
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
        categoria: draft.categoria,
        regras: draft.regras,
        permissaoPostagem: draft.permissaoPostagem,
      })

      if (result.error || !result.data) {
        setFeedback({
          tone: 'error',
          message: result.error?.message || 'Nao foi possivel criar a comunidade.',
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
              <span className="communities-kicker">Comunidades</span>
              <h1>Espacos para jogar junto, discutir e organizar ideias</h1>
              <p>
                Crie ou participe de comunidades sobre jogos, generos, desafios, noticias e qualquer
                assunto que combine com a proposta do Social Gamer.
              </p>
            </div>
          </section>

          <section className="communities-layout">
            <div className="communities-main">
              <div className="communities-toolbar">
                <label className="communities-field">
                  <span>Buscar</span>
                  <input
                    type="search"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Nome ou descricao"
                  />
                </label>

                <label className="communities-field">
                  <span>Tema</span>
                  <select value={tipoFilter} onChange={event => setTipoFilter(event.target.value)}>
                    <option value="">Todos</option>
                    {tipoOptions.map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="communities-field">
                  <span>Categoria</span>
                  <select
                    value={categoriaFilter}
                    onChange={event => setCategoriaFilter(event.target.value)}
                  >
                    <option value="">Todas</option>
                    {categoriaOptions.map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {feedback ? (
                <p className={`communities-feedback is-${feedback.tone}`}>{feedback.message}</p>
              ) : null}

              {loading ? (
                <div className="communities-state-card">Carregando comunidades...</div>
              ) : communities.length === 0 ? (
                <div className="communities-state-card">
                  Nenhuma comunidade encontrada com esses filtros.
                </div>
              ) : (
                <div className="communities-grid">
                  {communities.map(community => {
                    const imageUrl = getCommunityImage(community)
                    const meta = getCommunityMeta(community)

                    return (
                      <Link
                        key={community.id}
                        to={`/comunidades/${community.id}`}
                        className="community-card"
                      >
                        <div className="community-card-media">
                          {imageUrl ? (
                            <img src={imageUrl} alt="" />
                          ) : (
                            <div className="community-card-fallback">
                              {community.nome.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div className="community-card-copy">
                          {meta ? <span>{meta}</span> : <span>Comunidade geral</span>}
                          <h2>{community.nome}</h2>
                          <p>{community.descricao || 'Sem descricao informada.'}</p>
                        </div>

                        <div className="community-card-stats">
                          <strong>{community.membros_count}</strong>
                          <span>membros</span>
                          <strong>{community.posts_count}</strong>
                          <span>posts</span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            <aside className="communities-create-panel">
              <div className="communities-panel-head">
                <span className="communities-kicker">Criar</span>
                <h2>Nova comunidade</h2>
              </div>

              {!user ? (
                <div className="communities-login-card">
                  <p>Entre na sua conta para criar uma comunidade e virar lider dela.</p>
                  <Link to="/login" className="communities-primary-link">
                    Fazer login
                  </Link>
                </div>
              ) : (
                <form className="communities-form" onSubmit={handleSubmit}>
                  <label className="communities-field">
                    <span>Nome</span>
                    <input
                      value={draft.nome}
                      onChange={event => updateDraft('nome', event.target.value)}
                      maxLength={80}
                      required
                    />
                  </label>

                  <label className="communities-field">
                    <span>Descricao</span>
                    <textarea
                      value={draft.descricao}
                      onChange={event => updateDraft('descricao', event.target.value)}
                      maxLength={600}
                    />
                  </label>

                  <div className="communities-form-grid">
                    <label className="communities-field">
                      <span>Tema</span>
                      <input
                        value={draft.tipo}
                        onChange={event => updateDraft('tipo', event.target.value)}
                        placeholder="RPG, e-sports..."
                      />
                    </label>

                    <label className="communities-field">
                      <span>Categoria</span>
                      <input
                        value={draft.categoria}
                        onChange={event => updateDraft('categoria', event.target.value)}
                        placeholder="Guias, memes..."
                      />
                    </label>
                  </div>

                  <label className="communities-field">
                    <span>Jogo relacionado</span>
                    <input
                      value={selectedGame ? selectedGame.titulo : gameSearch}
                      onChange={event => {
                        setSelectedGame(null)
                        setGameSearch(event.target.value)
                      }}
                      placeholder="Buscar jogo"
                    />
                  </label>

                  {gameSearchLoading ? (
                    <p className="communities-helper">Buscando jogos...</p>
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

                  <label className="communities-field">
                    <span>Quem pode postar</span>
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
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="communities-field">
                    <span>Regras</span>
                    <textarea
                      value={draft.regras}
                      onChange={event => updateDraft('regras', event.target.value)}
                      maxLength={3000}
                    />
                  </label>

                  <label className="communities-field">
                    <span>Banner opcional</span>
                    <input type="file" accept="image/*" onChange={handleBannerChange} />
                  </label>

                  <button type="submit" className="communities-primary-button" disabled={submitting}>
                    {submitting ? 'Criando...' : 'Criar comunidade'}
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
