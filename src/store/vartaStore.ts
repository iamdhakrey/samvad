import { create } from "zustand";
import {
  ApiRequest,
  HistoryEntry,
  RequestTab,
  WsMessage,
  WsSavedMessage,
} from "../types";
import { invoke } from "@tauri-apps/api/core";
import { sendNativeRequest } from "../services/rest";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useWorkspaceStore } from "./workspaceStore";

interface VartaState {
  tabs: RequestTab[];
  activeTabId: string | null;
  activeTab: RequestTab | null;
  isCommandPaletteOpen: boolean;
  isHistoryOpen: boolean;
  activeEnvId: string;
  isEnvEditorOpen: boolean;
  isSidebarOpen: boolean;
  historyEntries: HistoryEntry[];
  isNewReqSaveOpen: boolean;

  openRequest: (request: ApiRequest) => void;
  newTab: () => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateActiveRequest: (patch: Partial<ApiRequest>) => void;
  sendActiveRequest: () => void;
  saveActiveRequest: () => void;
  toggleCommandPalette: (open?: boolean) => void;
  toggleHistory: (open?: boolean) => void;
  setEnv: (id: string) => void;
  toggleSidebar: (open?: boolean) => void;
  setSidebarOpen: (open: boolean) => void;

  setIsNewReqSaveOpen: (open: boolean) => void;
  closeNewReqSave: () => void;

  openEnvEditor: () => void;
  closeEnvEditor: () => void;

  // WebSocket actions
  connectWebSocket: () => Promise<void>;
  disconnectWebSocket: () => Promise<void>;
  sendWsMessage: (message: string) => Promise<void>;
  addWsMessage: (msg: WsMessage) => void;
  loadSavedMessages: (requestId: string) => Promise<void>;
  addSavedMessage: (
    requestId: string,
    name: string,
    data: string,
  ) => Promise<void>;
  deleteSavedMessage: (requestId: string, messageId: string) => Promise<void>;
  setWsProtocol: (protocol: "raw" | "graphql-ws") => void;
  initWsListener: () => Promise<UnlistenFn>;
  // HistoryEntry
  fetchHistory: () => Promise<void>;
  deleteHistoryEntry: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
}

let tabCounter = 0;

function blankRequest(): ApiRequest {
  tabCounter += 1;
  return {
    id: `new-${tabCounter}`,
    name: "Untitled request",
    method: "GET",
    url: "",
    params: [{ id: "p1", key: "", value: "", enabled: true }],
    headers: [{ id: "h1", key: "", value: "", enabled: true }],
    cookies: [],
    auth: { type: "none" },
    body: { raw: "" },
    collection_id: "",
    folder_id: null,
  };
}

