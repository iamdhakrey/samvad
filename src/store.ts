import { create } from "zustand";
import {
  ApiRequest,
  AppSettings,
  CollectionTree,
  EnvironmentVariable,
  EnvironmentWithVariables,
  HistoryEntry,
  HttpMethod,
  RequestTab,
  WsMessage,
  WsSavedMessage,
} from "./types";
import { invoke } from "@tauri-apps/api/core";
import { WorkspaceStore, Workspace } from "./types";
import { sendNativeRequest } from "./services/rest";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

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
        get().fetchHistory();
        // setResponse(res);
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

    try {
      // Assuming you have this command in your Rust backend
      await invoke("save_request", { request: activeTab.request });

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

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  workspaces: [],
  collectionTrees: [],
  activeWorkspaceId: null,
  isLoading: false,
  isLoadingCollections: false,
  error: null,
  activeEnvironmentId: null,
  environments: [],

  fetchWorkspaces: async () => {
    set({ isLoading: true, error: null });
    try {
      const workspaces = await invoke<Workspace[]>("list_workspaces");
      set({ workspaces, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  createWorkspace: async (name: string) => {
    if (!name.trim()) return;
    set({ isLoading: true, error: null });
    try {
      const newWorkspace = await invoke<Workspace>("create_workspace", {
        name,
      });
      set((state) => ({
        workspaces: [...state.workspaces, newWorkspace],
        activeWorkspaceId: state.activeWorkspaceId ?? newWorkspace.id,
        isLoading: false,
      }));

      // Auto-set active in backend if it's the only one
      if (get().workspaces.length === 1) {
        await get().setActiveWorkspace(newWorkspace.id);
      }
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  renameWorkspace: async (id: string, name: string) => {
    if (!name.trim()) return;
    set({ isLoading: true, error: null });
    try {
      await invoke("rename_workspace", { id, name });
      set((state) => ({
        workspaces: state.workspaces.map((w) =>
          w.id === id
            ? { ...w, name, updated_at: new Date().toISOString() }
            : w,
        ),
        isLoading: false,
      }));
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  deleteWorkspace: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await invoke("delete_workspace", { id });
      set((state) => {
        const nextWorkspaces = state.workspaces.filter((w) => w.id !== id);
        let nextActive = state.activeWorkspaceId;
        if (state.activeWorkspaceId === id) {
          nextActive = nextWorkspaces.length > 0 ? nextWorkspaces[0].id : null;
        }
        return {
          workspaces: nextWorkspaces,
          activeWorkspaceId: nextActive,
          isLoading: false,
        };
      });

      // Sync structural fallbacks down to backend
      const currentActive = get().activeWorkspaceId;
      if (currentActive) {
        await invoke("set_active_workspace", { id: currentActive });
      }
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  setActiveWorkspace: async (id: string) => {
    try {
      await invoke("set_active_workspace", { id });
      set({ activeWorkspaceId: id });
    } catch (err) {
      set({ error: String(err) });
    }
  },

  getActiveState: async () => {
    try {
      // Use get_active_state_full to restore both workspace and environment
      const fullState = await invoke<{
        activeWorkspaceId?: string;
        activeEnvironmentId?: string;
      }>("get_active_state_full");
      if (fullState.activeWorkspaceId) {
        set({ activeWorkspaceId: fullState.activeWorkspaceId });
      }
      if (fullState.activeEnvironmentId) {
        set({ activeEnvironmentId: fullState.activeEnvironmentId });
      }
      console.log("Restored active state:", fullState);
    } catch (err) {
      set({ error: String(err) });
    }
  },

  // Collections
  fetchCollections: async () => {
    const { activeWorkspaceId } = get();
    if (!activeWorkspaceId) return;
    set({ isLoadingCollections: true });

    try {
      const collections = await invoke<CollectionTree[]>(
        "get_collection_trees",
        {
          workspaceid: activeWorkspaceId,
        },
      );
      console.log("Fetched collections:", collections);
      if (!collections) {
        set({ error: "No collections found", isLoadingCollections: false });
        return;
      }
      set({ collectionTrees: collections, isLoadingCollections: false });
    } catch (err) {
      console.error("Error fetching collections:", err);
      set({ error: String(err), isLoadingCollections: false });
    }
  },

  createCollection: async (name: string) => {
    const { activeWorkspaceId } = get();
    if (!activeWorkspaceId || !name.trim()) return;
    set({ isLoadingCollections: true });

    try {
      await invoke<CollectionTree>("create_collection", {
        workspaceid: activeWorkspaceId,
        name,
      });
      await get().fetchCollections(); // Refresh the collection list after creation
      set({
        // collectionTrees: [...state.collectionTrees, newCollection],
        isLoadingCollections: false,
      });
    } catch (err) {
      set({ error: String(err), isLoadingCollections: false });
    }
  },

  deleteCollection: async (collectionId: string) => {
    set({ isLoadingCollections: true });
    try {
      await invoke("delete_collection", { collectionid: collectionId });
      set((state) => ({
        collectionTrees: state.collectionTrees.filter(
          (c) => c.collection.id !== collectionId,
        ),
        isLoadingCollections: false,
      }));
    } catch (err) {
      console.error("Error deleting collection:", err);
      set({ error: String(err), isLoadingCollections: false });
    }
  },

  renameCollection: async (collectionId: string, name: string) => {
    if (!name.trim()) return;
    set({ isLoadingCollections: true });
    try {
      await invoke("rename_collection", { collectionid: collectionId, name });
      set((state) => ({
        collectionTrees: state.collectionTrees.map((c) =>
          c.collection.id === collectionId
            ? { ...c, collection: { ...c.collection, name } }
            : c,
        ),
        isLoadingCollections: false,
      }));
    } catch (err) {
      console.log("Error renaming collection:", err);
      set({ error: String(err), isLoadingCollections: false });
    }
  },

  cloneCollection: async (collectionId: string, newName: string) => {
    if (!newName.trim()) return;
    set({ isLoadingCollections: true });
    try {
      await invoke("clone_collection", {
        collectionid: collectionId,
        newname: newName,
      });
      await get().fetchCollections(); // Refresh the collection list after cloning
      set({ isLoadingCollections: false });
    } catch (err) {
      console.error("Error cloning collection:", err);
      set({ error: String(err), isLoadingCollections: false });
    }
  },

  // Folders
  createFolder: async (
    collectionId: string,
    parentFolderId: string | null,
    name: string,
  ) => {
    if (!name.trim()) return;
    set({ isLoadingCollections: true });
    try {
      await invoke("create_folder", {
        collectionid: collectionId,
        parentfolderid: parentFolderId,
        name,
      });
      await get().fetchCollections(); // Refresh the collection list after folder creation
      set({ isLoadingCollections: false });
    } catch (err) {
      console.error("Error creating folder:", err);
      set({ error: String(err), isLoadingCollections: false });
    }
  },

  deleteFolder: async (folderId: string) => {
    set({ isLoadingCollections: true });
    try {
      await invoke("delete_folder", { folderid: folderId });
      await get().fetchCollections(); // Refresh the collection list after folder deletion
      set({ isLoadingCollections: false });
    } catch (err) {
      console.error("Error deleting folder:", err);
      set({ error: String(err), isLoadingCollections: false });
    }
  },

  renameFolder: async (
    collectionId: string,
    folderId: string,
    name: string,
  ) => {
    if (!name.trim()) return;
    set({ isLoadingCollections: true });
    try {
      await invoke("rename_folder", {
        collectionid: collectionId,
        folderid: folderId,
        name,
      });
      await get().fetchCollections(); // Refresh the collection list after folder renaming
      set({ isLoadingCollections: false });
    } catch (err) {
      console.error("Error renaming folder:", err);
      set({ error: String(err), isLoadingCollections: false });
    }
  },

  createRequest: async (
    collectionId: string,
    folderId: string | null,
    name: string,
  ) => {
    set({ isLoadingCollections: true });
    try {
      console.log(
        "Creating request:",
        name,
        "in collection:",
        collectionId,
        "folder:",
        folderId,
      );
      await invoke("create_request", {
        collectionid: collectionId,
        folderid: folderId,
        name: name,
      });
      await get().fetchCollections(); // Refresh the collection list after request creation
      set({ isLoadingCollections: false });
    } catch (err) {
      console.error("Error creating request:", err);
      set({ error: String(err), isLoadingCollections: false });
    }
  },

  createWs: async (
    collectionId: string,
    folderId: string | null,
    name: string,
  ) => {
    set({ isLoadingCollections: true });
    try {
      console.log(
        "Creating WS request:",
        name,
        "in collection:",
        collectionId,
        "folder:",
        folderId,
      );
      await invoke("create_ws_request", {
        collectionid: collectionId,
        folderid: folderId,
        name: name,
      });
      await get().fetchCollections(); // Refresh the collection list after request creation
      set({ isLoadingCollections: false });
    } catch (err) {
      console.error("Error creating WS request:", err);
      set({ error: String(err), isLoadingCollections: false });
    }
  },

  deleteRequest: async (requestId: string) => {
    set({ isLoadingCollections: true });
    try {
      await invoke("delete_request", { requestid: requestId });
      await get().fetchCollections(); // Refresh the collection list after request deletion
      set({ isLoadingCollections: false });
    } catch (err) {
      console.error("Error deleting request:", err);
      set({ error: String(err), isLoadingCollections: false });
    }
  },

  renameRequest: async (id: string, name: string) => {
    set({ isLoadingCollections: true });
    try {
      await invoke("rename_request", { requestid: id, name });
      await get().fetchCollections(); // Refresh the collection list after request rename
      set({ isLoadingCollections: false });
    } catch (err) {
      console.error("Error renaming request:", err);
      set({ error: String(err), isLoadingCollections: false });
    }
  },

  fetchEnvironments: async (workspaceid: string) => {
    set({ isLoading: true });
    try {
      const envs = await invoke<EnvironmentWithVariables[]>(
        "list_environments",
        { workspaceid },
      );
      set({ environments: envs, isLoading: false });
      console.log("Fetched environments:", envs);
    } catch (error) {
      console.error("Failed to load environments:", error);
      set({ isLoading: false });
    }
  },

  createEnvironment: async (workspaceid: string, name: string) => {
    try {
      await invoke("create_environment", { workspaceid, name });
      await get().fetchEnvironments(workspaceid);
    } catch (error) {
      console.error("Failed to create environment:", error);
    }
  },

  renameEnvironment: async (environmentid: string, name: string) => {
    try {
      await invoke("rename_environment", { environmentid, name });
      set((state) => ({
        environments: state.environments.map((env) =>
          env.environment.id === environmentid
            ? { ...env, environment: { ...env.environment, name } }
            : env,
        ),
      }));
    } catch (error) {
      console.error("Failed to rename environment:", error);
    }
  },

  deleteEnvironment: async (environmentid: string) => {
    try {
      await invoke("delete_environment", { environmentid });
      set((state) => ({
        environments: state.environments.filter(
          (env) => env.environment.id !== environmentid,
        ),
        activeEnvironmentId:
          state.activeEnvironmentId === environmentid
            ? null
            : state.activeEnvironmentId,
      }));
    } catch (error) {
      console.error("Failed to delete environment:", error);
    }
  },

  saveVariables: async (
    environmentid: string,
    variables: EnvironmentVariable[],
  ) => {
    try {
      console.log(
        "Saving variables for environment:",
        environmentid,
        "variables:",
        variables,
      );
      await invoke("replace_variables", {
        environmentid: environmentid,
        variables,
      });
      set((state) => ({
        environments: state.environments.map((env) =>
          env.environment.id === environmentid ? { ...env, variables } : env,
        ),
      }));
    } catch (error) {
      console.error("Failed to save variables:", error);
    }
  },

  setActiveEnvironment: async (id: string | null) => {
    set({ activeEnvironmentId: id });
    try {
      await invoke("set_active_environment", { environmentid: id ?? null });
    } catch (error) {
      console.error("Failed to persist active environment:", error);
    }
  },
}));

export const MethodStyles: Record<HttpMethod, string> = {
  GET: "text-method-get",
  POST: "text-secondary",
  PUT: "text-warning",
  PATCH: "text-primary",
  DELETE: "text-error",
  OPTIONS: "text-text-muted",
  HEAD: "text-text-muted",
  WS: "text-method-ws",
};

interface SettingsStore {
  settings: AppSettings | null;
  isSettingsOpen: boolean;
  isLoadingSettings: boolean;

  setSettingsOpen: (isOpen: boolean) => void;
  fetchSettings: () => Promise<void>;
  updateSettings: (newSettings: AppSettings) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: null,
  isSettingsOpen: false,
  isLoadingSettings: false,

  setSettingsOpen: (isOpen: boolean) => {
    set({ isSettingsOpen: isOpen });
    // Always re-fetch from disk when opening so we see the latest persisted values
    if (isOpen) {
      get().fetchSettings();
    }
  },

  fetchSettings: async () => {
    set({ isLoadingSettings: true });
    try {
      const settings = await invoke<AppSettings>("get_settings");
      set({ settings, isLoadingSettings: false });
    } catch (error) {
      console.error("Failed to load settings:", error);
      set({ isLoadingSettings: false });
    }
  },

  updateSettings: async (newSettings: AppSettings) => {
    try {
      await invoke("update_settings", { settings: newSettings });
      set({ settings: newSettings, isSettingsOpen: false });
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  },
}));
