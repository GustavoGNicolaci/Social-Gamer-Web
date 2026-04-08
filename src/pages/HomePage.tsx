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

interface Activity {
  id: string;
  type: 'review' | 'comment';
  usuario_id: string;
  jogo_id?: number;
  review_id?: string;
  texto: string;
  nota?: number;
  data_publicacao: string;
  jogos?: { titulo: string }[];
  usuarios: { username: string; avatar_url: string | null }[];
  review_jogo?: { titulo: string }[];
}

function HomePage() {
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [trendingGames, setTrendingGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock data for famous communities
  const famousCommunities = [
    { id: 1, name: 'Gamers Brasil', members: 15420, description: 'Comunidade brasileira de jogos' },
    { id: 2, name: 'RPG Masters', members: 8920, description: 'Para amantes de RPGs' },
    { id: 3, name: 'Speedrunners Club', members: 5670, description: 'Mestres do speedrun' }
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch recent reviews
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
          .limit(10);

        // Fetch recent comments
        const { data: comments, error: commentsError } = await supabase
          .from('comentarios')
          .select(`
            id,
            usuario_id,
            review_id,
            texto,
            data_comentario,
            usuarios!inner(username, avatar_url),
            avaliacoes!inner(
              jogo_id,
              jogos!inner(titulo)
            )
          `)
          .order('data_comentario', { ascending: false })
          .limit(10);

        let activities: Activity[] = [];

        if (!reviewsError && reviews) {
          const reviewActivities: Activity[] = reviews.map(review => ({
            id: review.id,
            type: 'review' as const,
            usuario_id: review.usuario_id,
            jogo_id: review.jogo_id,
            texto: review.texto_review || `Avaliou com ${review.nota} estrelas`,
            nota: review.nota,
            data_publicacao: review.data_publicacao,
            jogos: review.jogos,
            usuarios: review.usuarios
          }));
          activities.push(...reviewActivities);
        }

        if (!commentsError && comments) {
          const commentActivities: Activity[] = comments.map(comment => ({
            id: comment.id,
            type: 'comment' as const,
            usuario_id: comment.usuario_id,
            review_id: comment.review_id,
            texto: comment.texto,
            data_publicacao: comment.data_comentario,
            usuarios: comment.usuarios,
            review_jogo: comment.avaliacoes?.[0]?.jogos
          }));
          activities.push(...commentActivities);
        }

        // Sort by date and limit to 15 most recent
        activities.sort((a, b) => new Date(b.data_publicacao).getTime() - new Date(a.data_publicacao).getTime());
        setRecentActivities(activities.slice(0, 15));

        // Fetch trending games (top rated with reviews)
        const { data: games, error: gamesError } = await supabase
          .from('jogos')
          .select('*')
          .order('id', { ascending: false }) // For now, latest games
          .limit(3);

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
            {recentActivities.length === 0 ? (
              <p>Nenhuma atividade recente. Seja o primeiro a avaliar um jogo!</p>
            ) : (
              recentActivities.map(activity => (
                <div key={`${activity.type}-${activity.id}`} className="review-card animate-in">
                  <div className="review-header">
                    <div className="user-info">
                      <span className="user-avatar">
                      {activity.usuarios[0]?.avatar_url ? (
                        <img src={activity.usuarios[0].avatar_url} alt="Avatar" />
                      ) : (
                        activity.usuarios[0]?.username.charAt(0).toUpperCase() || 'U'
                      )}
                    </span>
                    <span className="user-name">{activity.usuarios[0]?.username || 'Usuário'}</span>
                    </div>
                    <span className="review-time">
                      {new Date(activity.data_publicacao).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div className="review-content">
                    {activity.type === 'review' ? (
                      <>
                        <h4 className="game-title">
                          {activity.jogos?.[0]?.titulo || 'Jogo desconhecido'}
                        </h4>
                        <div className="rating">
                          <div className="rating-display">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                              <span
                                key={num}
                                className={`rating-square-display ${num <= (activity.nota || 0) ? 'filled' : ''}`}
                              >
                                {num}
                              </span>
                            ))}
                          </div>
                        </div>
                        <p className="review-text">{activity.texto}</p>
                      </>
                    ) : (
                      <>
                        <h4 className="game-title">
                          Comentou em {activity.review_jogo?.[0]?.titulo || 'uma avaliação'}
                        </h4>
                        <p className="review-text">💬 {activity.texto}</p>
                      </>
                    )}
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
            <h3 className="sidebar-title">👥 Comunidades Famosas</h3>
            <div className="famous-communities">
              {famousCommunities.map(community => (
                <div key={community.id} className="community-item animate-in">
                  <h4>{community.name}</h4>
                  <p className="community-members">{community.members.toLocaleString()} membros</p>
                  <p className="community-desc">{community.description}</p>
                </div>
              ))}
            </div>
            <button className="community-btn">Explorar Mais Comunidades</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
