import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export default function Layout({ children }) {
  const { usuario, logout } = useAuthStore();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-dark">
      {/* Navbar */}
      <nav className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
        <Link to="/" className="text-primary font-bold text-xl tracking-tight">
          CopyBet
        </Link>
        <div className="flex items-center gap-4">
          {usuario ? (
            <>
              <span className="text-muted text-sm">{usuario.nome}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-muted hover:text-red-400 transition-colors"
              >
                Sair
              </button>
            </>
          ) : (
            <Link to="/login" className="text-sm text-primary hover:underline">
              Entrar
            </Link>
          )}
        </div>
      </nav>

      {/* Conteudo */}
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
