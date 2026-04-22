import { create } from 'zustand';

export type AppUser = {
  id: number;
  firebase_uid: string;
  email: string;
  name: string;
  phone: string;
  username: string;
  home_city: string;
  bio: string;
  profile_complete: boolean;
};

type AuthState = {
  token: string | null;
  authChecked: boolean;
  user: AppUser | null;
  setToken: (token: string | null) => void;
  setAuthChecked: (checked: boolean) => void;
  setUser: (user: AppUser | null) => void;
  setSession: (token: string | null) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  authChecked: false,
  user: null,

  setToken: (token) => set({ token }),

  setAuthChecked: (authChecked) => set({ authChecked }),

  setUser: (user) => set({ user }),

  setSession: (token) =>
    set({
      token,
      authChecked: true,
    }),

  clearSession: () =>
    set({
      token: null,
      user: null,
      authChecked: true,
    }),
}));
