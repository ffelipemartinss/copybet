import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import useAuthStore from './store/authStore';

import Login from './pages/Login';
import Cadastro from './pages/Cadastro';
import Catalogo from './pages/Catalogo';
import PainelSeguidor from './pages/PainelSeguidor';
import PainelAnalista from './pages/PainelAnalista';

function RotaProtegida({ children, role }) {
  const { usuario, token, inicializado } = useAuthStore();

  if (!token) return <Navigate to="/login" />;

  // Ha token mas a sessao ainda esta sendo validada (ex.: F5 na pagina):
  // segura a decisao de rota ate o /me responder, senao o usuario e expulso.
  if (!inicializado) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <p className="text-muted text-sm">Carregando...</p>
      </div>
    );
  }

  if (role && usuario?.role !== role) return <Navigate to="/" />;
  return children;
}

export default function App() {
  const { carregarUsuario, marcarInicializado, token } = useAuthStore();

  useEffect(() => {
    if (token) {
      carregarUsuario();
    } else {
      // Sem token nao ha o que validar — libera a renderizacao das rotas
      marcarInicializado();
    }
  }, [token]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Catalogo />} />
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/seguidor" element={<RotaProtegida role="SEGUIDOR"><PainelSeguidor /></RotaProtegida>} />
        <Route path="/analista" element={<RotaProtegida role="ANALISTA"><PainelAnalista /></RotaProtegida>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
