import { useEffect, useCallback, useRef } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { clearTokens, getStoredTokens, saveTokens } from "../store/tokenStore";
import {
  fetchUserInfo,
  parseJwt,
  logout as revokeToken,
} from "../services/userService";
import { AuthTokens, useAuthStore } from "../store/authStore";
import { cancel, onUrl, start } from "@fabianlars/tauri-plugin-oauth";

// --- Configuration ---
export const AUTH0_DOMAIN = "dev-q8fu8sev1deljwdb.us.auth0.com";
const CLIENT_ID = "tMfu0Y4XuUixvOMfkB3xsKm5Wf87ZSQP";
const REDIRECT_URI = "https://samvad.iamdhakrey.dev";
const APP_SCHEME = "samvad";

// --- PKCE Utilities ---
function generateRandomString(length: number): string {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values)
    .map((x) => charset[x % charset.length])
    .join("");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);

  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function clearOAuthSession(state: string): void {
  sessionStorage.removeItem(`pkce_verifier_${state}`);
}

export function useAuth0Desktop() {
  const {
    setUser,
    setTokens,
    setIsLoading,
    setError,
    logout: clearAuth,
    user,
    tokens,
  } = useAuthStore();

  // Use refs to track initialization and prevent duplicate listeners
  const isInitializedRef = useRef(false);
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const processingRef = useRef<Set<string>>(new Set()); // Track processing codes to prevent duplicates

  // Initialize auth on mount
  useEffect(() => {
    const initializeAuth = async () => {
      if (isInitializedRef.current) return; // Prevent running twice
      isInitializedRef.current = true;

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
              console.error("Failed to fetch user info:", err);
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
        console.error("Failed to initialize auth:", err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []); // Empty dependency array - runs only once

  // Handle deep links - setup listener only once
  useEffect(() => {
    let isMounted = true;

    const setupListener = async () => {
      try {
        // Only set up listener once
        if (unlistenRef.current) return;

        const unlisten = await listen<string>(
          "oauth-redirect",
          async (event) => {
            if (!isMounted) return;

            const url = event.payload;
            console.log("Received OAuth callback:", url);

            try {
              const parsedUrl = new URL(url);

              // Validate URL format
              if (parsedUrl.protocol !== `${APP_SCHEME}:`) {
                console.warn("Invalid protocol:", parsedUrl.protocol);
                return;
              }

              const code = parsedUrl.searchParams.get("code");
              const state = parsedUrl.searchParams.get("state");
              const error = parsedUrl.searchParams.get("error");

              // Check for error from Auth0
              if (error) {
                const errorDesc =
                  parsedUrl.searchParams.get("error_description");
                console.error("Auth failed:", error, errorDesc);
                setError(`Authentication failed: ${errorDesc || error}`);
                return;
              }

              // Validate code and state
              if (!code || !state) {
                console.error("Missing code or state in callback");
                setError("Invalid callback parameters. Please try again.");
                return;
              }

              // Prevent duplicate processing of the same code
              const codeKey = `${code}_${state}`;
              if (processingRef.current.has(codeKey)) {
                console.warn(
                  "Already processing this code, ignoring duplicate",
                );
                return;
              }

              processingRef.current.add(codeKey);

              setIsLoading(true);
              try {
                await exchangeCodeForToken(code, state, url);
              } catch (err) {
                console.error("Token exchange failed:", err);
                setError(
                  "Failed to complete authentication. Please try again.",
                );
              } finally {
                clearOAuthSession(state);
                setIsLoading(false);
                processingRef.current.delete(codeKey);
              }
            } catch (err) {
              console.error("Failed to parse deep link URL:", err);
              setError(
                "Failed to process authentication callback. Please try again.",
              );
            }
          },
        );

        unlistenRef.current = unlisten;
      } catch (err) {
        console.error("Failed to setup deep link listener:", err);
      }
    };

    setupListener();

    // Cleanup function
    return () => {
      isMounted = false;
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, []); // Empty dependency array - runs only once

  const exchangeCodeForToken = useCallback(
    async (code: string, state: string, redirectUri: string): Promise<void> => {
      const verifier = sessionStorage.getItem(`pkce_verifier_${state}`);
      if (!verifier) throw new Error("No PKCE verifier found in session");

      const response = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: CLIENT_ID,
          code_verifier: verifier,
          code,
          redirect_uri: redirectUri, // MUST match the exact URI used in authorize
        }).toString(),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error_description || errData.error);
      }

      const tokenResponse = await response.json();
      const decodedToken = parseJwt(
        tokenResponse.id_token || tokenResponse.access_token,
      );
      const expiresAt = decodedToken.exp
        ? decodedToken.exp * 1000
        : Date.now() + tokenResponse.expires_in * 1000;

      const newTokens: AuthTokens = {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        idToken: tokenResponse.id_token,
        expiresIn: tokenResponse.expires_in,
        expiresAt,
      };

      await saveTokens(newTokens);
      setTokens(newTokens);

      const userInfo = await fetchUserInfo(tokenResponse.access_token);
      setUser(userInfo);
    },
    [setTokens, setUser],
  );

  const login = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    let port: number | null = null;
    let unlisten: (() => void) | null = null;
    console.log("login Clicked", port);

    try {
      const verifier = generateRandomString(64);
      const state = generateRandomString(32);
      const challenge = await generateCodeChallenge(verifier);

      sessionStorage.setItem(`pkce_verifier_${state}`, verifier);

      // 1. Start the ephemeral loopback server
      console.log("server Starting");
      port = await start({ ports: [19990,19991,19992] });
      console.log("server Start");
      const loopbackUri = `http://127.0.0.1:${port}`;

      // 2. Listen for the HTTP GET callback
      unlisten = await onUrl(async (urlString) => {
        try {
          const url = new URL(urlString);
          const code = url.searchParams.get("code");
          const urlState = url.searchParams.get("state");
          const error = url.searchParams.get("error");

          if (error) {
            console.log("error", error);
            throw new Error(url.searchParams.get("error_description") || error);
          }
          if (!code || !urlState) {
            console.log("Error", code);
            throw new Error("Security validation failed");
          }
          await exchangeCodeForToken(code, urlState, loopbackUri);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
          console.log(err);
        } finally {
          // Clean up the server immediately after capturing the payload
          if (port) {
            try {
              await cancel(port);
            } catch (cancelErr) {
              console.log("Server already closed or ignored:", cancelErr);
            }
          }
          if (unlisten) unlisten();
          clearOAuthSession(state);
          setIsLoading(false);
        }
      });

      // 3. Open the browser
      const authUrl = new URL(`https://${AUTH0_DOMAIN}/authorize`);
      authUrl.searchParams.append("client_id", CLIENT_ID);
      authUrl.searchParams.append("response_type", "code");
      authUrl.searchParams.append("code_challenge", challenge);
      authUrl.searchParams.append("code_challenge_method", "S256");
      authUrl.searchParams.append("redirect_uri", loopbackUri);
      authUrl.searchParams.append(
        "scope",
        "openid profile email offline_access",
      );
      authUrl.searchParams.append("state", state);

      await openUrl(authUrl.toString());
    } catch (err) {
      console.log("server Start error:", err);
      if (port) await cancel(port);
      if (unlisten) unlisten();
      setError(err instanceof Error ? err.message : "Failed to initiate login");
      setIsLoading(false);
    }
  }, [exchangeCodeForToken, setIsLoading, setError]);

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);

    try {
      // Revoke the access token
      if (tokens?.accessToken) {
        try {
          await revokeToken(tokens.accessToken);
        } catch (err) {
          console.warn("Failed to revoke token remotely:", err);
          // Continue with local logout even if remote revocation fails
        }
      }

      // Clear local auth state
      clearAuth();
      await clearTokens();
      setError(null);

      console.log("Successfully logged out");

      // Optionally redirect to Auth0 logout endpoint
      const logoutUrl = new URL(`https://${AUTH0_DOMAIN}/v2/logout`);
      logoutUrl.searchParams.append("client_id", CLIENT_ID);
      logoutUrl.searchParams.append("returnTo", REDIRECT_URI);

      await openUrl(logoutUrl.toString());
    } catch (err) {
      console.error("Logout failed:", err);
      // Still clear local state even if remote logout fails
      clearAuth();
      await clearTokens();
    } finally {
      setIsLoading(false);
    }
  }, [tokens?.accessToken, setIsLoading, setError, clearAuth]);

  return {
    login,
    logout,
    user,
    tokens,
    isAuthenticated: !!user && !!tokens,
  };
}
