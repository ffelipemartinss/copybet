import { useEffect, useState } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';
import useAuthStore from '../store/authStore';

const PERIODOS = [
  { label: 'Hoje', value: 'hoje' },
  { label: '7 dias', value: '7d' },
  { label: '30 dias', value: '30d' },
];

export default function PainelSeguidor() {
  const { usuario } = useAuthStore();
  const [periodo, setPeriodo] = useState('hoje');
  const [historico, setHistorico] = useState(null);
  const [config, setConfig] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [aba, setAba] = useState('historico'); // historico | config

  useEffect(() => {
    api.get(`/api/seguidores/historico?periodo=${periodo}`).then(({ data }) => {
      setHistorico(data);
    });
  }, [periodo]);

  useEffect(() => {
    if (usuario?.seguidor) {
      setConfig({
        unidade_valor: usuario.seguidor.unidade_valor,
        aceita_1u: usuario.seguidor.aceita_1u,
        aceita_0_5u: usuario.seguidor.aceita_0_5u,
        aceita_0_25u: usuario.seguidor.aceita_0_25u,
      });
    }
  }, [usuario]);

  async function salvarConfig() {
    setSalvando(true);
    try {
      await api.patch('/api/seguidores/configurar', config);
      alert('Configuracoes salvas!');
    } catch {
      alert('Erro ao salvar.');
    }
    setSalvando(false);
  }

  return (
    <Layout>
      <h2 className="text-2xl font-bold mb-1">Meu Painel</h2>
      <p className="text-muted text-sm mb-6">Bem-vindo, {usuario?.nome}</p>

      {/* Abas */}
      <div className="flex gap-2 mb-6">
        {['historico', 'config'].map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              aba === a ? 'bg-primary text-dark' : 'bg-card border border-border text-muted hover:border-primary'
            }`}
          >
            {a === 'historico' ? 'Historico' : 'Configuracoes'}
          </button>
        ))}
      </div>

      {/* Historico */}
      {aba === 'historico' && (
        <>
          {/* Filtro de periodo */}
          <div className="flex gap-2 mb-4">
            {PERIODOS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriodo(p.value)}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  periodo === p.value ? 'bg-primary text-dark font-bold' : 'bg-card border border-border text-muted'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {historico ? (
            <>
              {/* Resumo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'Apostas', valor: historico.resumo.total_apostas },
                  { label: 'Total apostado', valor: `R$ ${historico.resumo.total_apostado.toFixed(2)}` },
                  { label: 'Win / Loss', valor: `${historico.resumo.wins}W / ${historico.resumo.losses}L` },
                  {
                    label: 'Saldo',
                    valor: `R$ ${historico.resumo.saldo.toFixed(2)}`,
                    cor: historico.resumo.saldo >= 0 ? 'text-green-400' : 'text-red-400',
                  },
                ].map((item) => (
                  <div key={item.label} className="bg-card border border-border rounded-xl p-4">
                    <p className="text-muted text-xs mb-1">{item.label}</p>
                    <p className={`font-bold text-lg ${item.cor || ''}`}>{item.valor}</p>
                  </div>
                ))}
              </div>

              {/* Lista */}
              {historico.execucoes.length === 0 ? (
                <p className="text-muted text-center py-12">Nenhuma aposta nesse periodo.</p>
              ) : (
                <div className="space-y-2">
                  {historico.execucoes.map((e) => (
                    <div
                      key={e.id}
                      className="bg-card border border-border rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">{e.evento}</p>
                        <p className="text-muted text-xs">{e.mercado} · {e.casa} · {e.analista}</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted">ODD {e.odd}</span>
                        <span className="text-muted">R$ {e.valor_apostado.toFixed(2)}</span>
                        <TipoUnidadeBadge tipo={e.tipo_unidade} />
                        <ResultadoBadge resultado={e.resultado} lucro={e.lucro_prejuizo} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-muted text-center py-12">Carregando...</p>
          )}
        </>
      )}

      {/* Configuracoes */}
      {aba === 'config' && config && (
        <div className="bg-card border border-border rounded-xl p-6 max-w-sm space-y-5">
          <div>
            <label className="text-sm text-muted block mb-1">Valor da unidade (R$)</label>
            <input
              type="number"
              min={1}
              step={0.01}
              value={config.unidade_valor}
              onChange={(e) => setConfig({ ...config, unidade_valor: parseFloat(e.target.value) })}
              className="w-full bg-dark border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
            <p className="text-muted text-xs mt-1">Apostas 1u usarao esse valor. 0.5u = metade, 0.25u = um quarto.</p>
          </div>

          <div>
            <p className="text-sm text-muted mb-3">Tipos de entrada aceitos</p>
            <div className="space-y-2">
              {[
                { campo: 'aceita_1u', label: '1u — Entrada normal' },
                { campo: 'aceita_0_5u', label: '0.5u — Meia entrada' },
                { campo: 'aceita_0_25u', label: '0.25u — Bingo (ODD alta)' },
              ].map(({ campo, label }) => (
                <label key={campo} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config[campo]}
                    onChange={(e) => setConfig({ ...config, [campo]: e.target.checked })}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={salvarConfig}
            disabled={salvando}
            className="w-full bg-primary text-dark font-bold py-2 rounded-lg hover:bg-sky-300 transition-colors disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : 'Salvar configuracoes'}
          </button>
        </div>
      )}
    </Layout>
  );
}

function TipoUnidadeBadge({ tipo }) {
  const mapa = { U1: '1u', U05: '0.5u', U025: '0.25u' };
  return (
    <span className="bg-dark border border-border text-muted text-xs px-2 py-0.5 rounded-full">
      {mapa[tipo] || tipo}
    </span>
  );
}

function ResultadoBadge({ resultado, lucro }) {
  if (!resultado) return <span className="text-muted text-xs">Pendente</span>;
  if (resultado === 'VOID') return <span className="text-muted text-xs">Void</span>;
  const ganhou = resultado === 'GANHOU';
  return (
    <span className={`text-xs font-bold ${ganhou ? 'text-green-400' : 'text-red-400'}`}>
      {ganhou ? '+' : ''}{lucro?.toFixed(2)}
    </span>
  );
}
