import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase-client';
import './HomePage.css';

interface Game {
  id: number;
  titulo: string;
  capa_url: string;
  generos: string[];
  data_lancamento: string;
}

interface Review {
  id: string;
  usuario_id: string;
  jogo_id: number;
  texto_review: string;
  nota: number;
  data_publicacao: string;
  jogos: { titulo: string }[];
  usuarios: { username: string; avatar_url: string | null }[];
}

function HomePage() {
  const [recentReviews, setRecentReviews] = useState<Review[]>([]);
  const [trendingGames, setTrendingGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch recent reviews with user and game info
        const { data: reviews, error: reviewsError } = await supabase
          .from('avaliacoes')
          .select(`
            id,
            usuario_id,
            jogo_id,
            texto_review,
            nota,
            data_publicacao,
            jogos!inner(titulo),
            usuarios!inner(username, avatar_url)
          `)
          .order('data_publicacao', { ascending: false })
          .limit(5);

        if (reviewsError) {
          console.error('Error fetching reviews:', reviewsError);
        } else {
          setRecentReviews(reviews || []);
        }

        // Fetch trending games (top rated with reviews)
        const { data: games, error: gamesError } = await supabase
          .from('jogos')
          .select('*')
          .order('id', { ascending: false }) // For now, latest games
          .limit(6);

        if (gamesError) {
          console.error('Error fetching games:', gamesError);
        } else {
          setTrendingGames(games || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-content">
          <h1>Carregando...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">Bem-vindo ao Social Gamer! 🎮</h1>
          <p className="hero-subtitle">Conecte-se, compartilhe reviews e descubra novos jogos com sua comunidade.</p>
          <div className="hero-actions">
            <Link to="/games" className="hero-btn primary">🔍 Explorar Jogos</Link>
            <button className="hero-btn secondary">👥 Encontrar Jogadores</button>
            <button className="hero-btn secondary">✍️ Postar Review</button>
          </div>
        </div>
        <div className="hero-visual">
          <div className="floating-icons">
            <span className="icon icon-1">🎯</span>
            <span className="icon icon-2">🏆</span>
            <span className="icon icon-3">🎲</span>
            <span className="icon icon-4">🕹️</span>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="home-content">
        {/* Feed Section */}
        <div className="feed-section">
          <h2 className="section-title">Atividades Recentes</h2>
          <div className="reviews-feed">
            {recentReviews.length === 0 ? (
              <p>Nenhuma review recente. Seja o primeiro a avaliar um jogo!</p>
            ) : (
              recentReviews.map(review => (
                <div key={review.id} className="review-card animate-in">
                  <div className="review-header">
                    <div className="user-info">
                      <span className="user-avatar">
                      {review.usuarios[0]?.avatar_url ? (
                        <img src={review.usuarios[0].avatar_url} alt="Avatar" />
                      ) : (
                        review.usuarios[0]?.username.charAt(0).toUpperCase() || 'U'
                      )}
                    </span>
                    <span className="user-name">{review.usuarios[0]?.username || 'Usuário'}</span>
                    </div>
                    <span className="review-time">
                      {new Date(review.data_publicacao).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div className="review-content">
                    <h4 className="game-title">{review.jogos[0]?.titulo || 'Jogo desconhecido'}</h4>
                    <div className="rating">
                      {'⭐'.repeat(Math.floor(review.nota))}
                    </div>
                    <p className="review-text">{review.texto_review}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="sidebar">
          <div className="sidebar-section trending-section">
            <h3 className="sidebar-title">🔥 Jogos em Destaque</h3>
            <div className="trending-games">
              {trendingGames.length === 0 ? (
                <p>Nenhum jogo encontrado.</p>
              ) : (
                trendingGames.map(game => (
                  <Link key={game.id} to={`/games/${game.id}`} className="trending-game animate-in">
                    <div className="game-icon">
                      {game.capa_url ? (
                        <img src={game.capa_url} alt={game.titulo} />
                      ) : (
                        '🎮'
                      )}
                    </div>
                    <div className="game-info">
                      <h4 className="game-name">{game.titulo}</h4>
                      <p className="game-meta">
                        {game.generos ? game.generos.slice(0, 2).join(', ') : 'Gênero não informado'}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
          <div className="sidebar-section community-section">
            <h3 className="sidebar-title">👥 Comunidade</h3>
            <p className="community-text">Veja as últimas atividades dos gamers que você segue.</p>
            <button className="community-btn">Explorar Comunidade</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
