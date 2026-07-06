import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export default function PagamentoSucesso() {
  const navigate = useNavigate();
  const { carregarUsuario } = useAuthStore();

  useEffect(() => {
    // Recarrega o usuario para pegar o plano ATIVO atualizado pelo webhook
    carregarUsuario();
    const timer = setTimeout(() => navigate('/seguidor'), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center px-4">
      <div className="bg-card border border-green-700 rounded-xl p-8 w-full max-w-sm text-center">
        <div className="text-5xl mb-4">✓</div>
        <h1 className="text-2xl font-bold text-green-400 mb-2">Pagamento confirmado!</h1>
        <p className="text-muted text-sm mb-6">
          Seu plano esta ativo. Voce ja pode receber sinais em tempo real.
        </p>
        <p className="text-muted text-xs">Redirecionando para o painel em alguns segundos...</p>
        <button
          onClick={() => navigate('/seguidor')}
          className="mt-6 w-full bg-primary text-dark font-bold py-2 rounded-lg hover:bg-sky-300 transition-colors"
        >
          Ir para o painel agora
        </button>
      </div>
    </div>
  );
}
