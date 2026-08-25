import {
  ApiRequest,
  ApiResponse,
  Collection,
  CollectionTree,
  EnvironmentVariable,
  EnvironmentWithVariables,
  RequestItem,
  UploadedFile,
  WsSavedMessage,
} from "@samvad-internal/models";

export type { Collection };

export type AuthType = "none" | "basic" | "bearer" | "apiKey";

export type BodyMode =
  "json" | "form-data" | "urlencoded" | "raw" | "multipart";

export interface ApiRequestBody {
  files?: UploadedFile[];
  raw?: string;
  json?: any;
  mode?: BodyMode;
  // Extend this if you have text fields or JSON payloads
}

export interface CollectionFolder {
  id: string;
  name: string;
  requests: ApiRequest[];
}

// ── WebSocket types ──────────────────────────────────────────────────

/** Runtime log entry — ephemeral, lives only in memory. */
export interface WsMessage {
  connectionId: string;
  direction: "sent" | "received" | "closed";
  data: string;
  timestamp: string;
}

export type WsStatus = "disconnected" | "connecting" | "connected";

export interface RequestTab {
  id: string;
  request: RequestItem;
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
    type: "WS" | "REST" | "GRPC",
  ) => Promise<void>;
  createWs: (
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

export const MethodStyles: Record<string, string> = {
  GET: "text-method-get",
  POST: "text-secondary",
  PUT: "text-warning",
  PATCH: "text-primary",
  DELETE: "text-error",
  OPTIONS: "text-text-muted",
  HEAD: "text-text-muted",
  WS: "text-method-ws",
  QUERY: "text-method-query",
  GRPC: "text-method-grpc",
};

// ── gRPC types ───────────────────────────────────────────────────────

export type GrpcStreamType =
  "unary" | "server_stream" | "client_stream" | "bidi_stream";

export type GrpcCallStatus =
  "idle" | "invoking" | "streaming" | "ok" | "error" | "cancelled";

export interface GrpcMessage {
  id: string;
  direction: "sent" | "received";
  data: string; // JSON-stringified proto message
  timestamp: string;
  statusCode?: string; // gRPC status code label e.g. "OK", "UNAVAILABLE"
  isError?: boolean;
  latencyMs?: number;
}

export interface GrpcMethod {
  name: string;
  fullName: string; // package.ServiceName/MethodName
  requestType: string;
  responseType: string;
  streamType: GrpcStreamType;
}

export interface GrpcService {
  name: string;
  fullName: string;
  methods: GrpcMethod[];
}

export interface GrpcMetadataRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}
