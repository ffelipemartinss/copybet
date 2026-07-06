import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import api from '../lib/api';
import Layout from '../components/Layout';
import useAuthStore from '../store/authStore';

const PERIODOS = [
  { label: 'Hoje', value: 'hoje' },
  { label: '7 dias', value: '7d' },
  { label: '30 dias', value: '30d' },
];

export default function PainelSeguidor() {
  const { usuario, token } = useAuthStore();
  const [periodo, setPeriodo] = useState('hoje');
  const [assinando, setAssinando] = useState(false);
  const [historico, setHistorico] = useState(null);
  const [config, setConfig] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [aba, setAba] = useState('sinais'); // sinais | historico | config
  const [sinaisAtivos, setSinaisAtivos] = useState([]);
  const [confirmando, setConfirmando] = useState(null); // id da execucao em confirmacao
  const [toast, setToast] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    carregarSinaisAtivos();
  }, []);

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

  // Socket.IO: recebe novos sinais em tempo real
  useEffect(() => {
    if (!token) return;
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3001');
    socketRef.current = socket;

    socket.emit('identificar', usuario?.id);

    socket.on('sinal', (sinal) => {
      carregarSinaisAtivos();
      setToast(`Novo sinal: ${sinal.evento} — ODD ${sinal.odd}`);
      setAba('sinais');
      setTimeout(() => setToast(null), 6000);
    });

    return () => socket.disconnect();
  }, [token]);

  async function carregarSinaisAtivos() {
    try {
      const { data } = await api.get('/api/seguidores/sinais-ativos');
      setSinaisAtivos(data.sinais);
    } catch {
      // silencioso
    }
  }

  async function confirmarAposta(execucaoId) {
    setConfirmando(execucaoId);
    try {
      await api.patch(`/api/seguidores/sinais/${execucaoId}/confirmar`);
      setSinaisAtivos((prev) => prev.filter((s) => s.execucao_id !== execucaoId));
      setToast('Aposta confirmada!');
      setTimeout(() => setToast(null), 4000);
    } catch {
      setToast('Erro ao confirmar aposta.');
      setTimeout(() => setToast(null), 4000);
    }
    setConfirmando(null);
  }

  async function assinar() {
    setAssinando(true);
    try {
      const { data } = await api.post('/api/pagamentos/criar-sessao');
      window.location.href = data.url;
    } catch {
      setToast('Erro ao iniciar pagamento. Tente novamente.');
      setTimeout(() => setToast(null), 4000);
      setAssinando(false);
    }
  }

  async function abrirPortal() {
    try {
      const { data } = await api.get('/api/pagamentos/portal');
      window.location.href = data.url;
    } catch {
      setToast('Erro ao abrir portal de pagamento.');
      setTimeout(() => setToast(null), 4000);
    }
  }

  async function salvarConfig() {
    setSalvando(true);
    try {
      await api.patch('/api/seguidores/configurar', config);
      setToast('Configuracoes salvas!');
      setTimeout(() => setToast(null), 4000);
    } catch {
      setToast('Erro ao salvar configuracoes.');
      setTimeout(() => setToast(null), 4000);
    }
    setSalvando(false);
  }

  const ABAS = [
    { id: 'sinais', label: `Sinais${sinaisAtivos.length > 0 ? ` (${sinaisAtivos.length})` : ''}` },
    { id: 'historico', label: 'Historico' },
    { id: 'config', label: 'Configuracoes' },
  ];

  return (
    <Layout>
      <h2 className="text-2xl font-bold mb-1">Meu Painel</h2>
      <p className="text-muted text-sm mb-6">Bem-vindo, {usuario?.nome}</p>

      {/* Banner de plano inativo */}
      {usuario?.plano?.status !== 'ATIVO' && (
        <div className="bg-yellow-900 border border-yellow-600 rounded-xl px-4 py-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-yellow-300 font-semibold text-sm">Plano inativo</p>
            <p className="text-yellow-400 text-xs mt-0.5">Assine para receber sinais em tempo real e acessar todos os recursos.</p>
          </div>
          <button
            onClick={assinar}
            disabled={assinando}
            className="shrink-0 bg-primary text-dark font-bold px-5 py-2 rounded-lg text-sm hover:bg-sky-300 transition-colors disabled:opacity-50"
          >
            {assinando ? 'Redirecionando...' : 'Assinar — R$ 99,90/mes'}
          </button>
        </div>
      )}

      {/* Link para gerenciar assinatura ativa */}
      {usuario?.plano?.status === 'ATIVO' && usuario?.plano?.stripe_subscription_id && (
        <div className="flex justify-end mb-4">
          <button
            onClick={abrirPortal}
            className="text-xs text-muted hover:text-primary transition-colors underline"
          >
            Gerenciar assinatura
          </button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="bg-sky-900 border border-sky-600 text-sky-300 rounded-xl px-4 py-3 text-sm mb-6">
          {toast}
        </div>
      )}

      {/* Abas */}
      <div className="flex gap-2 mb-6">
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              aba === a.id ? 'bg-primary text-dark' : 'bg-card border border-border text-muted hover:border-primary'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Aba: Sinais Ativos */}
      {aba === 'sinais' && (
        <>
          {sinaisAtivos.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted text-lg mb-2">Nenhum sinal ativo no momento</p>
              <p className="text-muted text-sm">Quando o analista enviar um sinal, ele aparecera aqui automaticamente.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sinaisAtivos.map((s) => (
                <SinalCard
                  key={s.execucao_id}
                  sinal={s}
                  confirmando={confirmando === s.execucao_id}
                  onConfirmar={() => confirmarAposta(s.execucao_id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Aba: Historico */}
      {aba === 'historico' && (
        <>
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

      {/* Aba: Configuracoes */}
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

function SinalCard({ sinal, confirmando, onConfirmar }) {
  const retorno = ((sinal.odd - 1) * sinal.valor_apostado).toFixed(2);

  return (
    <div className="bg-card border border-primary/40 rounded-xl p-5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="font-semibold">{sinal.evento}</p>
          <p className="text-muted text-sm mt-0.5">{sinal.mercado}</p>
        </div>
        <span className="text-xs bg-sky-900 text-primary border border-sky-700 px-2 py-0.5 rounded-full shrink-0">
          Ativo
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-dark rounded-lg p-3 text-center">
          <p className="text-muted text-xs mb-1">ODD</p>
          <p className="font-bold text-primary">{sinal.odd}</p>
        </div>
        <div className="bg-dark rounded-lg p-3 text-center">
          <p className="text-muted text-xs mb-1">Apostar</p>
          <p className="font-bold">R$ {sinal.valor_apostado.toFixed(2)}</p>
        </div>
        <div className="bg-dark rounded-lg p-3 text-center">
          <p className="text-muted text-xs mb-1">Retorno</p>
          <p className="font-bold text-green-400">R$ {retorno}</p>
        </div>
      </div>

      <p className="text-muted text-xs mb-4">
        Casa: <span className="text-white">{sinal.casa}</span>
        {' · '}Analista: <span className="text-white">{sinal.analista}</span>
        {' · '}<TipoUnidadeBadge tipo={sinal.tipo_unidade} />
      </p>

      <div className="flex gap-3">
        <a
          href="https://www.betfair.bet.br/exchange/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 bg-primary text-dark font-bold py-2 rounded-lg text-sm text-center hover:bg-sky-300 transition-colors"
        >
          Apostar no Betfair
        </a>
        <button
          onClick={onConfirmar}
          disabled={confirmando}
          className="flex-1 border border-green-600 text-green-400 font-bold py-2 rounded-lg text-sm hover:bg-green-900 transition-colors disabled:opacity-50"
        >
          {confirmando ? 'Confirmando...' : 'Confirmei'}
        </button>
      </div>
    </div>
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
