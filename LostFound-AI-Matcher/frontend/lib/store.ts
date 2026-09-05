import { create } from 'zustand';
import type { User } from '@/types';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

function decodeJwt(token: string): { sub?: string; email?: string; role?: string } | null {
  try {
    const payload = token.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}
function getInitialState() {
  if (typeof window === 'undefined') {
    return { user: null, token: null, isLoading: true };
  }

  const token = localStorage.getItem(TOKEN_KEY);
  const user = getStoredItem<User>(USER_KEY);

  // If token exists, decode it and make sure stored user matches
  if (token) {
    const decoded = decodeJwt(token);
    if (!decoded?.sub || user?.id !== decoded.sub) {
      localStorage.removeItem(TOKEN_KEY);
      removeStoredItem(USER_KEY);
      return { user: null, token: null, isLoading: false };
    }
    return { user, token, isLoading: false };
  }

  // No token -> clean state
  if (user) removeStoredItem(USER_KEY);
  return { user: null, token: null, isLoading: false };
}

function getStoredItem<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function setStoredItem(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

function removeStoredItem(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore storage errors
  }
}

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
  ...getInitialState(),

  setUser: (user) => {
    if (user) setStoredItem(USER_KEY, user);
    else removeStoredItem(USER_KEY);
    set({ user, isLoading: false });
  },

  setToken: (token) => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      removeStoredItem(TOKEN_KEY);
    }
    set({ token });
  },

  login: (user, token) => {
    localStorage.setItem(TOKEN_KEY, token);
    setStoredItem(USER_KEY, user);
    set({ user, token, isLoading: false });
  },

  logout: () => {
    removeStoredItem(TOKEN_KEY);
    removeStoredItem(USER_KEY);
    set({ user: null, token: null, isLoading: false });
  },
}));
