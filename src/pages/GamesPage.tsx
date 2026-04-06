import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase-client';

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

function GamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedDevelopers, setSelectedDevelopers] = useState<string[]>([]);
  const [filtersDropdownOpen, setFiltersDropdownOpen] = useState(false);
  const [customGenre, setCustomGenre] = useState('');
  const [customPlatform, setCustomPlatform] = useState('');
  const [customDeveloper, setCustomDeveloper] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;
  const [showGenresModal, setShowGenresModal] = useState(false);
  const [selectedGameGenres, setSelectedGameGenres] = useState<string[]>([]);

  useEffect(() => {
    const fetchGames = async () => {
      const { data, error } = await supabase.from('jogos').select('*');
      if (error) {
        console.error('Erro ao buscar jogos:', error);
      } else {
        console.log('Fetched games:', data);
        setGames(data || []);
      }
      setLoading(false);
    };
    fetchGames();
  }, []);

  useEffect(() => {
    const closeOnOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.filters-dropdown')) {
        setFiltersDropdownOpen(false);
      }
    };

    if (filtersDropdownOpen) {
      document.addEventListener('mousedown', closeOnOutsideClick);
    }

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
    };
  }, [filtersDropdownOpen]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedGenres, selectedPlatforms, selectedDevelopers]);

  const allGenres = Array.from(new Set(games.flatMap((game) => (Array.isArray(game.generos) ? game.generos : game.generos ? [game.generos] : [])))).sort();
  const allPlatforms = Array.from(new Set(games.flatMap((game) => (Array.isArray(game.plataformas) ? game.plataformas : game.plataformas ? [game.plataformas] : [])))).sort();
  const allDevelopers = Array.from(new Set(games.flatMap((game) => (Array.isArray(game.desenvolvedora) ? game.desenvolvedora : game.desenvolvedora ? [game.desenvolvedora] : [])))).sort();
  console.log('allDevelopers:', allDevelopers);

  const filteredGames = games.filter((game) => {
    const titleMatch = game.titulo.toLowerCase().includes(search.toLowerCase());
    const genres = Array.isArray(game.generos) ? game.generos : game.generos ? [game.generos] : [];
    const genreMatch = selectedGenres.length === 0 || selectedGenres.every((s) => genres.some((g) => g.toLowerCase().includes(s.toLowerCase())));
    const platforms = Array.isArray(game.plataformas) ? game.plataformas : game.plataformas ? [game.plataformas] : [];
    const platformMatch = selectedPlatforms.length === 0 || selectedPlatforms.every((s) => platforms.some((p) => p.toLowerCase().includes(s.toLowerCase())));
    const developers = Array.isArray(game.desenvolvedora) ? game.desenvolvedora : game.desenvolvedora ? [game.desenvolvedora] : [];
    const developerMatch = selectedDevelopers.length === 0 || selectedDevelopers.every((s) => developers.some((d) => d.toLowerCase().includes(s.toLowerCase())));
    return titleMatch && genreMatch && platformMatch && developerMatch;
  });

  const totalPages = Math.ceil(filteredGames.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const gamesToDisplay = filteredGames.slice(startIndex, endIndex);

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

          <div className="filters-dropdown">
            <button className="genre-filter-button" onClick={() => setFiltersDropdownOpen((prev) => !prev)}>
              Filtros
            </button>
            {filtersDropdownOpen && (
              <div className="filters-dropdown-menu">
                <div className="filter-section">
                  <h4>Gêneros</h4>
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

                <div className="filter-section">
                  <h4>Plataformas</h4>
                  <div className="genre-list">
                    {allPlatforms.map((platform) => (
                      <label key={platform} className="genre-option">
                        <input
                          type="checkbox"
                          checked={selectedPlatforms.includes(platform)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPlatforms((prev) => [...prev, platform]);
                            } else {
                              setSelectedPlatforms((prev) => prev.filter((p) => p !== platform));
                            }
                          }}
                        />
                        {platform}
                      </label>
                    ))}
                  </div>
                  <div className="genre-add-row">
                    <input
                      type="text"
                      value={customPlatform}
                      onChange={(e) => setCustomPlatform(e.target.value)}
                      placeholder="Adicionar plataforma..."
                    />
                    <button
                      className="game-button small"
                      onClick={() => {
                        const platformTrimmed = customPlatform.trim();
                        if (platformTrimmed && !selectedPlatforms.includes(platformTrimmed)) {
                          setSelectedPlatforms((prev) => [...prev, platformTrimmed]);
                        }
                        setCustomPlatform('');
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="filter-section">
                  <h4>Desenvolvedoras</h4>
                  <div className="genre-list">
                    {allDevelopers.map((developer) => (
                      <label key={developer} className="genre-option">
                        <input
                          type="checkbox"
                          checked={selectedDevelopers.includes(developer)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDevelopers((prev) => [...prev, developer]);
                            } else {
                              setSelectedDevelopers((prev) => prev.filter((d) => d !== developer));
                            }
                          }}
                        />
                        {developer}
                      </label>
                    ))}
                  </div>
                  <div className="genre-add-row">
                    <input
                      type="text"
                      value={customDeveloper}
                      onChange={(e) => setCustomDeveloper(e.target.value)}
                      placeholder="Adicionar desenvolvedora..."
                    />
                    <button
                      className="game-button small"
                      onClick={() => {
                        const developerTrimmed = customDeveloper.trim();
                        if (developerTrimmed && !selectedDevelopers.includes(developerTrimmed)) {
                          setSelectedDevelopers((prev) => [...prev, developerTrimmed]);
                        }
                        setCustomDeveloper('');
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button className="game-button small" onClick={() => { 
            setSearch(''); 
            setSelectedGenres([]); 
            setSelectedPlatforms([]); 
            setSelectedDevelopers([]); 
            setFiltersDropdownOpen(false); 
          }}>
            Limpar
          </button>
        </div>

        <div className="genre-chip-row">
          {selectedGenres.map((genre) => (
            <span key={genre} className="genre-chip">
              {genre}
              <button type="button" onClick={() => setSelectedGenres((prev) => prev.filter((g) => g !== genre))}>
                ×
              </button>
            </span>
          ))}
          {selectedPlatforms.map((platform) => (
            <span key={platform} className="genre-chip">
              {platform}
              <button type="button" onClick={() => setSelectedPlatforms((prev) => prev.filter((p) => p !== platform))}>
                ×
              </button>
            </span>
          ))}
          {selectedDevelopers.map((developer) => (
            <span key={developer} className="genre-chip">
              {developer}
              <button type="button" onClick={() => setSelectedDevelopers((prev) => prev.filter((d) => d !== developer))}>
                ×
              </button>
            </span>
          ))}
        </div>

        <div className="games-grid">
          {gamesToDisplay.length === 0 ? (
            <p>Nenhum jogo encontrado. Tente outro filtro.</p>
          ) : (
            gamesToDisplay.map((game) => {
              const genres = Array.isArray(game.generos) ? game.generos : [game.generos];
              const displayedGenres = genres.slice(0, 3);
              const hasMoreGenres = genres.length > 3;
              return (
                <div key={game.id} className="game-card minimal">
                  {game.capa_url && (
                    <Link to={`/games/${game.id}`}>
                      <img src={game.capa_url} alt={game.titulo} className="game-cover" />
                    </Link>
                  )}
                  <h3>{game.titulo}</h3>
                  <div className="game-tags">
                    {displayedGenres.map((genre, index) => (
                      <span key={index} className="genre-chip">{genre}</span>
                    ))}
                    {hasMoreGenres && (
                      <button
                        className="more-genres-btn"
                        onClick={() => {
                          setSelectedGameGenres(genres);
                          setShowGenresModal(true);
                        }}
                      >
                        +
                      </button>
                    )}
                  </div>
                  <Link to={`/games/${game.id}`} className="game-button">
                    Ver mais detalhes
                  </Link>
                </div>
              );
            })
          )}
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>Anterior</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={page === currentPage ? 'active' : ''}
              >
                {page}
              </button>
            ))}
            <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>Próxima</button>
          </div>
        )}

        {showGenresModal && (
          <div className="modal-overlay" onClick={() => setShowGenresModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Categorias</h3>
              <div className="genres-list">
                {selectedGameGenres.map((genre, index) => (
                  <span key={index} className="genre-tag">{genre}</span>
                ))}
              </div>
              <button className="close-modal-btn" onClick={() => setShowGenresModal(false)}>Fechar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GamesPage;
