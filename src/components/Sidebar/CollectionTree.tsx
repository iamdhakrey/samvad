import React, { useEffect, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Library,
  Edit2,
  Check,
  X,
  ChevronDown,
  Loader2,
  Folder,
} from "lucide-react";
import * as Icons from "lucide-react";
import { FolderNodeItem } from "./FolderNodeItem";
import { RequestItem } from "./RequestItem";
import { useWorkspaceStore } from "../../store/workspaceStore";

export const CollectionsTree: React.FC = () => {
  const {
    activeWorkspaceId,
    collections,
    activeCollectionId,
    activeCollectionTree,
    isLoadingCollections,
    isLoadingCollectionTree,
    fetchCollections,
    setActiveCollection,
    createCollection,
    renameCollection,
    deleteCollection,
    createRequest,
    createFolder,
    createWs,
    additionTypes,
    fetchAdditionTypes,
  } = useWorkspaceStore();

  // Dropdown states for Collection Selector
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(
    null,
  );
  const [editCollectionName, setEditCollectionName] = useState("");

  // Action menu & Child Item creation for active collection
  const [activeMenuOpen, setActiveMenuOpen] = useState(false);
  const [addingItem, setAddingItem] = useState<{
    collectionId: string;
    type: "folder" | "request" | "ws" | "grpc";
  } | null>(null);
  const [newItemName, setNewItemName] = useState("");

  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch collections when the active workspace changes
  useEffect(() => {
    if (activeWorkspaceId) {
      fetchCollections();
    }
  }, [activeWorkspaceId, fetchCollections]);

  // Fetch addition types on mount
  useEffect(() => {
    fetchAdditionTypes();
  }, [fetchAdditionTypes]);

  // Click-outside listener for Collection Selector dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
        setIsCreatingCollection(false);
        setEditingCollectionId(null);
      }
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setActiveMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newCollectionName.trim()) {
      await createCollection(newCollectionName);
      setNewCollectionName("");
      setIsCreatingCollection(false);
      setIsDropdownOpen(false);
    }
  };

  const handleRenameCollection = async (
    e: React.FormEvent,
    collectionId: string,
  ) => {
    e.preventDefault();
    if (editCollectionName.trim()) {
      await renameCollection(collectionId, editCollectionName);
      setEditCollectionName("");
      setEditingCollectionId(null);
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !addingItem) return;

    if (addingItem.type === "folder") {
      await createFolder(addingItem.collectionId, null, newItemName);
    } else if (addingItem.type === "ws") {
      await createWs(addingItem.collectionId, null, newItemName);
    } else if (addingItem.type === "grpc") {
      await createRequest(addingItem.collectionId, null, newItemName, "GRPC");
    } else {
      await createRequest(addingItem.collectionId, null, newItemName, "REST");
    }

    setAddingItem(null);
    setNewItemName("");
  };

  const activeCollection = collections.find((c) => c.id === activeCollectionId);

  return (
    <div className="mt-2 flex-1 overflow-y-auto flex flex-col">

      {/* ── Collection Selector Dropdown ── */}
      <div className="relative px-3 mb-2" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center justify-between w-full px-2.5 py-1.5 text-xs font-medium rounded-md bg-panel border border-border text-text-primary hover:border-primary/60 transition-all duration-200 cursor-pointer"
        >
          <div className="flex items-center gap-2 truncate">
            <Library className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate">
              {activeCollection
                ? activeCollection.name
                : collections.length === 0
                  ? "No Collections"
                  : "Select Collection..."}
            </span>
            {(isLoadingCollections || isLoadingCollectionTree) && (
              <Loader2 className="w-3 h-3 animate-spin text-text-muted shrink-0" />
            )}
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-text-secondary transition-transform duration-200 shrink-0 ${isDropdownOpen ? "rotate-180" : ""
              }`}
          />
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div className="absolute left-3 right-3 mt-1 z-50 rounded-lg bg-panel-raised border border-border shadow-elevated overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            {/* Collection Items */}
            <div className="max-h-56 overflow-y-auto py-1">
              {collections.length === 0 ? (
                <div className="px-3 py-3 text-xs text-center text-text-muted">
                  No collections found
                </div>
              ) : (
                collections.map((col) => (
                  <div
                    key={col.id}
                    className={`group flex items-center justify-between px-2.5 py-1.5 mx-1 my-0.5 rounded-md text-xs text-text-secondary hover:bg-panel hover:text-text-primary transition-all duration-150 ${col.id === activeCollectionId
                      ? "bg-panel/50 text-text-primary font-medium"
                      : ""
                      }`}
                  >
                    {editingCollectionId === col.id ? (
                      // Inline Rename Form
                      <form
                        onSubmit={(e) => handleRenameCollection(e, col.id)}
                        className="flex items-center gap-1 w-full"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          autoFocus
                          value={editCollectionName}
                          onChange={(e) =>
                            setEditCollectionName(e.target.value)
                          }
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
                          onClick={() => setEditingCollectionId(null)}
                          className="p-1 hover:text-error cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    ) : (
                      // Display Row
                      <>
                        <button
                          onClick={() => {
                            setActiveCollection(col.id);
                            setIsDropdownOpen(false);
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

                        <div className="opacity-70 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCollectionId(col.id);
                              setEditCollectionName(col.name);
                            }}
                            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-borderMuted cursor-pointer"
                            title="Rename Collection"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteCollection(col.id);
                            }}
                            className="p-1 rounded text-text-muted hover:text-error hover:bg-error/10 cursor-pointer"
                            title="Delete Collection"
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

            {/* Bottom Actions: Inline Create */}
            <div className="border-t border-borderMuted bg-panel/30 p-1.5">
              {isCreatingCollection ? (
                <form
                  onSubmit={handleCreateCollection}
                  className="flex items-center gap-1.5"
                >
                  <input
                    type="text"
                    autoFocus
                    placeholder="Collection name..."
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
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
                    onClick={() => setIsCreatingCollection(false)}
                    className="p-1.5 bg-panel border border-border text-text-secondary hover:text-text-primary rounded-md cursor-pointer transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => {
                    setIsCreatingCollection(true);
                    setNewCollectionName("");
                  }}
                  className="flex items-center justify-center gap-1.5 w-full py-1.5 text-xs font-medium rounded-md text-text-secondary hover:text-text-primary hover:bg-panel border border-dashed border-border transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create New Collection
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Active Collection Actions Bar & Tree View ── */}
      <div className="flex-1 flex flex-col">
        {collections.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-text-muted italic flex flex-col items-center gap-2">
            <span>No collections in this workspace.</span>
            <button
              onClick={() => {
                setIsDropdownOpen(true);
                setIsCreatingCollection(true);
              }}
              className="text-xs text-primary hover:underline cursor-pointer"
            >
              + Create your first collection
            </button>
          </div>
        ) : !activeCollectionTree ? (
          isLoadingCollectionTree ? (
            <div className="flex items-center justify-center py-8 text-xs text-text-muted gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Loading collection...</span>
            </div>
          ) : (
            <div className="px-3 py-6 text-center text-xs text-text-muted italic">
              Select a collection to view requests.
            </div>
          )
        ) : (
          <div className="flex flex-col flex-1">
            {/* Active Collection Header & Quick Add Bar */}
            <div className="group flex items-center justify-between px-3 py-1 mx-1 rounded-md text-xs font-semibold text-text-primary hover:bg-panel/60 transition-colors">
              <div className="flex items-center gap-1.5 truncate">
                <Folder className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate font-semibold">
                  {activeCollectionTree.collection.name}
                </span>
              </div>

              {/* Add item dropdown menu */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setActiveMenuOpen(!activeMenuOpen)}
                  className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-borderMuted cursor-pointer transition-colors"
                  title="Add to collection..."
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>

                {activeMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-38 py-1 z-50 bg-panel-raised border border-border shadow-elevated rounded-md animate-in fade-in zoom-in-95 duration-100">
                    {additionTypes.map((type) => {
                      const IconComp = (Icons as any)[type.icon] || Icons.FilePlus;
                      return (
                        <button
                          key={type.id}
                          onClick={() => {
                            setAddingItem({
                              collectionId: activeCollectionTree.collection.id,
                              type: type.id as any,
                            });
                            setActiveMenuOpen(false);
                          }}
                          className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary hover:bg-panel hover:text-text-primary transition-colors cursor-pointer"
                        >
                          <IconComp className="w-3.5 h-3.5" />
                          {type.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Inline Create Form for Root Items (Requests / Folders) */}
            {addingItem?.collectionId === activeCollectionTree.collection.id && (
              <form
                onSubmit={handleCreateItem}
                className="pl-5 pr-3 py-1 flex gap-1 mt-1"
              >
                <input
                  autoFocus
                  type="text"
                  placeholder={`New ${addingItem.type} name...`}
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onBlur={() => {
                    if (!newItemName.trim()) setAddingItem(null);
                  }}
                  className="input-shell w-full py-0.5 px-2 text-xs"
                />
              </form>
            )}

            {/* Collection Tree Content */}
            <div className="flex flex-col gap-0.5 pb-4 mt-1">
              {/* Folders in Root */}
              {activeCollectionTree.folders.map((folderNode) => (
                <FolderNodeItem key={folderNode.folder.id} node={folderNode} />
              ))}

              {/* Requests in Root */}
              {activeCollectionTree.requests.map((req) => (
                <div key={req.id} className="pl-4">
                  <RequestItem request={req} />
                </div>
              ))}

              {/* Empty Collection State */}
              {activeCollectionTree.folders.length === 0 &&
                activeCollectionTree.requests.length === 0 &&
                !addingItem && (
                  <div className="px-4 py-4 text-xs text-text-muted italic">
                    Collection is empty. Click + above to add requests or folders.
                  </div>
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