export const useVartaStore = create<VartaState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  isCommandPaletteOpen: false,
  isHistoryOpen: false,
  activeEnvId: "env-staging",
  isEnvEditorOpen: false,
  isSidebarOpen: false,
  activeTab: null,
  historyEntries: [],
  isNewReqSaveOpen: false,

  setIsNewReqSaveOpen: (open) => set({ isNewReqSaveOpen: open }),
  closeNewReqSave: () => set({ isNewReqSaveOpen: false }),

  toggleSidebar: (open) =>
    set((s) => ({
      isSidebarOpen: open !== undefined ? open : !s.isSidebarOpen,
    })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),

  openEnvEditor: () => set({ isEnvEditorOpen: true }),

  closeEnvEditor: () => set({ isEnvEditorOpen: false }),

  openRequest: (request) => {
    const existing = get().tabs.find((t) => t.request.id === request.id);
    if (existing) {
      set({ activeTabId: existing.id, activeTab: existing });
      return;
    }
    const tab: RequestTab = {
      id: request.id,
      request,
      isDirty: false,
      isSending: false,
      wsMessages: [],
      wsStatus: "disconnected",
      wsSavedMessages: [],
      wsProtocol: "raw",
      wsGqlSubscriptionIds: [],
    };
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }));
  },

  newTab: () => {
    const request = blankRequest();
    const tab: RequestTab = {
      id: request.id,
      request,
      isDirty: false,
      isSending: false,
      wsMessages: [],
      wsStatus: "disconnected",
      wsSavedMessages: [],
      wsProtocol: "raw",
      wsGqlSubscriptionIds: [],
    };
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }));
  },

  closeTab: (tabId) => {
    set((s) => {
      const remaining = s.tabs.filter((t) => t.id !== tabId);
      const wasActive = s.activeTabId === tabId;
      return {
        tabs: remaining,
        activeTabId: wasActive
          ? (remaining[remaining.length - 1]?.id ?? null)
          : s.activeTabId,
      };
    });
  },

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  updateActiveRequest: (patch) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === s.activeTabId
          ? { ...t, isDirty: true, request: { ...t.request, ...patch } }
          : t,
      ),
    }));
  },

  sendActiveRequest: () => {
    const { activeTabId } = get();
    if (!activeTabId) return;

    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === activeTabId ? { ...t, isSending: true } : t,
      ),
    }));

    // Placeholder for the real call — in the Tauri app this invokes a Rust
    // command (e.g. `invoke("send_request", { request })`) instead of fetch,
    // so requests aren't subject to browser CORS restrictions.
    setTimeout(async () => {
      const { tabs, activeTabId } = get();
      if (!activeTabId) return;
      const payload = tabs.find((t) => t.id === activeTabId)?.request;
      if (!payload) return;

      try {
        const res = await sendNativeRequest(payload);
        console.log(res);
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === activeTabId
              ? { ...t, isSending: false, response: res, error: undefined }
              : t,
          ),
        }));
        // setResponse(res);
        get().fetchHistory();
      } catch (err) {
        console.error(err);

        const errorMessage = err instanceof Error ? err.message : String(err);
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === activeTabId
              ? {
                  ...t,
                  isSending: false,
                  response: undefined,
                  error: errorMessage,
                }
              : t,
          ),
        }));
        // setError(String(err));
      }
    }, 600);
  },

  toggleCommandPalette: (open) =>
    set((s) => ({ isCommandPaletteOpen: open ?? !s.isCommandPaletteOpen })),

  toggleHistory: (open) =>
    set((s) => ({ isHistoryOpen: open ?? !s.isHistoryOpen })),

  setEnv: (id) => set({ activeEnvId: id }),

  saveActiveRequest: async () => {
    const state = get();
    const activeTab = state.tabs.find((t) => t.id === state.activeTabId);

    if (!activeTab || !activeTab.isDirty) return;
    if (activeTab?.request.id.startsWith("new-")) {
      if (activeTab.request.collection_id === "") {
        set({ activeTab: activeTab, isNewReqSaveOpen: true });
        return;
      } else {
        activeTab.request.id = crypto.randomUUID();
      }
    }

    try {
      // Assuming you have this command in your Rust backend
      const res = await invoke("save_request", { request: activeTab.request });
      console.log("Request saved:", res);
      // Clear dirty flag on success
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === state.activeTabId ? { ...t, isDirty: false } : t,
        ),
      }));
      useWorkspaceStore.getState().fetchCollections();
    } catch (error) {
      console.error("Failed to save request:", error);
      // Handle error toast here
    }
  },

  // ── WebSocket actions ──────────────────────────────────────────────

  connectWebSocket: async () => {
    const { activeTabId, tabs } = get();
    if (!activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;

    // Set connecting state
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              wsStatus: "connecting" as const,
              wsMessages: [],
              wsGqlSubscriptionIds: [],
            }
          : t,
      ),
    }));

    try {
      // Build headers from the request
      const headers: [string, string][] = tab.request.headers
        .filter((h) => h.enabled && h.key)
        .map((h) => [h.key, h.value] as [string, string]);

      // Auto-inject graphql-transport-ws sub-protocol header
      if (tab.wsProtocol === "graphql-ws") {
        const hasProto = headers.some(
          ([k]) => k.toLowerCase() === "sec-websocket-protocol",
        );
        if (!hasProto) {
          headers.push(["Sec-WebSocket-Protocol", "graphql-transport-ws"]);
        }
      }

      const connectionId = await invoke<string>("ws_connect", {
        url: tab.request.url,
        headers,
      });

      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === activeTabId
            ? {
                ...t,
                wsConnectionId: connectionId,
                wsStatus: "connected" as const,
              }
            : t,
        ),
      }));

      // Send connection_init for graphql-ws protocol
      if (tab.wsProtocol === "graphql-ws") {
        await invoke("ws_send", {
          connectionId,
          message: JSON.stringify({ type: "connection_init" }),
        });
      }
    } catch (err) {
      console.error("WS connect failed:", err);
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === activeTabId
            ? { ...t, wsStatus: "disconnected" as const, error: String(err) }
            : t,
        ),
      }));
    }
  },

  disconnectWebSocket: async () => {
    const { activeTabId, tabs } = get();
    if (!activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab?.wsConnectionId) return;

    try {
      await invoke("ws_disconnect", { connectionId: tab.wsConnectionId });
    } catch (err) {
      console.error("WS disconnect failed:", err);
    }
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              wsConnectionId: undefined,
              wsStatus: "disconnected" as const,
            }
          : t,
      ),
    }));
  },

  sendWsMessage: async (message: string) => {
    const { activeTabId, tabs } = get();
    if (!activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab?.wsConnectionId) return;

    try {
      let payload = message;

      // Wrap in graphql-ws framing if using the protocol
      if (tab.wsProtocol === "graphql-ws") {
        const subId = crypto.randomUUID();
        // Track subscription ID for cleanup
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === activeTabId
              ? {
                  ...t,
                  wsGqlSubscriptionIds: [...t.wsGqlSubscriptionIds, subId],
                }
              : t,
          ),
        }));

        try {
          const parsed = JSON.parse(message);
          payload = JSON.stringify({
            id: subId,
            type: "subscribe",
            payload: parsed,
          });
        } catch {
          // If message isn't valid JSON, send it as-is
          payload = message;
        }
      }

      await invoke("ws_send", {
        connectionId: tab.wsConnectionId,
        message: payload,
      });
    } catch (err) {
      console.error("WS send failed:", err);
    }
  },

  setWsProtocol: (protocol: "raw" | "graphql-ws") => {
    const { activeTabId } = get();
    if (!activeTabId) return;
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === activeTabId ? { ...t, wsProtocol: protocol } : t,
      ),
    }));
  },

  addWsMessage: (msg: WsMessage) => {
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.wsConnectionId === msg.connectionId) {
          // If it's a close event, also update status
          if (msg.direction === "closed") {
            return {
              ...t,
              wsMessages: [...t.wsMessages, msg],
              wsStatus: "disconnected" as const,
              wsConnectionId: undefined,
            };
          }
          return { ...t, wsMessages: [...t.wsMessages, msg] };
        }
        return t;
      }),
    }));
  },

  loadSavedMessages: async (requestId: string) => {
    try {
      const messages = await invoke<WsSavedMessage[]>(
        "ws_list_saved_messages",
        { requestId },
      );
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.request.id === requestId ? { ...t, wsSavedMessages: messages } : t,
        ),
      }));
    } catch (err) {
      console.error("Failed to load saved messages:", err);
    }
  },

  addSavedMessage: async (requestId: string, name: string, data: string) => {
    try {
      const msg = await invoke<WsSavedMessage>("ws_add_saved_message", {
        requestId,
        name,
        data,
      });
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.request.id === requestId
            ? { ...t, wsSavedMessages: [...t.wsSavedMessages, msg] }
            : t,
        ),
      }));
    } catch (err) {
      console.error("Failed to add saved message:", err);
    }
  },

  deleteSavedMessage: async (requestId: string, messageId: string) => {
    try {
      await invoke("ws_delete_saved_message", { requestId, messageId });
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.request.id === requestId
            ? {
                ...t,
                wsSavedMessages: t.wsSavedMessages.filter(
                  (m) => m.id !== messageId,
                ),
              }
            : t,
        ),
      }));
    } catch (err) {
      console.error("Failed to delete saved message:", err);
    }
  },

  initWsListener: async () => {
    const unlisten = await listen<WsMessage>("ws://message", (event) => {
      get().addWsMessage(event.payload);
    });
    // Also listen for status changes (disconnect from server side)
    const unlistenStatus = await listen<{
      connectionId: string;
      status: string;
    }>("ws://status", (event) => {
      if (event.payload.status === "disconnected") {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.wsConnectionId === event.payload.connectionId
              ? {
                  ...t,
                  wsConnectionId: undefined,
                  wsStatus: "disconnected" as const,
                }
              : t,
          ),
        }));
      }
    });
    return () => {
      unlisten();
      unlistenStatus();
    };
  },

  fetchHistory: async () => {
    try {
      const historyEntries = await invoke<HistoryEntry[]>("list_history", {
        limit: 100,
      });
      console.log("Fetched history entries:", historyEntries);
      set({ historyEntries: historyEntries });
    } catch (error) {
      console.error("Failed to load history:", error);
    }
  },

  clearHistory: async () => {
    try {
      await invoke("clear_history");
      set({ historyEntries: [] });
    } catch (error) {
      console.error("Failed to clear history:", error);
    }
  },

  deleteHistoryEntry: async (id: string) => {
    try {
      await invoke("delete_history_entry", { id });
      set((state) => ({
        historyEntries: state.historyEntries.filter((entry) => entry.id !== id),
      }));
    } catch (error) {
      console.error("Failed to delete history entry:", error);
    }
  },
}));
