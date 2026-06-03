import { create } from 'zustand';
import api from '../lib/api';

const useAuthStore = create((set) => ({
  usuario: null,
  token: localStorage.getItem('token') || null,
  carregando: false,

  login: async (email, senha) => {
    set({ carregando: true });
    const { data } = await api.post('/api/auth/login', { email, senha });
    localStorage.setItem('token', data.token);
    set({ token: data.token, usuario: data.usuario, carregando: false });
    return data.usuario;
  },

  cadastro: async (dados) => {
    set({ carregando: true });
    const { data } = await api.post('/api/auth/cadastro', dados);
    localStorage.setItem('token', data.token);
    set({ token: data.token, usuario: data.usuario, carregando: false });
    return data.usuario;
  },

  carregarUsuario: async () => {
    try {
      const { data } = await api.get('/api/auth/me');
      set({ usuario: data.usuario });
    } catch {
      set({ usuario: null, token: null });
      localStorage.removeItem('token');
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ usuario: null, token: null });
  },
}));

export default useAuthStore;
