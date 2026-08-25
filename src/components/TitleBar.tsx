import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Search,
  Minus,
  Square,
  Copy,
  X,
  ChevronRight,
  ChevronDown,
  Layers,
  Library,
  Plus,
  Edit2,
  Trash2,
  Check,
  Loader2,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useVartaStore } from "../store/vartaStore";
import { useWorkspaceStore } from "../store/workspaceStore";
import { UserProfileMenu } from "./UserProfileMenu";

const appWindow = getCurrentWindow();
const isMac =
  typeof navigator !== "undefined" &&
  navigator.platform.toUpperCase().indexOf("MAC") >= 0;

export default function Titlebar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const activeTab = useVartaStore((s) => s.activeTab);
  const toggleCommandPalette = useVartaStore((s) => s.toggleCommandPalette);

  // Store states
  const {
    workspaces,
    activeWorkspaceId,
    fetchWorkspaces,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    setActiveWorkspace,
    getActiveState,
    collections,
    activeCollectionId,
    fetchCollections,
    setActiveCollection,
    createCollection,
    renameCollection,
    deleteCollection,
    isLoadingCollections,
  } = useWorkspaceStore();

  // Workspace Dropdown States
  const [isWsOpen, setIsWsOpen] = useState(false);
  const [isCreatingWs, setIsCreatingWs] = useState(false);
  const [editingWsId, setEditingWsId] = useState<string | null>(null);
  const [wsInputValue, setWsInputValue] = useState("");
  const wsDropdownRef = useRef<HTMLDivElement>(null);

  // Collection Dropdown States
  const [isColOpen, setIsColOpen] = useState(false);
  const [isCreatingCol, setIsCreatingCol] = useState(false);
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [colInputValue, setColInputValue] = useState("");
  const colDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchWorkspaces();
    getActiveState();
  }, [fetchWorkspaces, getActiveState]);

  useEffect(() => {
    if (activeWorkspaceId) {
      fetchCollections();
    }
  }, [activeWorkspaceId, fetchCollections]);

  useEffect(() => {
    const unlisten = appWindow.onResized(async () => {
      setIsMaximized(await appWindow.isMaximized());
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wsDropdownRef.current &&
        !wsDropdownRef.current.contains(event.target as Node)
      ) {
        setIsWsOpen(false);
        setIsCreatingWs(false);
        setEditingWsId(null);
      }
      if (
        colDropdownRef.current &&
        !colDropdownRef.current.contains(event.target as Node)
      ) {
        setIsColOpen(false);
        setIsCreatingCol(false);
        setEditingColId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const activeCollection = collections.find((c) => c.id === activeCollectionId);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (wsInputValue.trim()) {
      await createWorkspace(wsInputValue.trim());
      setWsInputValue("");
      setIsCreatingWs(false);
    }
  };

  const handleRenameWorkspace = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (wsInputValue.trim()) {
      await renameWorkspace(id, wsInputValue.trim());
      setWsInputValue("");
      setEditingWsId(null);
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (colInputValue.trim()) {
      await createCollection(colInputValue.trim());
      setColInputValue("");
      setIsCreatingCol(false);
    }
  };

  const handleRenameCollection = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (colInputValue.trim()) {
      await renameCollection(id, colInputValue.trim());
      setColInputValue("");
      setEditingColId(null);
    }
  };

  return (
    <header
      data-tauri-drag-region
      className={`relative z-50 flex h-10 w-full select-none items-center justify-between border-b border-border/40 bg-panel/85 px-3 backdrop-blur-md ${
        isMac ? "pl-[78px]" : "pl-3"
      }`}
    >
      {/* ── Left Section: Workspace & Collection Selector Breadcrumb ── */}
      <div className="flex items-center gap-1.5" data-tauri-drag-region>
        {!isMac && (
          <img
            src="/icon.png"
            alt="Samvad"
            className="h-4 w-4 object-contain mr-1.5"
          />
        )}

        {/* 1. Workspace Selector Popover */}
        <div className="relative" ref={wsDropdownRef}>
          <button
            onClick={() => {
              setIsWsOpen(!isWsOpen);
              setIsColOpen(false);
            }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-panel transition-colors cursor-pointer"
            title="Switch Workspace"
          >
            <Layers className="w-3.5 h-3.5 text-primary/90 shrink-0" />
            <span className="truncate max-w-[110px]">
              {activeWorkspace?.name || "Workspace"}
            </span>
            <ChevronDown
              className={`w-3 h-3 text-text-muted transition-transform duration-150 ${
                isWsOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {isWsOpen && (
            <div className="absolute left-0 top-full mt-1 w-56 z-50 rounded-lg bg-panel-raised border border-border shadow-elevated overflow-hidden animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2.5 py-1.5 text-[11px] font-semibold text-text-muted border-b border-border/40 uppercase tracking-wider">
                Workspaces
              </div>
              <div className="max-h-56 overflow-y-auto py-1">
                {workspaces.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-center text-text-muted">
                    No workspaces found
                  </div>
                ) : (
                  workspaces.map((ws) => (
                    <div
                      key={ws.id}
                      className={`group flex items-center justify-between px-2.5 py-1.5 mx-1 my-0.5 rounded-md text-xs text-text-secondary hover:bg-panel hover:text-text-primary transition-all duration-150 ${
                        ws.id === activeWorkspaceId
                          ? "bg-panel/60 text-text-primary font-medium"
                          : ""
                      }`}
                    >
                      {editingWsId === ws.id ? (
                        <form
                          onSubmit={(e) => handleRenameWorkspace(e, ws.id)}
                          className="flex items-center gap-1 w-full"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            autoFocus
                            value={wsInputValue}
                            onChange={(e) => setWsInputValue(e.target.value)}
                            className="input-shell w-full py-0.5 px-2 text-xs"
                          />
                          <button
                            type="submit"
                            className="p-1 hover:text-success cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingWsId(null)}
                            className="p-1 hover:text-error cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setActiveWorkspace(ws.id);
                              setIsWsOpen(false);
                            }}
                            className="flex items-center gap-2 flex-1 text-left truncate cursor-pointer py-0.5"
                          >
                            {ws.id === activeWorkspaceId ? (
                              <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                            ) : (
                              <Layers className="w-3.5 h-3.5 text-text-muted shrink-0" />
                            )}
                            <span className="truncate">{ws.name}</span>
                          </button>

                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingWsId(ws.id);
                                setWsInputValue(ws.name);
                              }}
                              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-borderMuted cursor-pointer"
                              title="Rename Workspace"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteWorkspace(ws.id);
                              }}
                              className="p-1 rounded text-text-muted hover:text-error hover:bg-error/10 cursor-pointer"
                              title="Delete Workspace"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Add Workspace Form */}
              <div className="border-t border-border/40 bg-panel/40 p-1.5">
                {isCreatingWs ? (
                  <form
                    onSubmit={handleCreateWorkspace}
                    className="flex items-center gap-1"
                  >
                    <input
                      type="text"
                      autoFocus
                      placeholder="Workspace name..."
                      value={wsInputValue}
                      onChange={(e) => setWsInputValue(e.target.value)}
                      className="input-shell w-full py-0.5 px-2 text-xs"
                    />
                    <button
                      type="submit"
                      className="p-1 bg-primary hover:bg-primary-hover text-white rounded cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreatingWs(false)}
                      className="p-1 bg-panel border border-border text-text-secondary hover:text-text-primary rounded cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => {
                      setIsCreatingWs(true);
                      setWsInputValue("");
                    }}
                    className="flex items-center justify-center gap-1.5 w-full py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-panel rounded border border-dashed border-border transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Create Workspace
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Separator */}
        <ChevronRight className="w-3 h-3 text-text-muted/50 shrink-0" />

        {/* 2. Collection Selector Popover */}
        <div className="relative" ref={colDropdownRef}>
          <button
            onClick={() => {
              setIsColOpen(!isColOpen);
              setIsWsOpen(false);
            }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-panel transition-colors cursor-pointer"
            title="Switch Collection"
          >
            <Library className="w-3.5 h-3.5 text-primary/80 shrink-0" />
            <span className="truncate max-w-[120px]">
              {activeCollection?.name ||
                (collections.length === 0
                  ? "No Collections"
                  : "Select Collection")}
            </span>
            {isLoadingCollections ? (
              <Loader2 className="w-3 h-3 animate-spin text-text-muted shrink-0" />
            ) : (
              <ChevronDown
                className={`w-3 h-3 text-text-muted transition-transform duration-150 ${
                  isColOpen ? "rotate-180" : ""
                }`}
              />
            )}
          </button>

          {isColOpen && (
            <div className="absolute left-0 top-full mt-1 w-56 z-50 rounded-lg bg-panel-raised border border-border shadow-elevated overflow-hidden animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2.5 py-1.5 text-[11px] font-semibold text-text-muted border-b border-border/40 uppercase tracking-wider">
                Collections
              </div>
              <div className="max-h-56 overflow-y-auto py-1">
                {collections.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-center text-text-muted">
                    No collections in this workspace
                  </div>
                ) : (
                  collections.map((col) => (
                    <div
                      key={col.id}
                      className={`group flex items-center justify-between px-2.5 py-1.5 mx-1 my-0.5 rounded-md text-xs text-text-secondary hover:bg-panel hover:text-text-primary transition-all duration-150 ${
                        col.id === activeCollectionId
                          ? "bg-panel/60 text-text-primary font-medium"
                          : ""
                      }`}
                    >
                      {editingColId === col.id ? (
                        <form
                          onSubmit={(e) => handleRenameCollection(e, col.id)}
                          className="flex items-center gap-1 w-full"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            autoFocus
                            value={colInputValue}
                            onChange={(e) => setColInputValue(e.target.value)}
                            className="input-shell w-full py-0.5 px-2 text-xs"
                          />
                          <button
                            type="submit"
                            className="p-1 hover:text-success cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingColId(null)}
                            className="p-1 hover:text-error cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setActiveCollection(col.id);
                              setIsColOpen(false);
                            }}
                            className="flex items-center gap-2 flex-1 text-left truncate cursor-pointer py-0.5"
                          >
                            {col.id === activeCollectionId ? (
                              <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                            ) : (
                              <Library className="w-3.5 h-3.5 text-text-muted shrink-0" />
                            )}
                            <span className="truncate">{col.name}</span>
                          </button>

                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingColId(col.id);
                                setColInputValue(col.name);
                              }}
                              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-borderMuted cursor-pointer"
                              title="Rename Collection"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteCollection(col.id);
                              }}
                              className="p-1 rounded text-text-muted hover:text-error hover:bg-error/10 cursor-pointer"
                              title="Delete Collection"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Add Collection Form */}
              <div className="border-t border-border/40 bg-panel/40 p-1.5">
                {isCreatingCol ? (
                  <form
                    onSubmit={handleCreateCollection}
                    className="flex items-center gap-1"
                  >
                    <input
                      type="text"
                      autoFocus
                      placeholder="Collection name..."
                      value={colInputValue}
                      onChange={(e) => setColInputValue(e.target.value)}
                      className="input-shell w-full py-0.5 px-2 text-xs"
                    />
                    <button
                      type="submit"
                      className="p-1 bg-primary hover:bg-primary-hover text-white rounded cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreatingCol(false)}
                      className="p-1 bg-panel border border-border text-text-secondary hover:text-text-primary rounded cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => {
                      setIsCreatingCol(true);
                      setColInputValue("");
                    }}
                    className="flex items-center justify-center gap-1.5 w-full py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-panel rounded border border-dashed border-border transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Create Collection
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Center Section: Antigravity Command Pill ── */}
      <div
        className="flex flex-1 justify-center max-w-md px-4"
        data-tauri-drag-region
      >
        <button
          onClick={() => toggleCommandPalette(true)}
          className="group flex w-full items-center justify-between gap-2 rounded-md border border-border/50 bg-bg/60 px-3 py-1 text-xs text-text-muted transition-all duration-150 hover:border-primary/50 hover:bg-panel hover:text-text-primary hover:shadow-sm cursor-pointer"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="h-3.5 w-3.5 text-text-muted group-hover:text-primary transition-colors" />
            <span className="truncate font-normal">
              {activeTab?.request.name ? (
                <span className="flex items-center gap-1.5">
                  <span className="font-semibold text-primary">
                    {activeTab.request.method}
                  </span>
                  <span className="text-text-secondary">
                    {activeTab.request.name}
                  </span>
                </span>
              ) : (
                "Search requests, commands, or tools..."
              )}
            </span>
          </div>

          <kbd className="pointer-events-none inline-flex h-4 select-none items-center gap-0.5 rounded border border-border bg-panel px-1.5 font-mono text-[10px] font-medium text-text-muted">
            <span className="text-[11px]">{isMac ? "⌘" : "Ctrl+"}</span>K
          </kbd>
        </button>
      </div>

      {/* ── Right Section: User Profile, Status Pill & Window Controls (Windows/Linux) ── */}
      <div className="flex items-center gap-2" data-tauri-drag-region>
        {/* User Login / Profile Menu */}
        <UserProfileMenu />

        {/* Divider */}
        <div className="h-3.5 w-px bg-border/40" />

        {/* Status Dot */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 font-medium pointer-events-none">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Ready</span>
        </div>

        {/* Windows / Linux Controls */}
        {!isMac && (
          <div className="flex items-center ml-1 text-text-secondary">
            <button
              onClick={() => appWindow.minimize()}
              className="flex h-7 w-8 items-center justify-center rounded hover:bg-panel-raised hover:text-text-primary transition-colors cursor-pointer"
              title="Minimize"
            >
              <Minus size={14} />
            </button>
            <button
              onClick={() => appWindow.toggleMaximize()}
              className="flex h-7 w-8 items-center justify-center rounded hover:bg-panel-raised hover:text-text-primary transition-colors cursor-pointer"
              title={isMaximized ? "Restore" : "Maximize"}
            >
              {isMaximized ? (
                <Copy size={12} className="rotate-180" />
              ) : (
                <Square size={12} />
              )}
            </button>
            <button
              onClick={() => appWindow.close()}
              className="flex h-7 w-8 items-center justify-center rounded hover:bg-error/20 hover:text-error transition-colors cursor-pointer"
              title="Close"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
