import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import Layout from '../components/Layout';

export default function Catalogo() {
  const [analistas, setAnalistas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/analistas').then(({ data }) => {
      setAnalistas(data.analistas);
      setCarregando(false);
    });
  }, []);

  if (carregando) {
    return (
      <Layout>
        <p className="text-muted text-center mt-20">Carregando analistas...</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <h2 className="text-2xl font-bold mb-2">Catalogo de Analistas</h2>
      <p className="text-muted text-sm mb-8">Escolha um analista e copie as apostas automaticamente.</p>

      {analistas.length === 0 ? (
        <p className="text-muted text-center mt-20">Nenhum analista cadastrado ainda.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {analistas.map((a) => (
            <div
              key={a.id}
              onClick={() => navigate(`/analistas/${a.id}`)}
              className="bg-card border border-border rounded-xl p-5 cursor-pointer hover:border-primary transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-border flex items-center justify-center text-lg font-bold text-primary">
                  {a.nome[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold">{a.nome}</p>
                  <p className="text-muted text-xs">{a.especialidade || 'Geral'}</p>
                </div>
                <span className="ml-auto text-xs bg-dark border border-border px-2 py-1 rounded-full text-muted">
                  {a.seguidores_ativos} seguidores
                </span>
              </div>

              {/* Stats por tipo */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {[
                  { label: '1u', stats: a.stats['1u'] },
                  { label: '0.5u', stats: a.stats['0.5u'] },
                  { label: '0.25u', stats: a.stats['0.25u'] },
                ].map(({ label, stats }) => (
                  <div key={label} className="bg-dark rounded-lg p-2">
                    <p className="text-muted mb-1">{label}</p>
                    <p className={`font-bold text-sm ${stats.win_rate >= 55 ? 'text-green-400' : 'text-red-400'}`}>
                      {stats.win_rate.toFixed(0)}% Win
                    </p>
                    <p className="text-muted">{stats.total_sinais} sinais</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
