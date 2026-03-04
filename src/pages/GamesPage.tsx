function GamesPage() {
  const games = [
    { id: 1, name: 'The Witcher 3', genre: 'RPG', players: 2543 },
    { id: 2, name: 'Elden Ring', genre: 'Action RPG', players: 3891 },
    { id: 3, name: 'Minecraft', genre: 'Sandbox', players: 5234 },
    { id: 4, name: 'Cyberpunk 2077', genre: 'RPG', players: 1876 },
    { id: 5, name: 'Fortnite', genre: 'Battle Royale', players: 4567 },
    { id: 6, name: 'Valorant', genre: 'FPS', players: 3421 },
  ]

  return (
    <div className="page-container">
      <div className="page-content">
        <h1>Jogos Populares 🎮</h1>
        <p>Veja os jogos mais jogados em nossa comunidade</p>
        
        <div className="games-grid">
          {games.map((game) => (
            <div key={game.id} className="game-card">
              <div className="game-header">
                <h3>{game.name}</h3>
              </div>
              <div className="game-info">
                <p><strong>Gênero:</strong> {game.genre}</p>
                <p><strong>Jogadores:</strong> {game.players}</p>
              </div>
              <button className="game-button">Ver Comunidade</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default GamesPage
