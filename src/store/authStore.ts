import { AuthTokens, User } from "@samvad-internal/models";
import { create } from "zustand";

interface AuthState {
  // State
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setTokens: (tokens: AuthTokens | null) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
}

// No persistence here — Rust's auth.yaml is the source of truth.
// On startup, useAuth0Desktop calls invoke("get_auth_state") to hydrate this store.
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  tokens: null,
  isLoading: false,
  error: null,

  setUser: (user) => set({ user }),

  setTokens: (tokens) => set({ tokens }),

  setIsLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  logout: () =>
    set({
      user: null,
      tokens: null,
      error: null,
    }),
}));
