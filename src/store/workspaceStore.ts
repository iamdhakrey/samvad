import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { Workspace } from "../types";
import {
  Collection,
  CollectionTree,
  EnvironmentVariable,
  EnvironmentWithVariables,
  AdditionType,
} from "@samvad-internal/models";

export interface WorkspaceStore {
  environments: EnvironmentWithVariables[];
  workspaces: Workspace[];
  collections: Collection[];
  activeWorkspaceId: string | null;
  activeCollectionId: string | null;
  activeCollectionTree: CollectionTree | null;
  collectionTrees: CollectionTree[];
  activeEnvironmentId: string | null;
  isLoading: boolean;
  isLoadingCollections: boolean;
  isLoadingCollectionTree: boolean;
  error: string | null;

  additionTypes: AdditionType[];
  fetchAdditionTypes: () => Promise<void>;

  fetchWorkspaces: () => Promise<void>;
  createWorkspace: (name: string) => Promise<void>;
  renameWorkspace: (id: string, name: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  setActiveWorkspace: (id: string) => Promise<void>;
  getActiveState: () => Promise<void>;

  // Collections
  fetchCollections: () => Promise<void>;
  fetchCollectionTree: (collectionId: string) => Promise<void>;
  setActiveCollection: (id: string | null) => Promise<void>;
  createCollection: (name: string) => Promise<void>;
  renameCollection: (id: string, name: string) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  cloneCollection: (id: string, newName: string) => Promise<void>;

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
    type: "WS" | "REST" | "GRPC" | "GRAPHQL",
  ) => Promise<void>;
  createWs: (
    collectionId: string,
    folderId: string | null,
    name: string,
  ) => Promise<void>;
  createGraphQl: (
    collectionId: string,
    folderId: string | null,
    name: string,
  ) => Promise<void>;
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
  collections: [],
  collectionTrees: [],
  activeCollectionTree: null,
  activeWorkspaceId: null,
  activeCollectionId: null,
  isLoading: false,
  isLoadingCollections: false,
  isLoadingCollectionTree: false,
  error: null,
  activeEnvironmentId: null,
  environments: [],

