import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { Workspace } from "../types";
import {
  CollectionTree,
  EnvironmentVariable,
  EnvironmentWithVariables,
} from "@samvad-internal/models";

export interface WorkspaceStore {
  environments: EnvironmentWithVariables[];
  workspaces: Workspace[];
  collectionTrees: CollectionTree[];
  activeWorkspaceId: string | null;
  activeEnvironmentId: string | null;
  isLoading: boolean;
  isLoadingCollections: boolean;
  error: string | null;

  fetchWorkspaces: () => Promise<void>;
  createWorkspace: (name: string) => Promise<void>;
  renameWorkspace: (id: string, name: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  setActiveWorkspace: (id: string) => Promise<void>;
  getActiveState: () => Promise<void>;

  // Collections
  fetchCollections: () => Promise<void>;
  createCollection: (name: string) => Promise<void>;
  renameCollection: (id: string, name: string) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  cloneCollection: (id: string, newName: string) => Promise<void>;
  // addRequestToCollection: (collectionId: string, request: ApiRequest) => Promise<void>;
  // removeRequestFromCollection: (collectionId: string, requestId: string) => Promise<void>;

  // Folders
  createFolder: (
    collectionId: string,
    parentFolderId: string | null,
    name: string,
  ) => Promise<void>;
  renameFolder: (
    collectionId: string,
    folderId: string,
    name: string,
  ) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;

  // Request
  createRequest: (
    collectionId: string,
    folderId: string | null,
    name: string,
  ) => Promise<void>;
  createWs: (
    collectionId: string,
    folderId: string | null,
    name: string,
  ) => Promise<void>;
  // updateRequest: (requestId: string, updatedRequest: Partial<ApiRequest>) => Promise<void>;
  deleteRequest: (requestId: string) => Promise<void>;
  renameRequest: (id: string, name: string) => Promise<void>;

  fetchEnvironments: (workspaceid: string) => Promise<void>;
  createEnvironment: (workspaceid: string, name: string) => Promise<void>;
  renameEnvironment: (environmentid: string, name: string) => Promise<void>;
  deleteEnvironment: (environmentid: string) => Promise<void>;
  saveVariables: (
    environmentid: string,
    variables: EnvironmentVariable[],
  ) => Promise<void>;
  setActiveEnvironment: (id: string | null) => Promise<void>;
}

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
