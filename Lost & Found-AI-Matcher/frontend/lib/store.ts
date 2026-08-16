import { create } from 'zustand';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null,
  isLoading: true,

  setUser: (user) => set({ user, isLoading: false }),
  setToken: (token) => {
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
    set({ token });
  },

  login: (user, token) => {
    localStorage.setItem('auth_token', token);
    set({ user, token, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    set({ user: null, token: null, isLoading: false });
  },
}));
