import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../supabase-client'
import './GameDetailsPage.css'

interface Game {
  id: number
  titulo: string
  capa_url: string
  desenvolvedora: string[] | string
  generos: string[] | string
  data_lancamento: string
  descricao: string
  plataformas: string[] | string
}

interface UsuarioPerfil {
  username: string
  avatar_url: string | null
}

type UsuarioRelacionamento = UsuarioPerfil | UsuarioPerfil[] | null

interface Comentario {
  id: string
  usuario_id: string
  review_id: string
  texto: string
  data_comentario: string
  editado_em: string | null
  usuario: UsuarioRelacionamento
}

interface Avaliacao {
  id: string
  usuario_id: string
  jogo_id: number
  nota: number
  texto_review: string
  curtidas: number
  data_publicacao: string
  editado_em: string | null
  usuario: UsuarioRelacionamento
  comentarios?: Comentario[]
}

const REVIEW_SCORE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

const REVIEWS_QUERY = `
  *,
  usuario:usuarios(username, avatar_url),
  comentarios(
    *,
    usuario:usuarios(username, avatar_url)
  )
`

function normalizeList(value: string[] | string | null | undefined) {
  if (!value) return []
  return Array.isArray(value) ? value.filter(Boolean) : [value]
}

function formatList(value: string[] | string | null | undefined, fallback: string) {
  const items = normalizeList(value)
  return items.length > 0 ? items.join(', ') : fallback
}

function formatDate(value: string | null | undefined, fallback = 'Nao informado') {
  if (!value) return fallback

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return fallback

  return parsedDate.toLocaleDateString('pt-BR')
}

function getSummaryText(value: string | null | undefined) {
  const normalizedValue = value?.trim() || ''

  if (!normalizedValue) return 'Descricao nao informada.'
  if (normalizedValue.length <= 220) return normalizedValue

  return `${normalizedValue.slice(0, 217).trim()}...`
}

function resolveUser(usuario: UsuarioRelacionamento) {
  if (Array.isArray(usuario)) return usuario[0] || null
  return usuario
}

function getUserName(usuario: UsuarioRelacionamento) {
  return resolveUser(usuario)?.username || 'Usuario'
}

function getUserAvatar(usuario: UsuarioRelacionamento) {
  return resolveUser(usuario)?.avatar_url || null
}

function getInitial(name: string) {
  const firstCharacter = name.trim().charAt(0)
  return firstCharacter ? firstCharacter.toUpperCase() : 'U'
}

async function fetchAvaliacoesByGameId(gameId: number) {
  const { data, error } = await supabase
    .from('avaliacoes')
    .select(REVIEWS_QUERY)
    .eq('jogo_id', gameId)
    .order('data_publicacao', { ascending: false })

  if (error) {
    console.error('Erro ao buscar avaliacoes:', error)
    return []
  }

  return (data || []) as Avaliacao[]
}

