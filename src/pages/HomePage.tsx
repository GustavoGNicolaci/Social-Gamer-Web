import React from 'react';
import './HomePage.css'; // Assuming we'll add styles

function HomePage() {
  // Mock data for recent reviews
  const recentReviews = [
    {
      id: 1,
      user: 'GamerPro123',
      game: 'The Witcher 3',
      rating: 5,
      review: 'Uma obra-prima! A narrativa é incrível e os gráficos ainda impressionam.',
      time: '2 horas atrás'
    },
    {
      id: 2,
      user: 'PixelMaster',
      game: 'Cyberpunk 2077',
      rating: 4,
      review: 'Muito bom, mas teve alguns bugs no lançamento. Vale a pena agora com as atualizações.',
      time: '5 horas atrás'
    },
    {
      id: 3,
      user: 'RetroFan',
      game: 'Hades',
      rating: 5,
      review: 'Jogo viciante! Mecânicas perfeitas e replayability alta.',
      time: '1 dia atrás'
    }
  ];

  // Mock data for trending games
  const trendingGames = [
    { id: 1, name: 'Elden Ring', genre: 'RPG', rating: 4.8 },
    { id: 2, name: 'Baldur\'s Gate 3', genre: 'RPG', rating: 4.9 },
    { id: 3, name: 'God of War Ragnarök', genre: 'Ação', rating: 4.7 }
  ];

  return (
    <div className="home-page">
      {/* Header Section */}
      <div className="home-header">
        <div className="welcome-section">
          <h1>Bem-vindo ao Social Gamer! 🎮</h1>
          <p>Conecte-se, compartilhe reviews e descubra novos jogos com sua comunidade.</p>
        </div>
        <div className="quick-actions">
          <button className="action-btn primary">Postar Review</button>
          <button className="action-btn secondary">Encontrar Jogadores</button>
          <button className="action-btn secondary">Explorar Jogos</button>
        </div>
      </div>

      {/* Main Content */}
      <div className="home-content">
        {/* Feed Section */}
        <div className="feed-section">
          <h2>Atividades Recentes</h2>
          <div className="reviews-feed">
            {recentReviews.map(review => (
              <div key={review.id} className="review-card">
                <div className="review-header">
                  <span className="user-name">{review.user}</span>
                  <span className="review-time">{review.time}</span>
                </div>
                <div className="review-content">
                  <h4>{review.game}</h4>
                  <div className="rating">
                    {'⭐'.repeat(review.rating)}
                  </div>
                  <p>{review.review}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="sidebar">
          <div className="sidebar-section">
            <h3>Jogos em Alta</h3>
            <div className="trending-games">
              {trendingGames.map(game => (
                <div key={game.id} className="trending-game">
                  <h4>{game.name}</h4>
                  <p>{game.genre} • ⭐ {game.rating}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="sidebar-section">
            <h3>Seguindo</h3>
            <p>Veja as últimas atividades dos gamers que você segue.</p>
            {/* Placeholder for followed users' activities */}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
