import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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
      <div className="page-content">
        <h1>{game.titulo}</h1>
        {game.capa_url && <img src={game.capa_url} alt={game.titulo} className="game-cover" />}
        <p><strong>Gêneros:</strong> {Array.isArray(game.generos) ? game.generos.join(', ') : game.generos}</p>
        <p><strong>Desenvolvedores:</strong> {Array.isArray(game.desenvolvedores) ? game.desenvolvedores.join(', ') : game.desenvolvedores}</p>
        <p><strong>Plataformas:</strong> {Array.isArray(game.plataformas) ? game.plataformas.join(', ') : game.plataformas}</p>
        <p><strong>Data de lançamento:</strong> {new Date(game.data_lancamento).toLocaleDateString('pt-BR')}</p>
        <p><strong>Descrição:</strong> {game.descricao}</p>
        <Link to="/games" className="game-button">Voltar</Link>
      </div>
    </div>
  );
}

export default GameDetailsPage;
