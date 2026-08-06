import { Store } from '@tauri-apps/plugin-store';
import { AuthTokens } from './authStore';

const STORE_KEY = 'auth_tokens';

let store: Store | null = null;

async function getStore(): Promise<Store> {
    if (!store) {
        store = await Store.load('auth.json');
    }
    return store;
}

export async function saveTokens(tokens: AuthTokens): Promise<void> {
    try {
        const storeInstance = await getStore();
        await storeInstance.set(STORE_KEY, tokens);
        await storeInstance.save();
    } catch (err) {
        console.error('Failed to save tokens:', err);
        throw new Error('Failed to save authentication tokens');
    }
}

export async function getStoredTokens(): Promise<AuthTokens | null> {
    try {
        const storeInstance = await getStore();
        const tokens = await storeInstance.get<AuthTokens>(STORE_KEY);
        return tokens || null;
    } catch (err) {
        console.error('Failed to retrieve tokens:', err);
        return null;
    }
}

export async function clearTokens(): Promise<void> {
    try {
        const storeInstance = await getStore();
        await storeInstance.delete(STORE_KEY);
        await storeInstance.save();
    } catch (err) {
        console.error('Failed to clear tokens:', err);
    }
}

export async function isTokenStoredAndValid(): Promise<boolean> {
    const tokens = await getStoredTokens();
    if (!tokens) return false;

    // Check if token is expired
    return Date.now() < tokens.expiresAt;
}