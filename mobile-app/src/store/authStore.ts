import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type AppUser = {
  id: number;
  firebase_uid: string;
  email: string;
  name: string;
  phone: string;
  username: string;
  home_city: string;
  bio: string;
  profile_image_url: string;
  profile_complete: boolean;
};

type AuthState = {
  token: string | null;
  authChecked: boolean;
  hasHydrated: boolean;
  user: AppUser | null;
  setToken: (token: string | null) => void;
  setAuthChecked: (checked: boolean) => void;
  setHasHydrated: (hydrated: boolean) => void;
  setUser: (user: AppUser | null) => void;
  setSession: (token: string | null) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      authChecked: false,
      hasHydrated: false,
      user: null,

      setToken: (token) => set({ token }),

      setAuthChecked: (authChecked) => set({ authChecked }),

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

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
    }),
    {
      name: 'gotogether-auth-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) {
          return;
        }

        state.setHasHydrated(true);

        if (state.token && state.user) {
          state.setAuthChecked(true);
        }
      },
    }
  )
);
