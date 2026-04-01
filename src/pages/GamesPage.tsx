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
  const [search, setSearch] = useState('');
  const [genreFilter, setGenreFilter] = useState('');

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

  const filteredGames = games.filter((game) => {
    const titleMatch = game.titulo.toLowerCase().includes(search.toLowerCase());
    const genres = Array.isArray(game.generos) ? game.generos : game.generos ? [game.generos] : [];
    const genreMatch = genreFilter ? genres.some((g) => g.toLowerCase().includes(genreFilter.toLowerCase())) : true;
    return titleMatch && genreMatch;
  });

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

        <div className="games-filter-bar">
          <input
            type="text"
            value={search}
            className="game-search-input"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por título..."
          />
          <input
            type="text"
            value={genreFilter}
            className="game-search-input"
            onChange={(e) => setGenreFilter(e.target.value)}
            placeholder="Filtrar por gênero..."
          />
          <button className="game-button" onClick={() => { setSearch(''); setGenreFilter(''); }}>
            Limpar
          </button>
        </div>

        <div className="games-grid">
          {filteredGames.length === 0 ? (
            <p>Nenhum jogo encontrado. Tente outro filtro.</p>
          ) : (
            filteredGames.map((game) => (
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
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default GamesPage;
