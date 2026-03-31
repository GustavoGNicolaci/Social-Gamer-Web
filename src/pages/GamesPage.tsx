import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase-client';

interface Game {
  id: number;
  titulo: string;
  capa_url: string;
  desenvolvedores: string[] | string;
  generos: string[] | string;
  data_lancamento: string;
  descricao: string;
  plataformas: string[] | string;
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
        console.log('Dados dos jogos:', data);
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
        <h1>Jogos</h1>
        <p>Confira os jogos cadastrados no nosso catálogo</p>

        <div className="games-grid">
          {games.map((game) => (
            <div key={game.id} className="game-card minimal">
              {game.capa_url && <img src={game.capa_url} alt={game.titulo} className="game-cover" />}
              <h3>{game.titulo}</h3>
              <p className="game-tags">
                {Array.isArray(game.generos) ? game.generos.join(', ') : game.generos}
              </p>
              <Link to={`/games/${game.id}`} className="game-button">
                Ver mais detalhes
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default GamesPage;
