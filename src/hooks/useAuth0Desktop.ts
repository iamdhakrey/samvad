import { useEffect, useCallback } from 'react';
import { onOpenUrl, getCurrent } from '@tauri-apps/plugin-deep-link';
import { openUrl } from '@tauri-apps/plugin-opener';
import { clearTokens, getStoredTokens, saveTokens } from '../store/tokenStore';
import { fetchUserInfo, parseJwt } from '../services/userService';
import { AuthTokens, useAuthStore } from '../store/authStore';

// --- Configuration ---
const AUTH0_DOMAIN = 'Demo.us.auth0.com';
const CLIENT_ID = 'dasdasdasdsdm5Wf87ZSQP';
const REDIRECT_URI = 'https://auth.iamdhakrey.dev';
const APP_SCHEME = 'samvad';

// --- PKCE Utilities ---
function generateRandomString(length: number): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(values).map((x) => charset[x % charset.length]).join('');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);

    return btoa(String.fromCharCode(...new Uint8Array(hash)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function clearOAuthSession(): void {
    sessionStorage.removeItem('oauth_state');
    sessionStorage.removeItem('pkce_verifier');
}

export function useAuth0Desktop() {
    const { setUser, setTokens, setIsLoading, setError, logout: clearAuth, user, tokens } = useAuthStore();

    // Initialize auth on mount
    useEffect(() => {
        const initializeAuth = async () => {
            setIsLoading(true);
            try {
                // Check if we have stored tokens
                const storedTokens = await getStoredTokens();

                if (storedTokens) {
                    // Check if tokens are still valid
                    if (Date.now() < storedTokens.expiresAt) {
                        setTokens(storedTokens);

                        // Fetch user info with stored token
                        try {
                            const userInfo = await fetchUserInfo(storedTokens.accessToken);
                            setUser(userInfo);
                        } catch (err) {
                            console.error('Failed to fetch user info:', err);
                            // Token might be invalid, clear it
                            clearAuth();
                            await clearTokens();
                        }
                    } else {
                        // Tokens expired, clear them
                        clearAuth();
                        await clearTokens();
                    }
                }
            } catch (err) {
                console.error('Failed to initialize auth:', err);
            } finally {
                setIsLoading(false);
            }
        };

        initializeAuth();
    }, []);

    // Handle deep links
    useEffect(() => {
        const handleDeepLink = async (urlString: string) => {
            try {
                const url = new URL(urlString);

                if (url.protocol === `${APP_SCHEME}:` && url.pathname === '//callback') {
                    const urlState = url.searchParams.get('state');
                    const code = url.searchParams.get('code');
                    const error = url.searchParams.get('error');

                    if (error) {
                        const errorDesc = url.searchParams.get('error_description');
                        console.error('Auth failed:', error, errorDesc);
                        setError(`Authentication failed: ${errorDesc || error}`);
                        clearOAuthSession();
                        return;
                    }

                    const storedState = sessionStorage.getItem('oauth_state');

                    if (!urlState || !storedState || urlState !== storedState) {
                        console.error('CSRF Validation Failed: State mismatch or missing.');
                        setError('Security validation failed. Please try again.');
                        clearOAuthSession();
                        return;
                    }

                    if (code) {
                        setIsLoading(true);
                        try {
                            await exchangeCodeForToken(code);
                        } catch (err) {
                            console.error('Token exchange failed:', err);
                            setError('Failed to complete authentication. Please try again.');
                        } finally {
                            clearOAuthSession();
                            setIsLoading(false);
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to parse deep link URL:', err);
            }
        };

        // Handle cold start
        getCurrent().then((urls) => {
            if (urls && urls.length > 0) {
                handleDeepLink(urls[0]);
            }
        });

        // Handle warm start
        const unlisten = onOpenUrl(async (urls) => {
            if (urls && urls.length > 0) {
                handleDeepLink(urls[0]);
            }
        });

        return () => {
            unlisten.then((fn) => fn());
        };
    }, []);

    const exchangeCodeForToken = useCallback(
        async (code: string): Promise<void> => {
            const verifier = sessionStorage.getItem('pkce_verifier');
            if (!verifier) {
                throw new Error('No PKCE verifier found in session');
            }

            try {
                const response = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        grant_type: 'authorization_code',
                        client_id: CLIENT_ID,
                        code_verifier: verifier,
                        code,
                        redirect_uri: `${REDIRECT_URI}?appname=${APP_SCHEME}`,
                    }),
                });

                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(`Auth0 token exchange failed: ${errData.error_description || errData.error}`);
                }

                const tokenResponse = await response.json();

                // Parse token to get expiration
                const decodedToken = parseJwt(tokenResponse.id_token || tokenResponse.access_token);
                const expiresAt = decodedToken.exp ? decodedToken.exp * 1000 : Date.now() + tokenResponse.expires_in * 1000;

                const tokens: AuthTokens = {
                    accessToken: tokenResponse.access_token,
                    refreshToken: tokenResponse.refresh_token || undefined,
                    idToken: tokenResponse.id_token || undefined,
                    expiresIn: tokenResponse.expires_in,
                    expiresAt,
                };

                // Save tokens securely
                await saveTokens(tokens);
                setTokens(tokens);

                // Fetch user information
                try {
                    const userInfo = await fetchUserInfo(tokenResponse.access_token);
                    setUser(userInfo);
                    setError(null);
                } catch (err) {
                    console.error('Failed to fetch user info:', err);
                    throw err;
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                setError(errorMessage);
                throw err;
            }
        },
        [setTokens, setUser, setError]
    );

    const login = useCallback(async (): Promise<void> => {
        setIsLoading(true);
        setError(null);

        try {
            const verifier = generateRandomString(64);
            const state = generateRandomString(32);
            const challenge = await generateCodeChallenge(verifier);

            sessionStorage.setItem('pkce_verifier', verifier);
            sessionStorage.setItem('oauth_state', state);

            const authUrl = new URL(`https://${AUTH0_DOMAIN}/authorize`);
            authUrl.searchParams.append('client_id', CLIENT_ID);
            authUrl.searchParams.append('response_type', 'code');
            authUrl.searchParams.append('code_challenge', challenge);
            authUrl.searchParams.append('code_challenge_method', 'S256');
            authUrl.searchParams.append('redirect_uri', `${REDIRECT_URI}?appname=${APP_SCHEME}`);
            authUrl.searchParams.append('scope', 'openid profile email offline_access');
            authUrl.searchParams.append('state', state);

            await openUrl(authUrl.toString());
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to initiate login';
            console.error('Login failed:', err);
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const logout = useCallback(async (): Promise<void> => {
        setIsLoading(true);

        try {
            // Revoke the access token
            if (tokens?.accessToken) {
                await revokeToken(tokens.accessToken);
            }

            // Clear local auth state
            clearAuth();
            await clearTokens();
            setError(null);

            // Optionally redirect to Auth0 logout endpoint
            const logoutUrl = new URL(`https://${AUTH0_DOMAIN}/v2/logout`);
            logoutUrl.searchParams.append('client_id', CLIENT_ID);
            logoutUrl.searchParams.append('returnTo', REDIRECT_URI);

            await openUrl(logoutUrl.toString());
        } catch (err) {
            console.error('Logout failed:', err);
            // Still clear local state even if remote logout fails
            clearAuth();
            await clearTokens();
        } finally {
            setIsLoading(false);
        }
    }, [tokens?.accessToken]);

    return {
        login,
        logout,
        user,
        tokens,
        isAuthenticated: !!user && !!tokens,
    };
}

function revokeToken(accessToken: string) {
    throw new Error('Function not implemented.');
}
