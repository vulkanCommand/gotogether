import { create } from 'zustand';

type AuthState = {
  token: string | null;
  authChecked: boolean;
  setToken: (token: string | null) => void;
  setAuthChecked: (checked: boolean) => void;
  setSession: (token: string | null) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  authChecked: false,

  setToken: (token) => set({ token }),

  setAuthChecked: (authChecked) => set({ authChecked }),

  setSession: (token) =>
    set({
      token,
      authChecked: true,
    }),

  clearSession: () =>
    set({
      token: null,
      authChecked: true,
    }),
}));