function GameDetailsPage() {
  const { id } = useParams()
  const { user } = useAuth()

  const [game, setGame] = useState<Game | null>(null)
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([])
  const [loading, setLoading] = useState(true)
  const [nota, setNota] = useState(5)
  const [textoReview, setTextoReview] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [comentarioTexto, setComentarioTexto] = useState<Record<string, string>>({})
  const [submittingComentario, setSubmittingComentario] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let isMounted = true
    const gameId = Number(id)

    const fetchPageData = async () => {
      if (!id || Number.isNaN(gameId)) {
        if (isMounted) {
          setGame(null)
          setAvaliacoes([])
          setLoading(false)
        }
        return
      }

      setLoading(true)

      const [gameResponse, loadedAvaliacoes] = await Promise.all([
        supabase.from('jogos').select('*').eq('id', gameId).single(),
        fetchAvaliacoesByGameId(gameId),
      ])

      if (!isMounted) return

      if (gameResponse.error) {
        console.error('Erro ao buscar jogo:', gameResponse.error)
        setGame(null)
      } else {
        setGame((gameResponse.data as Game | null) || null)
      }

      setAvaliacoes(loadedAvaliacoes)
      setLoading(false)
    }

    void fetchPageData()

    return () => {
      isMounted = false
    }
  }, [id])

  const handleSubmitAvaliacao = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !game) return

    setSubmitting(true)
    const { error } = await supabase.from('avaliacoes').insert({
      usuario_id: user.id,
      jogo_id: game.id,
      nota,
      texto_review: textoReview,
      curtidas: 0,
      data_publicacao: new Date().toISOString(),
    })

    if (error) {
      console.error('Erro ao enviar avaliacao:', error)
    } else {
      setNota(5)
      setTextoReview('')
      const updatedAvaliacoes = await fetchAvaliacoesByGameId(game.id)
      setAvaliacoes(updatedAvaliacoes)
    }

    setSubmitting(false)
  }

  const handleSubmitComentario = async (reviewId: string, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !comentarioTexto[reviewId]?.trim()) return

    setSubmittingComentario(prevState => ({ ...prevState, [reviewId]: true }))
    const { error } = await supabase.from('comentarios').insert({
      usuario_id: user.id,
      review_id: reviewId,
      texto: comentarioTexto[reviewId],
      data_comentario: new Date().toISOString(),
    })

    if (error) {
      console.error('Erro ao enviar comentario:', error)
    } else if (game) {
      setComentarioTexto(prevState => ({ ...prevState, [reviewId]: '' }))
      const updatedAvaliacoes = await fetchAvaliacoesByGameId(game.id)
      setAvaliacoes(updatedAvaliacoes)
    }

    setSubmittingComentario(prevState => ({ ...prevState, [reviewId]: false }))
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-content game-details-page">
          <section className="game-details-state-card">
            <span className="game-details-state-badge">GamePage</span>
            <h1>Carregando detalhes do jogo</h1>
            <p>Estamos preparando capa, informacoes principais e avaliacoes da comunidade.</p>
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
            <span className="game-details-state-badge">GamePage</span>
            <h1>Jogo nao encontrado</h1>
            <p>O item solicitado nao esta disponivel no catalogo ou pode ter sido removido.</p>
            <div className="game-details-state-actions">
              <Link to="/games" className="game-button game-details-secondary-button">
                Voltar ao catalogo
              </Link>
            </div>
          </section>
        </div>
      </div>
    )
  }

  const generos = normalizeList(game.generos)
  const desenvolvedoras = normalizeList(game.desenvolvedora)
  const plataformas = normalizeList(game.plataformas)
  const releaseDate = formatDate(game.data_lancamento)
  const descricaoCompleta = game.descricao?.trim() || 'Descricao nao informada.'
  const resumoDescricao = getSummaryText(game.descricao)
  const totalAvaliacoes = avaliacoes.length
  const totalComentarios = avaliacoes.reduce(
    (commentCount, avaliacao) => commentCount + (avaliacao.comentarios?.length || 0),
    0
  )
  const mediaAvaliacoes =
    totalAvaliacoes > 0
      ? avaliacoes.reduce((scoreTotal, avaliacao) => scoreTotal + avaliacao.nota, 0) /
        totalAvaliacoes
      : null
  const mediaAvaliacoesLabel = mediaAvaliacoes
    ? mediaAvaliacoes.toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
    : 'Sem notas'
  const totalAvaliacoesLabel =
    totalAvaliacoes === 1 ? '1 avaliacao' : `${totalAvaliacoes} avaliacoes`
  const totalComentariosLabel =
    totalComentarios === 1 ? '1 comentario' : `${totalComentarios} comentarios`

  return (
    <div className="page-container">
      <div className="page-content game-details-page">
        <section className="game-details-hero">
          <div className="game-details-hero-glow game-details-hero-glow-left"></div>
          <div className="game-details-hero-glow game-details-hero-glow-right"></div>

          <div className="game-details-hero-grid">
            <div className="game-details-cover-card">
              {game.capa_url ? (
                <img
                  src={game.capa_url}
                  alt={`Capa do jogo ${game.titulo}`}
                  className="game-details-cover-image"
                />
              ) : (
                <div className="game-details-cover-fallback">
                  <span>{getInitial(game.titulo)}</span>
                </div>
              )}

              <div className="game-details-cover-top">
                <span className="game-details-pill">Catalogo Social Gamer</span>
                <span className="game-details-cover-date">{releaseDate}</span>
              </div>

              <div className="game-details-cover-bottom">
                <div className="game-details-score-chip">
                  <span className="game-details-score-label">Media</span>
                  <strong>{mediaAvaliacoes ? `${mediaAvaliacoesLabel}/10` : mediaAvaliacoesLabel}</strong>
                </div>
              </div>
            </div>

            <div className="game-details-hero-copy">
              <span className="game-details-eyebrow">Detalhes do jogo</span>
              <h1>{game.titulo}</h1>
              <p className="game-details-summary">{resumoDescricao}</p>

              <div className="game-details-chip-section">
                <span className="game-details-chip-label">Categorias</span>

                <div className="game-details-chip-row">
                  {generos.length > 0 ? (
                    generos.map(genero => (
                      <span key={genero} className="genre-chip game-details-chip">
                        {genero}
                      </span>
                    ))
                  ) : (
                    <span className="game-details-muted-chip">Genero nao informado</span>
                  )}
                </div>
              </div>

              <div className="game-details-actions">
                {user ? (
                  <a href="#game-community" className="game-button game-details-primary-button">
                    Avaliar agora
                  </a>
                ) : (
                  <Link to="/login" className="game-button game-details-primary-button">
                    Fazer login para avaliar
                  </Link>
                )}

                <Link to="/games" className="game-button game-details-secondary-button">
                  Voltar ao catalogo
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="game-details-highlights" aria-label="Informacoes principais">
          <article className="game-details-highlight-card">
            <span className="game-details-highlight-label">Desenvolvedora</span>
            <strong>{formatList(desenvolvedoras, 'Nao informada')}</strong>
          </article>

          <article className="game-details-highlight-card">
            <span className="game-details-highlight-label">Plataformas</span>
            <strong>{formatList(plataformas, 'Nao informadas')}</strong>
          </article>

          <article className="game-details-highlight-card">
            <span className="game-details-highlight-label">Lancamento</span>
            <strong>{releaseDate}</strong>
          </article>

          <article className="game-details-highlight-card">
            <span className="game-details-highlight-label">Comunidade</span>
            <strong>{mediaAvaliacoes ? `${mediaAvaliacoesLabel}/10` : 'Ainda sem notas'}</strong>
            <small>{`${totalAvaliacoesLabel} | ${totalComentariosLabel}`}</small>
          </article>
        </section>

        <section className="game-details-info-grid">
          <article className="game-details-panel game-details-panel-full">
            <span className="game-details-panel-kicker">Descricao</span>
            <h2>Sobre o jogo</h2>
            <p className="game-details-description-body">{descricaoCompleta}</p>
          </article>
        </section>

        <section id="game-community" className="game-details-reviews">
          <div className="game-details-section-heading">
            <div>
              <span className="game-details-panel-kicker">Comunidade</span>
              <h2>Avaliacoes e comentarios</h2>
              <p>Veja como a comunidade descreve a experiencia deste jogo.</p>
            </div>
          </div>

          {user ? (
            <form onSubmit={handleSubmitAvaliacao} className="game-details-review-form">
              <div className="game-details-form-block">
                <label className="game-details-form-label">Sua nota</label>
                <div className="game-details-rating-grid">
                  {REVIEW_SCORE_OPTIONS.map(score => (
                    <button
                      key={score}
                      type="button"
                      className={`game-details-rating-button${nota === score ? ' is-selected' : ''}`}
                      onClick={() => setNota(score)}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>

              <div className="game-details-form-block">
                <label htmlFor="game-review-text" className="game-details-form-label">
                  Comentario
                </label>
                <textarea
                  id="game-review-text"
                  className="game-details-textarea"
                  value={textoReview}
                  onChange={event => setTextoReview(event.target.value)}
                  placeholder="Compartilhe sua opiniao sobre jogabilidade, historia, visual ou comunidade."
                  required
                />
              </div>

              <div className="game-details-review-form-footer">
                <span className="game-details-form-helper">
                  Sua avaliacao aparece junto com os reviews da comunidade.
                </span>
                <button
                  type="submit"
                  disabled={submitting}
                  className="game-button game-details-primary-button game-details-submit-button"
                >
                  {submitting ? 'Enviando...' : 'Enviar avaliacao'}
                </button>
              </div>
            </form>
          ) : (
            <div className="game-details-login-card">
              <div>
                <span className="game-details-panel-kicker">Participar</span>
                <h3>Entre para avaliar este jogo</h3>
                <p>Faca login para publicar reviews e comentar nas avaliacoes da comunidade.</p>
              </div>

              <Link to="/login" className="game-button game-details-primary-button">
                Fazer login
              </Link>
            </div>
          )}

          <div className="game-details-review-list">
            {avaliacoes.length === 0 ? (
              <div className="game-details-empty-card">
                <h3>Nenhuma avaliacao por enquanto</h3>
                <p>Seja a primeira pessoa a compartilhar uma opiniao sobre este titulo.</p>
              </div>
            ) : (
              avaliacoes.map(avaliacao => {
                const avaliadorNome = getUserName(avaliacao.usuario)
                const avaliadorAvatar = getUserAvatar(avaliacao.usuario)
                const comentarios = avaliacao.comentarios || []

                return (
                  <article key={avaliacao.id} className="game-review-card">
                    <div className="game-review-card-header">
                      <div className="game-review-user">
                        {avaliadorAvatar ? (
                          <img
                            src={avaliadorAvatar}
                            alt={`Avatar de ${avaliadorNome}`}
                            className="game-review-avatar"
                          />
                        ) : (
                          <span className="game-review-avatar-fallback">
                            {getInitial(avaliadorNome)}
                          </span>
                        )}

                        <div className="game-review-user-copy">
                          <strong>{avaliadorNome}</strong>
                          <span>{formatDate(avaliacao.data_publicacao)}</span>
                        </div>
                      </div>

                      <div className="game-review-score">
                        <div className="game-review-score-grid">
                          {REVIEW_SCORE_OPTIONS.map(score => (
                            <span
                              key={score}
                              className={`game-review-score-pill${score <= avaliacao.nota ? ' is-filled' : ''}`}
                            >
                              {score}
                            </span>
                          ))}
                        </div>
                        <span className="game-review-score-label">{avaliacao.nota}/10</span>
                      </div>
                    </div>

                    {avaliacao.texto_review && <p className="game-review-body">{avaliacao.texto_review}</p>}

                    <div className="game-review-meta">
                      <span>{avaliacao.curtidas} curtidas</span>
                      <span>{comentarios.length === 1 ? '1 comentario' : `${comentarios.length} comentarios`}</span>
                    </div>

                    <div className="game-review-comments">
                      {comentarios.length > 0 && (
                        <div className="game-review-comments-list">
                          {comentarios.map(comentario => {
                            const autorComentario = getUserName(comentario.usuario)
                            const avatarComentario = getUserAvatar(comentario.usuario)

                            return (
                              <div key={comentario.id} className="game-review-comment-card">
                                <div className="game-review-comment-header">
                                  <div className="game-review-comment-author">
                                    {avatarComentario ? (
                                      <img
                                        src={avatarComentario}
                                        alt={`Avatar de ${autorComentario}`}
                                        className="game-review-comment-avatar"
                                      />
                                    ) : (
                                      <span className="game-review-comment-avatar-fallback">
                                        {getInitial(autorComentario)}
                                      </span>
                                    )}

                                    <strong>{autorComentario}</strong>
                                  </div>

                                  <span className="game-review-comment-date">
                                    {formatDate(comentario.data_comentario)}
                                  </span>
                                </div>

                                <p className="game-review-comment-body">{comentario.texto}</p>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {user && (
                        <form
                          onSubmit={event => handleSubmitComentario(avaliacao.id, event)}
                          className="game-review-comment-form"
                        >
                          <textarea
                            className="game-review-comment-input"
                            value={comentarioTexto[avaliacao.id] || ''}
                            onChange={event =>
                              setComentarioTexto(prevState => ({
                                ...prevState,
                                [avaliacao.id]: event.target.value,
                              }))
                            }
                            placeholder="Adicione um comentario para continuar a conversa."
                            required
                          />

                          <button
                            type="submit"
                            disabled={submittingComentario[avaliacao.id]}
                            className="game-review-comment-button"
                          >
                            {submittingComentario[avaliacao.id] ? 'Enviando...' : 'Comentar'}
                          </button>
                        </form>
                      )}
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export default GameDetailsPage
