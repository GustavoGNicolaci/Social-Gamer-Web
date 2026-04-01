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
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [genreDropdownOpen, setGenreDropdownOpen] = useState(false);
  const [customGenre, setCustomGenre] = useState('');

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

  const allGenres = Array.from(new Set(games.flatMap((game) => (Array.isArray(game.generos) ? game.generos : game.generos ? [game.generos] : [])))).sort();

  const filteredGames = games.filter((game) => {
    const titleMatch = game.titulo.toLowerCase().includes(search.toLowerCase());
    const genres = Array.isArray(game.generos) ? game.generos : game.generos ? [game.generos] : [];
    const genreMatch = selectedGenres.length === 0 || selectedGenres.every((s) => genres.some((g) => g.toLowerCase().includes(s.toLowerCase())));
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

          <div className="genre-filter-dropdown">
            <button className="genre-filter-button" onClick={() => setGenreDropdownOpen((prev) => !prev)}>
              Filtro de gêneros
            </button>
            {genreDropdownOpen && (
              <div className="genre-dropdown-menu">
                <div className="genre-list">
                  {allGenres.map((genre) => (
                    <label key={genre} className="genre-option">
                      <input
                        type="checkbox"
                        checked={selectedGenres.includes(genre)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedGenres((prev) => [...prev, genre]);
                          } else {
                            setSelectedGenres((prev) => prev.filter((g) => g !== genre));
                          }
                        }}
                      />
                      {genre}
                    </label>
                  ))}
                </div>
                <div className="genre-add-row">
                  <input
                    type="text"
                    value={customGenre}
                    onChange={(e) => setCustomGenre(e.target.value)}
                    placeholder="Adicionar gênero..."
                  />
                  <button
                    className="game-button small"
                    onClick={() => {
                      const genreTrimmed = customGenre.trim();
                      if (genreTrimmed && !selectedGenres.includes(genreTrimmed)) {
                        setSelectedGenres((prev) => [...prev, genreTrimmed]);
                      }
                      setCustomGenre('');
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>

          <button className="game-button small" onClick={() => { setSearch(''); setSelectedGenres([]); setGenreDropdownOpen(false); }}>
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
