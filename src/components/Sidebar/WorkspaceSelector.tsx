import React, { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  Plus,
  Folder,
  Check,
  Edit2,
  Trash2,
  X,
  Loader2,
} from "lucide-react";
import { useWorkspaceStore } from "../../store/workspaceStore";

export const WorkspaceSelector: React.FC = () => {
  const {
    workspaces,
    activeWorkspaceId,
    isLoading,
    fetchWorkspaces,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    setActiveWorkspace,
    getActiveState,
  } = useWorkspaceStore();

  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setIsCreating(false);
        setEditingId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch the active workspace state from the backend when the component mounts
  useEffect(() => {
    getActiveState();
  }, [getActiveState]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      await createWorkspace(inputValue);
      setInputValue("");
      setIsCreating(false);
    }
  };

  const handleRename = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (inputValue.trim()) {
      await renameWorkspace(id, inputValue);
      setInputValue("");
      setEditingId(null);
    }
  };

  return (
    <div className="relative w-full px-3 py-2" ref={dropdownRef}>
      {/* Active Workspace Selector Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium rounded-md bg-panel border border-border text-text-primary hover:border-primary/60 transition-all duration-200 cursor-pointer"
      >
        <div className="flex items-center gap-2 truncate">
          <Folder className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate">
            {activeWorkspace ? activeWorkspace.name : "Select Workspace..."}
          </span>
          {isLoading && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-text-muted" />
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-text-secondary transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown Menu Overlay */}
      {isOpen && (
        <div className="absolute left-3 right-3 mt-1.5 z-50 rounded-lg bg-panel-raised border border-border shadow-elevated overflow-hidden animate-in fade-in duration-100">
          {/* Scrollable Workspaces List */}
          <div className="max-h-60 overflow-y-auto py-1">
            {workspaces.length === 0 ? (
              <div className="px-3 py-4 text-xs text-center text-text-muted">
                No workspaces found
              </div>
            ) : (
              workspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  className={`group flex items-center justify-between px-3 py-1.5 mx-1 my-0.5 rounded-md text-sm text-text-secondary hover:bg-panel hover:text-text-primary transition-all duration-150 ${workspace.id === activeWorkspaceId
                    ? "bg-panel/40 text-text-primary"
                    : ""
                    }`}
                >
                  {editingId === workspace.id ? (
                    // Inline Edit Form
                    <form
                      onSubmit={(e) => handleRename(e, workspace.id)}
                      className="flex items-center gap-1 w-full"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
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
                        onClick={() => setEditingId(null)}
                        className="p-1 hover:text-error cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    // Selection view Mode
                    <>
                      <button
                        onClick={() => {
                          setActiveWorkspace(workspace.id);
                          setIsOpen(false);
                        }}
                        className="flex items-center gap-2 flex-1 text-left truncate cursor-pointer py-0.5"
                      >
                        {workspace.id === activeWorkspaceId ? (
                          <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                        ) : (
                          <Folder className="w-3.5 h-3.5 text-text-muted shrink-0" />
                        )}
                        <span className="truncate">{workspace.name}</span>
                      </button>

                      {/* Action buttons revealed on item hover */}
                      <div className="opacity-70 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingId(workspace.id);
                            setInputValue(workspace.name);
                          }}
                          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-borderMuted cursor-pointer"
                          title="Rename Workspace"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteWorkspace(workspace.id)}
                          className="p-1 rounded text-text-muted hover:text-error hover:bg-error/10 cursor-pointer"
                          title="Delete Workspace"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="border-t border-borderMuted bg-panel/30 p-1.5">
            {isCreating ? (
              // Inline Workspace Creation Form
              <form
                onSubmit={handleCreate}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  autoFocus
                  placeholder="Workspace Name..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="input-shell w-full py-1 text-xs"
                />
                <button
                  type="submit"
                  className="p-1.5 bg-primary hover:bg-primary-hover text-white rounded-md cursor-pointer transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="p-1.5 bg-panel border border-border text-text-secondary hover:text-text-primary rounded-md cursor-pointer transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              // Add Workspace Open Button
              <button
                onClick={() => {
                  setIsCreating(true);
                  setInputValue("");
                }}
                className="flex items-center justify-center gap-1.5 w-full py-1.5 text-xs font-medium rounded-md text-text-secondary hover:text-text-primary hover:bg-panel border border-dashed border-border transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Create New Workspace
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
