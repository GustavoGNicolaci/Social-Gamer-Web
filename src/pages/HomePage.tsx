import './HomePage.css';

function HomePage() {
  // Mock data for recent reviews
  const recentReviews = [
    {
      id: 1,
      user: 'GamerPro123',
      game: 'The Witcher 3',
      rating: 5,
      review: 'Uma obra-prima! A narrativa é incrível e os gráficos ainda impressionam.',
      time: '2 horas atrás',
      avatar: ''
    },
    {
      id: 2,
      user: 'PixelMaster',
      game: 'Cyberpunk 2077',
      rating: 4,
      review: 'Muito bom, mas teve alguns bugs no lançamento. Vale a pena agora com as atualizações.',
      time: '5 horas atrás',
      avatar: ''
    },
    {
      id: 3,
      user: 'RetroFan',
      game: 'Hades',
      rating: 5,
      review: 'Jogo viciante! Mecânicas perfeitas e replayability alta.',
      time: '1 dia atrás',
      avatar: ''
    }
  ];

  // Mock data for trending games
  const trendingGames = [
    { id: 1, name: 'Elden Ring', genre: 'RPG', rating: 4.8, icon: '' },
    { id: 2, name: 'Baldur\'s Gate 3', genre: 'RPG', rating: 4.9, icon: '' },
    { id: 3, name: 'God of War Ragnarök', genre: 'Ação', rating: 4.7, icon: '' }
  ];

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">Bem-vindo ao Social Gamer! 🎮</h1>
          <p className="hero-subtitle">Conecte-se, compartilhe reviews e descubra novos jogos com sua comunidade.</p>
          <div className="hero-actions">
            <button className="hero-btn primary">✍️ Postar Review</button>
            <button className="hero-btn secondary">👥 Encontrar Jogadores</button>
            <button className="hero-btn secondary">🔍 Explorar Jogos</button>
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
            {recentReviews.map(review => (
              <div key={review.id} className="review-card animate-in">
                <div className="review-header">
                  <div className="user-info">
                    <span className="user-avatar">{review.avatar}</span>
                    <span className="user-name">{review.user}</span>
                  </div>
                  <span className="review-time">{review.time}</span>
                </div>
                <div className="review-content">
                  <h4 className="game-title">{review.game}</h4>
                  <div className="rating">
                    {'⭐'.repeat(review.rating)}
                  </div>
                  <p className="review-text">{review.review}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="sidebar">
          <div className="sidebar-section trending-section">
            <h3 className="sidebar-title">🔥 Jogos em Alta</h3>
            <div className="trending-games">
              {trendingGames.map(game => (
                <div key={game.id} className="trending-game animate-in">
                  <div className="game-icon">{game.icon}</div>
                  <div className="game-info">
                    <h4 className="game-name">{game.name}</h4>
                    <p className="game-meta">{game.genre} • ⭐ {game.rating}</p>
                  </div>
                </div>
              ))}
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
