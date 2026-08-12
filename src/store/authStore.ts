import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
    sub: string;
    name?: string;
    email?: string;
    picture?: string;
    updated_at?: string;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken?: string;
    idToken?: string;
    expiresIn: number;
    expiresAt: number;
}

interface AuthState {
    // State
    user: User | null;
    tokens: AuthTokens | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    // Actions
    setUser: (user: User | null) => void;
    setTokens: (tokens: AuthTokens | null) => void;
    setIsLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    logout: () => void;
    isTokenExpired: () => boolean;
    getAccessToken: () => string | null;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            tokens: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,

            setUser: (user) => {
                set({ user, isAuthenticated: !!user });
            },

            setTokens: (tokens) => {
                set({ tokens, isAuthenticated: !!tokens });
            },

            setIsLoading: (isLoading) => set({ isLoading }),

            setError: (error) => set({ error }),

            logout: () => {
                set({
                    user: null,
                    tokens: null,
                    isAuthenticated: false,
                    error: null,
                });
            },

            isTokenExpired: () => {
                const { tokens } = get();
                if (!tokens) return true;
                return Date.now() >= tokens.expiresAt;
            },

            getAccessToken: () => {
                const { tokens } = get();
                if (!tokens) return null;
                // Check if token is expired
                if (Date.now() >= tokens.expiresAt) {
                    return null; // Token expired, needs refresh
                }
                return tokens.accessToken;
            },
        }),
        {
            name: 'auth-storage', // Name of the storage item
            partialize: (state) => ({
                user: state.user,
                tokens: state.tokens,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);