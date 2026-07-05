import { create } from 'zustand';
import api from '../lib/api';

const useAuthStore = create((set) => ({
  usuario: null,
  token: localStorage.getItem('token') || null,
  carregando: false,
  // Fica true quando a sessao inicial foi resolvida (com ou sem usuario).
  // Evita que um F5 em rota protegida expulse o usuario antes de o /me responder.
  inicializado: false,

  login: async (email, senha) => {
    set({ carregando: true });
    try {
      const { data } = await api.post('/api/auth/login', { email, senha });
      localStorage.setItem('token', data.token);
      set({ token: data.token, usuario: data.usuario, carregando: false, inicializado: true });
      return data.usuario;
    } catch (err) {
      set({ carregando: false });
      throw err;
    }
  },

  cadastro: async (dados) => {
    set({ carregando: true });
    try {
      const { data } = await api.post('/api/auth/cadastro', dados);
      localStorage.setItem('token', data.token);
      set({ token: data.token, usuario: data.usuario, carregando: false, inicializado: true });
      return data.usuario;
    } catch (err) {
      set({ carregando: false });
      throw err;
    }
  },

  carregarUsuario: async () => {
    try {
      const { data } = await api.get('/api/auth/me');
      set({ usuario: data.usuario, inicializado: true });
    } catch {
      localStorage.removeItem('token');
      set({ usuario: null, token: null, inicializado: true });
    }
  },

  marcarInicializado: () => set({ inicializado: true }),

  logout: () => {
    localStorage.removeItem('token');
    set({ usuario: null, token: null });
  },
}));

export default useAuthStore;
