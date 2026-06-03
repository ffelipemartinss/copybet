import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import api from '../lib/api';
import Layout from '../components/Layout';
import useAuthStore from '../store/authStore';

const CASAS = ['betano', 'bet365', 'kto'];
const TIPOS = [
  { value: 'U1', label: '1u — Entrada normal' },
  { value: 'U05', label: '0.5u — Meia entrada' },
  { value: 'U025', label: '0.25u — Bingo' },
];

export default function PainelAnalista() {
  const { usuario, token } = useAuthStore();
  const [sinais, setSinais] = useState([]);
  const [form, setForm] = useState({ casa: 'betano', evento: '', mercado: '', odd: '', tipo_unidade: 'U1' });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [notificacao, setNotificacao] = useState(null);

  useEffect(() => {
    carregarSinais();
  }, []);

  // WebSocket: escuta execucoes em tempo real
  useEffect(() => {
    if (!token) return;
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3001');
    socket.emit('identificar', usuario?.id);

    socket.on('execucao_atualizada', ({ sinal_id, status }) => {
      setSinais((prev) =>
        prev.map((s) =>
          s.id === sinal_id ? { ...s, execucoes_count: (s.execucoes_count || 0) + 1 } : s
        )
      );
    });

    return () => socket.disconnect();
  }, [token]);

  async function carregarSinais() {
    const { data } = await api.get('/api/sinais/meus');
    setSinais(data.sinais);
  }

  async function enviarSinal(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const { data } = await api.post('/api/sinais', form);
      setNotificacao(`Sinal enviado para ${data.seguidores_notificados} seguidores (${data.seguidores_online} online)`);
      setTimeout(() => setNotificacao(null), 5000);
      setForm({ casa: 'betano', evento: '', mercado: '', odd: '', tipo_unidade: 'U1' });
      carregarSinais();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao enviar sinal.');
    }
    setEnviando(false);
  }

  async function encerrarSinal(id, resultado) {
    try {
      await api.patch(`/api/sinais/${id}/resultado`, { resultado });
      carregarSinais();
    } catch {
      alert('Erro ao encerrar sinal.');
    }
  }

  return (
    <Layout>
      <h2 className="text-2xl font-bold mb-1">Painel do Analista</h2>
      <p className="text-muted text-sm mb-6">Bem-vindo, {usuario?.nome}</p>

      {/* Notificacao */}
      {notificacao && (
        <div className="bg-green-900 border border-green-600 text-green-300 rounded-xl px-4 py-3 text-sm mb-6">
          {notificacao}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Formulario novo sinal */}
        <div>
          <h3 className="font-semibold mb-4">Novo Sinal</h3>
          <form onSubmit={enviarSinal} className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div>
              <label className="text-sm text-muted block mb-1">Casa de apostas</label>
              <select
                value={form.casa}
                onChange={(e) => setForm({ ...form, casa: e.target.value })}
                className="w-full bg-dark border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              >
                {CASAS.map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-muted block mb-1">Evento</label>
              <input
                type="text"
                required
                placeholder="Ex: Flamengo x Palmeiras"
                value={form.evento}
                onChange={(e) => setForm({ ...form, evento: e.target.value })}
                className="w-full bg-dark border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-sm text-muted block mb-1">Mercado</label>
              <input
                type="text"
                required
                placeholder="Ex: Resultado Final - Flamengo"
                value={form.mercado}
                onChange={(e) => setForm({ ...form, mercado: e.target.value })}
                className="w-full bg-dark border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-sm text-muted block mb-1">ODD</label>
              <input
                type="number"
                required
                step="0.01"
                min="1.01"
                placeholder="Ex: 2.10"
                value={form.odd}
                onChange={(e) => setForm({ ...form, odd: e.target.value })}
                className="w-full bg-dark border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-sm text-muted block mb-1">Tipo de entrada</label>
              <select
                value={form.tipo_unidade}
                onChange={(e) => setForm({ ...form, tipo_unidade: e.target.value })}
                className="w-full bg-dark border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              >
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {erro && <p className="text-red-400 text-sm">{erro}</p>}

            <button
              type="submit"
              disabled={enviando}
              className="w-full bg-primary text-dark font-bold py-2 rounded-lg hover:bg-sky-300 transition-colors disabled:opacity-50"
            >
              {enviando ? 'Enviando...' : 'Enviar Sinal'}
            </button>
          </form>
        </div>

        {/* Historico de sinais */}
        <div>
          <h3 className="font-semibold mb-4">Ultimos Sinais</h3>
          {sinais.length === 0 ? (
            <p className="text-muted text-sm">Nenhum sinal enviado ainda.</p>
          ) : (
            <div className="space-y-3">
              {sinais.map((s) => (
                <div key={s.id} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-medium text-sm">{s.evento}</p>
                      <p className="text-muted text-xs">{s.mercado} · ODD {s.odd} · {s.casa}</p>
                    </div>
                    <StatusBadge status={s.status} resultado={s.resultado} />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-muted text-xs">{s._count?.execucoes || 0} execucoes</p>
                    {s.status === 'ATIVO' && (
                      <div className="flex gap-2">
                        {['GANHOU', 'PERDEU', 'VOID'].map((r) => (
                          <button
                            key={r}
                            onClick={() => encerrarSinal(s.id, r)}
                            className={`text-xs px-2 py-1 rounded border transition-colors ${
                              r === 'GANHOU' ? 'border-green-600 text-green-400 hover:bg-green-900' :
                              r === 'PERDEU' ? 'border-red-600 text-red-400 hover:bg-red-900' :
                              'border-border text-muted hover:border-primary'
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function StatusBadge({ status, resultado }) {
  if (status === 'ATIVO') return <span className="text-xs bg-sky-900 text-primary border border-sky-700 px-2 py-0.5 rounded-full">Ativo</span>;
  if (resultado === 'GANHOU') return <span className="text-xs bg-green-900 text-green-400 border border-green-700 px-2 py-0.5 rounded-full">Win</span>;
  if (resultado === 'PERDEU') return <span className="text-xs bg-red-900 text-red-400 border border-red-700 px-2 py-0.5 rounded-full">Loss</span>;
  return <span className="text-xs bg-dark text-muted border border-border px-2 py-0.5 rounded-full">Void</span>;
}
