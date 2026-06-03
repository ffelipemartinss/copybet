import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export default function Login() {
  const { login, carregando } = useAuthStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', senha: '' });
  const [erro, setErro] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    try {
      const usuario = await login(form.email, form.senha);
      if (usuario.role === 'ANALISTA') navigate('/analista');
      else navigate('/seguidor');
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao fazer login.');
    }
  }

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center px-4">
      <div className="bg-card border border-border rounded-xl p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-primary mb-2">CopyBet</h1>
        <p className="text-muted text-sm mb-6">Entre na sua conta</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-muted block mb-1">E-mail</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-dark border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-sm text-muted block mb-1">Senha</label>
            <input
              type="password"
              required
              value={form.senha}
              onChange={(e) => setForm({ ...form, senha: e.target.value })}
              className="w-full bg-dark border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>

          {erro && <p className="text-red-400 text-sm">{erro}</p>}

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-primary text-dark font-bold py-2 rounded-lg hover:bg-sky-300 transition-colors disabled:opacity-50"
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-sm text-muted mt-4 text-center">
          Nao tem conta?{' '}
          <Link to="/cadastro" className="text-primary hover:underline">
            Cadastre-se
          </Link>
        </p>
      </div>
    </div>
  );
}
