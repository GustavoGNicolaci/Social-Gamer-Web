import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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

function GameDetailsPage() {
  const { id } = useParams();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGame = async () => {
      if (!id) return;
      const { data, error } = await supabase.from('jogos').select('*').eq('id', Number(id)).single();
      if (error) {
        console.error('Erro ao buscar jogo:', error);
      } else {
        setGame(data || null);
      }
      setLoading(false);
    };

    fetchGame();
  }, [id]);

  if (loading) {
    return <div className="page-container"><div className="page-content"><h1>Carregando...</h1></div></div>;
  }

  if (!game) {
    return (
      <div className="page-container">
        <div className="page-content">
          <h1>Jogo não encontrado</h1>
          <Link to="/games" className="game-button">Voltar aos jogos</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-content game-details">
        <section className="game-banner">
          {game.capa_url && <img src={game.capa_url} alt={game.titulo} className="game-banner-image" />}
          <div className="game-banner-overlay">
            <h1>{game.titulo}</h1>
            <p className="game-genres">{Array.isArray(game.generos) ? game.generos.join(' • ') : game.generos}</p>
          </div>
        </section>

        <section className="game-meta">
          <div className="game-meta-item">
            <span>Desenvolvedora</span>
            <strong>{Array.isArray(game.desenvolvedora) ? game.desenvolvedora.join(', ') : game.desenvolvedora}</strong>
          </div>
          <div className="game-meta-item">
            <span>Plataformas</span>
            <strong>{Array.isArray(game.plataformas) ? game.plataformas.join(', ') : game.plataformas}</strong>
          </div>
          <div className="game-meta-item">
            <span>Data de lançamento</span>
            <strong>{new Date(game.data_lancamento).toLocaleDateString('pt-BR')}</strong>
          </div>
        </section>

        <section className="game-description">
          <h2>Descrição</h2>
          <p>{game.descricao}</p>
        </section>

        <div className="game-actions">
          <Link to="/games" className="game-button secondary">Voltar</Link>
        </div>
      </div>
    </div>
  );
}

export default GameDetailsPage;
