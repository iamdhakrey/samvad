export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | "HEAD"
  | "WS"
  | "QUERY";

export type AuthType = "none" | "basic" | "bearer" | "apiKey";

export type BodyMode =
  "json" | "form-data" | "urlencoded" | "raw" | "multipart";

export interface AppSettings {
  followRedirects: boolean;
  maxRedirects: number;
  verifySslCertificates: boolean;
  timeoutMs: number;
  userAgent: string;
  proxyUrl: string | null;
}

export interface KeyValueRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface AuthConfig {
  type: AuthType;
  basic?: { username: string; password: string };
  bearer?: { token: string };
  apiKey?: { key: string; value: string; addTo: "header" | "query" };
}

export interface UploadedFile {
  id: string;
  name: string;
  sizeBytes: number;
}

export interface RequestBody {
  mode: BodyMode;
  raw?: string;
  formData?: KeyValueRow[];
  urlEncoded?: KeyValueRow[];
  files?: ApiFile[];
}

export interface ApiFile {
  name: string;
  path: string;
  sizeBytes: number;
  id: string; // Unique identifier for the file
}

export interface ApiRequestBody {
  files?: ApiFile[];
  raw?: string;
  json?: any;
  mode?: BodyMode;
  // Extend this if you have text fields or JSON payloads
}

// (KeyValueRow is defined above — this duplicate is removed)

export interface CookieRow {
  id: string;
  name: string;
  value: string;
  domain?: string;
  path?: string;
}

export interface ApiRequest {
  id: string;
  name: string;
  method: string;
  collection_id: string;
  folder_id: string | null;
  url: string;
  params: KeyValueRow[]; // Must be a sequence (array)
  headers: KeyValueRow[]; // Must be a sequence (array)
  cookies: CookieRow[]; // Must be a sequence (array)
  auth: any; // Match your AuthConfig structure
  body: ApiRequestBody;
}

export interface CollectionFolder {
  id: string;
  name: string;
  requests: ApiRequest[];
}

export interface Collection {
  id: string;
  name: string;
  folders: CollectionFolder[];
}

export interface Environment {
  id: string;
  name: string;
}

export interface HistoryEntry {
  id: string;
  requestid: string;
  method: HttpMethod;
  name: string;
  url: string;
  status: number;
  timestamp: string;
  durationMs: number;
}

export interface ApiResponse {
  status: number;
  statusText: string;
  timeMs: number;
  sizeBytes: number;
  headers: Record<string, string>;
  cookies: CookieRow[];
  body: string;
}

// ── WebSocket types ──────────────────────────────────────────────────

/** Runtime log entry — ephemeral, lives only in memory. */
export interface WsMessage {
  connectionId: string;
  direction: "sent" | "received" | "closed";
  data: string;
  timestamp: string;
}

/** A saved message template — persisted to YAML via the backend. */
export interface WsSavedMessage {
  id: string;
  name: string;
  data: string;
}

export type WsStatus = "disconnected" | "connecting" | "connected";

export interface RequestTab {
  id: string;
  request: ApiRequest;
  isDirty: boolean;
  response?: ApiResponse;
  isSending: boolean;
  error?: string;
  // WebSocket state (only used when method is "WS")
  wsConnectionId?: string;
  wsMessages: WsMessage[];
  wsStatus: WsStatus;
  wsSavedMessages: WsSavedMessage[];
  wsProtocol: "raw" | "graphql-ws";
  /** Tracks active graphql-ws subscription IDs for cleanup */
  wsGqlSubscriptionIds: string[];
}

export interface Workspace {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  collectionId: string;
  parentFolderId: string | null;
  name: string;
  sort_order: number;
}

export interface FolderNode {
  folder: Folder;
  children: FolderNode[];
  requests: ApiRequest[];
}

export interface Collection {
  id: string;
  workspace_id: string;
  name: string;
  sort_order: number;
}
export interface CollectionTree {
  collection: Collection;
  folders: FolderNode[];
  requests: ApiRequest[];
}

export interface EnvironmentVariable {
  id: string;
  environmentid: string;
  key: string;
  value: string;
  enabled: boolean;
  isSecret: boolean;
  sortOrder?: number;
}

export interface Environment {
  id: string;
  name: string;
  workspaceId: string;
  sortOrder: number;
}

/**
 * Matches the Rust serialization of `EnvironmentWithVariables`:
 * { environment: { id, workspaceId, name, sortOrder }, variables: [...] }
 */
export interface EnvironmentWithVariables {
  environment: Environment;
  variables: EnvironmentVariable[];
}

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

export const MethodStyles: Record<HttpMethod, string> = {
  GET: "text-method-get",
  POST: "text-secondary",
  PUT: "text-warning",
  PATCH: "text-primary",
  DELETE: "text-error",
  OPTIONS: "text-text-muted",
  HEAD: "text-text-muted",
  WS: "text-method-ws",
  QUERY: "text-method-query",
};
