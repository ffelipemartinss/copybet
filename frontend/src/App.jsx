import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import useAuthStore from './store/authStore';

import Login from './pages/Login';
import Cadastro from './pages/Cadastro';
import Catalogo from './pages/Catalogo';
import PainelSeguidor from './pages/PainelSeguidor';
import PainelAnalista from './pages/PainelAnalista';

function RotaProtegida({ children, role }) {
  const { usuario, token } = useAuthStore();
  if (!token) return <Navigate to="/login" />;
  if (role && usuario?.role !== role) return <Navigate to="/" />;
  return children;
}

export default function App() {
  const { carregarUsuario, token } = useAuthStore();

  useEffect(() => {
    if (token) carregarUsuario();
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