  additionTypes: [],
  fetchAdditionTypes: async () => {
    try {
      const types = await invoke<AdditionType[]>("get_addition_types");
      set({ additionTypes: types });
    } catch (err) {
      console.error("Failed to load addition types:", err);
    }
  },

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
        await get().setActiveWorkspace(currentActive);
      } else {
        set({
          collections: [],
          activeCollectionId: null,
          activeCollectionTree: null,
          collectionTrees: [],
        });
      }
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  setActiveWorkspace: async (id: string) => {
    try {
      await invoke("set_active_workspace", { id });
      set({
        activeWorkspaceId: id,
        activeCollectionId: null,
        activeCollectionTree: null,
        collectionTrees: [],
        collections: [],
      });
      await get().fetchCollections();
    } catch (err) {
      set({ error: String(err) });
    }
  },

  getActiveState: async () => {
    try {
      const fullState = await invoke<{
        activeWorkspaceId?: string;
        activeEnvironmentId?: string;
        activeCollectionId?: string;
      }>("get_active_state_full");
      if (fullState.activeWorkspaceId) {
        set({ activeWorkspaceId: fullState.activeWorkspaceId });
      }
      if (fullState.activeEnvironmentId) {
        set({ activeEnvironmentId: fullState.activeEnvironmentId });
      }
      if (fullState.activeCollectionId) {
        set({ activeCollectionId: fullState.activeCollectionId });
      }
      console.log("Restored active state:", fullState);
    } catch (err) {
      set({ error: String(err) });
    }
  },

  // Collections
  fetchCollections: async () => {
    const { activeWorkspaceId, activeCollectionId } = get();
    if (!activeWorkspaceId) return;
    set({ isLoadingCollections: true });

    try {
      const collections = await invoke<Collection[]>("list_collections", {
        workspaceid: activeWorkspaceId,
      });
      console.log("Fetched collections list:", collections);

      // Determine which collection should be active
      let targetCollectionId = activeCollectionId;
      if (
        !targetCollectionId ||
        !collections.some((c) => c.id === targetCollectionId)
      ) {
        targetCollectionId = collections.length > 0 ? collections[0].id : null;
      }

      set({
        collections: collections || [],
        activeCollectionId: targetCollectionId,
        isLoadingCollections: false,
      });

      if (targetCollectionId) {
        await get().fetchCollectionTree(targetCollectionId);
        await invoke("set_active_collection", {
          collectionid: targetCollectionId,
        });
      } else {
        set({
          activeCollectionTree: null,
          collectionTrees: [],
        });
        await invoke("set_active_collection", { collectionid: null });
      }
    } catch (err) {
      console.error("Error fetching collections:", err);
      set({ error: String(err), isLoadingCollections: false });
    }
  },

  fetchCollectionTree: async (collectionId: string) => {
    const { activeWorkspaceId } = get();
    if (!activeWorkspaceId || !collectionId) return;
    set({ isLoadingCollectionTree: true });

    try {
      const tree = await invoke<CollectionTree>("get_collection_tree", {
        workspaceid: activeWorkspaceId,
        collectionid: collectionId,
      });
      console.log("Fetched collection tree:", tree);
      set({
        activeCollectionTree: tree,
        collectionTrees: tree ? [tree] : [],
        isLoadingCollectionTree: false,
      });
    } catch (err) {
      console.error("Error fetching collection tree:", err);
      set({ error: String(err), isLoadingCollectionTree: false });
    }
  },

  setActiveCollection: async (id: string | null) => {
    set({ activeCollectionId: id });
    try {
      await invoke("set_active_collection", { collectionid: id ?? null });
      if (id) {
        await get().fetchCollectionTree(id);
      } else {
        set({ activeCollectionTree: null, collectionTrees: [] });
      }
    } catch (error) {
      console.error("Failed to persist active collection:", error);
    }
  },

  createCollection: async (name: string) => {
    const { activeWorkspaceId } = get();
    if (!activeWorkspaceId || !name.trim()) return;
    set({ isLoadingCollections: true });

    try {
      const newCollection = await invoke<Collection>("create_collection", {
        workspaceid: activeWorkspaceId,
        name,
      });
      set((state) => ({
        collections: [...state.collections, newCollection],
        activeCollectionId: newCollection.id,
        isLoadingCollections: false,
      }));
      await get().setActiveCollection(newCollection.id);
    } catch (err) {
      set({ error: String(err), isLoadingCollections: false });
    }
  },

  deleteCollection: async (collectionId: string) => {
    set({ isLoadingCollections: true });
    try {
      await invoke("delete_collection", { collectionid: collectionId });
      const currentActive = get().activeCollectionId;
      const nextCollections = get().collections.filter(
        (c) => c.id !== collectionId,
      );
      let nextActiveId = currentActive;

      if (currentActive === collectionId) {
        nextActiveId =
          nextCollections.length > 0 ? nextCollections[0].id : null;
      }

      set({
        collections: nextCollections,
        activeCollectionId: nextActiveId,
        isLoadingCollections: false,
      });

      if (nextActiveId) {
        await get().setActiveCollection(nextActiveId);
      } else {
        set({ activeCollectionTree: null, collectionTrees: [] });
        await invoke("set_active_collection", { collectionid: null });
      }
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
      set((state) => {
        const nextCollections = state.collections.map((c) =>
          c.id === collectionId ? { ...c, name } : c,
        );
        let nextTree = state.activeCollectionTree;
        if (nextTree && nextTree.collection.id === collectionId) {
          nextTree = {
            ...nextTree,
            collection: { ...nextTree.collection, name },
          };
        }
        return {
          collections: nextCollections,
          activeCollectionTree: nextTree,
          collectionTrees: nextTree ? [nextTree] : [],
          isLoadingCollections: false,
        };
      });
    } catch (err) {
      console.log("Error renaming collection:", err);
      set({ error: String(err), isLoadingCollections: false });
    }
  },

  cloneCollection: async (collectionId: string, newName: string) => {
    if (!newName.trim()) return;
    set({ isLoadingCollections: true });
    try {
      const cloned = await invoke<Collection>("clone_collection", {
        collectionid: collectionId,
        newname: newName,
      });
      set((state) => ({
        collections: [...state.collections, cloned],
        isLoadingCollections: false,
      }));
      await get().setActiveCollection(cloned.id);
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
    set({ isLoadingCollectionTree: true });
    try {
      await invoke("create_folder", {
        collectionid: collectionId,
        parentfolderid: parentFolderId,
        name,
      });
      await get().fetchCollectionTree(collectionId);
    } catch (err) {
      console.error("Error creating folder:", err);
      set({ error: String(err), isLoadingCollectionTree: false });
    }
  },

  deleteFolder: async (folderId: string) => {
    const { activeCollectionId } = get();
    set({ isLoadingCollectionTree: true });
    try {
      await invoke("delete_folder", { folderid: folderId });
      if (activeCollectionId) {
        await get().fetchCollectionTree(activeCollectionId);
      } else {
        set({ isLoadingCollectionTree: false });
      }
    } catch (err) {
      console.error("Error deleting folder:", err);
      set({ error: String(err), isLoadingCollectionTree: false });
    }
  },

  renameFolder: async (
    collectionId: string,
    folderId: string,
    name: string,
  ) => {
    if (!name.trim()) return;
    set({ isLoadingCollectionTree: true });
    try {
      await invoke("rename_folder", {
        collectionid: collectionId,
        folderid: folderId,
        name,
      });
      await get().fetchCollectionTree(collectionId);
    } catch (err) {
      console.error("Error renaming folder:", err);
      set({ error: String(err), isLoadingCollectionTree: false });
    }
  },

  createRequest: async (
    collectionId: string,
    folderId: string | null,
    name: string,
    type: "WS" | "REST" | "GRPC" | "GRAPHQL",
  ) => {
    set({ isLoadingCollectionTree: true });
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
        reqtype: type,
      });
      await get().fetchCollectionTree(collectionId);
    } catch (err) {
      console.error("Error creating request:", err);
      set({ error: String(err), isLoadingCollectionTree: false });
    }
  },

  createWs: async (
    collectionId: string,
    folderId: string | null,
    name: string,
  ) => {
    set({ isLoadingCollectionTree: true });
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
      await get().fetchCollectionTree(collectionId);
    } catch (err) {
      console.error("Error creating WS request:", err);
      set({ error: String(err), isLoadingCollectionTree: false });
    }
  },

  createGraphQl: async (
    collectionId: string,
    folderId: string | null,
    name: string,
  ) => {
    set({ isLoadingCollectionTree: true });
    try {
      console.log(
        "Creating GraphQL request:",
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
        reqtype: "graphql",
      });
      await get().fetchCollectionTree(collectionId);
    } catch (err) {
      console.error("Error creating GraphQL request:", err);
      set({ error: String(err), isLoadingCollectionTree: false });
    }
  },

  deleteRequest: async (requestId: string) => {
    const { activeCollectionId } = get();
    set({ isLoadingCollectionTree: true });
    try {
      await invoke("delete_request", { requestid: requestId });
      if (activeCollectionId) {
        await get().fetchCollectionTree(activeCollectionId);
      } else {
        set({ isLoadingCollectionTree: false });
      }
    } catch (err) {
      console.error("Error deleting request:", err);
      set({ error: String(err), isLoadingCollectionTree: false });
    }
  },

  renameRequest: async (id: string, name: string) => {
    const { activeCollectionId } = get();
    set({ isLoadingCollectionTree: true });
    try {
      await invoke("rename_request", { requestid: id, name });
      if (activeCollectionId) {
        await get().fetchCollectionTree(activeCollectionId);
      } else {
        set({ isLoadingCollectionTree: false });
      }
    } catch (err) {
      console.error("Error renaming request:", err);
      set({ error: String(err), isLoadingCollectionTree: false });
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
