import { useEffect, useCallback, useRef } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useAuthStore } from "../store/authStore";
import { cancel, onUrl, start } from "@fabianlars/tauri-plugin-oauth";
import { invoke } from "@tauri-apps/api/core";

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

  // Initialize auth on mount
  useEffect(() => {
    const initializeAuth = async () => {
      if (isInitializedRef.current) return; // Prevent running twice
      isInitializedRef.current = true;

      setIsLoading(true);
      try {
        const state: any = await invoke("get_auth_state");
        console.log("state at initial auth", state)
        if (state.user && state.tokens) {
          setTokens(state.tokens);
          setUser(state.user);
          setIsLoading(false);
          return;
        } else {
          clearAuth();
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
              const state: any = await invoke("auth_handle_callback", {
                url,
              });

              if (state.user && state.tokens && state.isAuthenticated) {
                setTokens(state.tokens);
                setUser(state.user);
                setIsLoading(false);
              } else {
                setError("Failed to authenticate");
              }

              setIsLoading(true);
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
  }, []);

  const login = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    let port: number | null = null;
    let unlisten: (() => void) | null = null;
    console.log("login Clicked", port);

    try {
      console.log("server Starting");
      port = await start({ ports: [19990, 19991, 19992] });
      console.log("server Start");
      const loopbackUri = `http://127.0.0.1:${port}`;
      const authorizeUrl: string = await invoke("auth_start_login", {
        loopbackUri,
      });

      // 2. Listen for the HTTP GET callback
      unlisten = await onUrl(async (urlString) => {
        try {
          // Hand the raw callback URL directly to Rust for validation & token exchange
          const authState: any = await invoke("auth_handle_callback", {
            callbackUrl: urlString,
          });
          console.log("auth State", authState);
          setUser(authState.user);
          setTokens(authState.tokens);
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
          setIsLoading(false);
        }
      });

      await openUrl(authorizeUrl);
    } catch (err) {
      console.log("server Start error:", err);
      if (port) await cancel(port);
      if (unlisten) unlisten();
      setError(err instanceof Error ? err.message : "Failed to initiate login");
      setIsLoading(false);
    }
  }, [setIsLoading, setError]);

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      // Rust handles revoking tokens and clearing local DB/FS state.
      // It returns the Auth0 logout URL so we can clear the browser session.
      const logoutUrl: string = await invoke("auth_logout");

      clearAuth();
      await openUrl(logoutUrl);
    } catch (err) {
      console.error("Rust logout failed:", err);
      clearAuth();
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, clearAuth]);

  return {
    login,
    logout,
    user,
    tokens,
    isAuthenticated: !!user && !!tokens,
  };
}
