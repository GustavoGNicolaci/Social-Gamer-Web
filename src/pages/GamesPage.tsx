import { useState, useEffect } from 'react';
import { supabase } from '../supabase-client';

interface Game {
  id: number;
  titulo: string;
  capa_url: string;
  desenvolvedores: string;
  generos: string;
  data_lancamento: string;
  descricao: string;
  plataformas: string;
}

function GamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGames = async () => {
      const { data, error } = await supabase.from('jogos').select('*');
      if (error) {
        console.error('Erro ao buscar jogos:', error);
      } else {
        setGames(data || []);
      }
      setLoading(false);
    };
    fetchGames();
  }, []);

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-content">
          <h1>Carregando jogos...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-content">
        <h1>Jogos Populares 🎮</h1>
        <p>Veja os jogos mais jogados em nossa comunidade</p>
        
        <div className="games-grid">
          {games.map((game) => (
            <div key={game.id} className="game-card">
              <div className="game-header">
                {game.capa_url && <img src={game.capa_url} alt={game.titulo} className="game-cover" />}
                <h3>{game.titulo}</h3>
              </div>
              <div className="game-info">
                <p><strong>Desenvolvedores:</strong> {game.desenvolvedores}</p>
                <p><strong>Gêneros:</strong> {game.generos}</p>
                <p><strong>Data de Lançamento:</strong> {new Date(game.data_lancamento).toLocaleDateString('pt-BR')}</p>
                <p><strong>Plataformas:</strong> {game.plataformas}</p>
                <p><strong>Descrição:</strong> {game.descricao}</p>
              </div>
              <button className="game-button">Ver Comunidade</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default GamesPage;
