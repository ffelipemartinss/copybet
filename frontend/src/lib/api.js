import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
});

// Injeta o token JWT em todas as requisicoes
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Se 401 em rota protegida, limpa a sessao e volta para o login.
// 401 vindo do proprio login/cadastro significa "credenciais invalidas"
// e deve ser tratado pela tela — senao o recarregamento apaga o erro.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    const ehRotaDeAuth = url.includes('/api/auth/login') || url.includes('/api/auth/cadastro');

    if (err.response?.status === 401 && !ehRotaDeAuth) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
