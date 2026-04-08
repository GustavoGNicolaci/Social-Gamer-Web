import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabase-client';
import { useAuth } from '../contexts/AuthContext';

interface Game {
  id: number;
  titulo: string;
  capa_url: string;
  desenvolvedora: string[] | string;
  generos: string[] | string;
  data_lancamento: string;
  descricao: string;
  plataformas: string[] | string;
}

interface Avaliacao {
  id: string;
  usuario_id: string;
  jogo_id: number;
  nota: number;
  texto_review: string;
  curtidas: number;
  data_publicacao: string;
  editado_em: string | null;
  usuario: {
    username: string;
    avatar_url: string | null;
  };
  comentarios?: Comentario[];
}

interface Comentario {
  id: string;
  usuario_id: string;
  review_id: string;
  texto: string;
  data_comentario: string;
  editado_em: string | null;
  usuario: {
    username: string;
    avatar_url: string | null;
  };
}

function GameDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [game, setGame] = useState<Game | null>(null);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [nota, setNota] = useState<number>(5);
  const [textoReview, setTextoReview] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [comentarioTexto, setComentarioTexto] = useState<{[key: string]: string}>({});
  const [submittingComentario, setSubmittingComentario] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    const fetchGame = async () => {
      if (!id) return;
      const { data, error } = await supabase.from('jogos').select('*').eq('id', Number(id)).single();
      if (error) {
        console.error('Erro ao buscar jogo:', error);
      } else {
        setGame(data || null);
      }
      setLoading(false);
    };

    const fetchAvaliacoes = async () => {
      if (!id) return;
      const { data, error } = await supabase
        .from('avaliacoes')
        .select(`
          *,
          usuario:usuarios(username, avatar_url),
          comentarios(
            *,
            usuario:usuarios(username, avatar_url)
          )
        `)
        .eq('jogo_id', Number(id))
        .order('data_publicacao', { ascending: false });
      if (error) {
        console.error('Erro ao buscar avaliações:', error);
      } else {
        setAvaliacoes(data || []);
      }
    };

    fetchGame();
    fetchAvaliacoes();
  }, [id]);

  const handleSubmitAvaliacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !game) return;

    setSubmitting(true);
    const { error } = await supabase.from('avaliacoes').insert({
      usuario_id: user.id,
      jogo_id: game.id,
      nota,
      texto_review: textoReview,
      curtidas: 0,
      data_publicacao: new Date().toISOString(),
    });

    if (error) {
      console.error('Erro ao enviar avaliação:', error);
    } else {
      setNota(5);
      setTextoReview('');
      // Recarregar avaliações
      const { data } = await supabase
        .from('avaliacoes')
        .select(`
          *,
          usuario:usuarios(username, avatar_url)
        `)
        .eq('jogo_id', game.id)
        .order('data_publicacao', { ascending: false });
      setAvaliacoes(data || []);
    }
    setSubmitting(false);
  };

  const handleSubmitComentario = async (reviewId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !comentarioTexto[reviewId]?.trim()) return;

    setSubmittingComentario(prev => ({ ...prev, [reviewId]: true }));
    const { error } = await supabase.from('comentarios').insert({
      usuario_id: user.id,
      review_id: reviewId,
      texto: comentarioTexto[reviewId],
      data_comentario: new Date().toISOString(),
    });

    if (error) {
      console.error('Erro ao enviar comentário:', error);
    } else {
      setComentarioTexto(prev => ({ ...prev, [reviewId]: '' }));
      // Recarregar avaliações com comentários
      if (game) {
        const { data } = await supabase
          .from('avaliacoes')
          .select(`
            *,
            usuario:usuarios(username, avatar_url),
            comentarios(
              *,
              usuario:usuarios(username, avatar_url)
            )
          `)
          .eq('jogo_id', game.id)
          .order('data_publicacao', { ascending: false });
        setAvaliacoes(data || []);
      }
    }
    setSubmittingComentario(prev => ({ ...prev, [reviewId]: false }));
  };

  if (loading) {
    return <div className="page-container"><div className="page-content"><h1>Carregando...</h1></div></div>;
  }

  if (!game) {
    return (
      <div className="page-container">
        <div className="page-content">
          <h1>Jogo não encontrado</h1>
          <Link to="/games" className="game-button">Voltar aos jogos</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-content game-details">
        <section className="game-banner">
          {game.capa_url && <img src={game.capa_url} alt={game.titulo} className="game-banner-image" />}
          <div className="game-banner-overlay">
            <h1>{game.titulo}</h1>
            <p className="game-genres">{Array.isArray(game.generos) ? game.generos.join(' • ') : game.generos}</p>
          </div>
        </section>

        <section className="game-meta">
          <div className="game-meta-item">
            <span>Desenvolvedora</span>
            <strong>{Array.isArray(game.desenvolvedora) ? game.desenvolvedora.join(', ') : game.desenvolvedora}</strong>
          </div>
          <div className="game-meta-item">
            <span>Plataformas</span>
            <strong>{Array.isArray(game.plataformas) ? game.plataformas.join(', ') : game.plataformas}</strong>
          </div>
          <div className="game-meta-item">
            <span>Data de lançamento</span>
            <strong>{new Date(game.data_lancamento).toLocaleDateString('pt-BR')}</strong>
          </div>
        </section>

        <section className="game-description">
          <h2>Descrição</h2>
          <p>{game.descricao}</p>
        </section>

        <section className="game-reviews">
          <h2>Avaliações</h2>
          {user ? (
            <form onSubmit={handleSubmitAvaliacao} className="review-form">
              <div className="rating-input">
                <label>Nota (1-10):</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={nota}
                  onChange={(e) => setNota(Number(e.target.value))}
                  required
                />
              </div>
              <div className="review-text">
                <label>Comentário:</label>
                <textarea
                  value={textoReview}
                  onChange={(e) => setTextoReview(e.target.value)}
                  placeholder="Escreva sua avaliação..."
                  required
                />
              </div>
              <button type="submit" disabled={submitting} className="game-button">
                {submitting ? 'Enviando...' : 'Enviar Avaliação'}
              </button>
            </form>
          ) : (
            <div className="login-prompt">
              <p>Para avaliar este jogo, você precisa estar logado.</p>
              <Link to="/login" className="game-button">Fazer Login</Link>
            </div>
          )}

          <div className="reviews-list">
            {avaliacoes.length === 0 ? (
              <p>Nenhuma avaliação ainda.</p>
            ) : (
              avaliacoes.map((avaliacao) => (
                <div key={avaliacao.id} className="review-item">
                  <div className="review-header">
                    <div className="review-user">
                      {avaliacao.usuario.avatar_url && (
                        <img src={avaliacao.usuario.avatar_url} alt={avaliacao.usuario.username} className="user-avatar" />
                      )}
                      <span className="username">{avaliacao.usuario.username}</span>
                    </div>
                    <div className="review-rating">
                      <span className="rating-stars">{'★'.repeat(avaliacao.nota)}{'☆'.repeat(10 - avaliacao.nota)}</span>
                      <span className="rating-number">({avaliacao.nota}/10)</span>
                    </div>
                  </div>
                  {avaliacao.texto_review && (
                    <p className="review-text">{avaliacao.texto_review}</p>
                  )}
                  <div className="review-footer">
                    <span className="review-date">
                      {new Date(avaliacao.data_publicacao).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="review-likes">👍 {avaliacao.curtidas}</span>
                  </div>

                  {/* Comentários */}
                  <div className="comments-section">
                    {avaliacao.comentarios && avaliacao.comentarios.length > 0 && (
                      <div className="comments-list">
                        {avaliacao.comentarios.map((comentario) => (
                          <div key={comentario.id} className="comment-item">
                            <div className="comment-user">
                              {comentario.usuario.avatar_url && (
                                <img src={comentario.usuario.avatar_url} alt={comentario.usuario.username} className="user-avatar-small" />
                              )}
                              <span className="username-small">{comentario.usuario.username}</span>
                            </div>
                            <p className="comment-text">{comentario.texto}</p>
                            <span className="comment-date">
                              {new Date(comentario.data_comentario).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {user && (
                      <form onSubmit={(e) => handleSubmitComentario(avaliacao.id, e)} className="comment-form">
                        <textarea
                          value={comentarioTexto[avaliacao.id] || ''}
                          onChange={(e) => setComentarioTexto(prev => ({ ...prev, [avaliacao.id]: e.target.value }))}
                          placeholder="Adicione um comentário..."
                          required
                        />
                        <button type="submit" disabled={submittingComentario[avaliacao.id]} className="comment-button">
                          {submittingComentario[avaliacao.id] ? 'Enviando...' : 'Comentar'}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <div className="game-actions">
          <Link to="/games" className="game-button secondary">Voltar</Link>
        </div>
      </div>
    </div>
  );
}

export default GameDetailsPage;
