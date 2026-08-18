import React, { useEffect, useRef, useState } from "react";
// import { FolderNodeItem } from "./FolderNodeItem";
// import { RequestItem } from "./RequestItem";
import {
  Plus,
  Trash2,
  Library,
  Edit2,
  Check,
  X,
  FolderPlus,
  FilePlus,
} from "lucide-react";
import { FolderNodeItem } from "./FolderNodeItem";
import { RequestItem } from "./RequestItem";
import { useWorkspaceStore } from "../../store/workspaceStore";

export const CollectionsTree: React.FC = () => {
  const {
    activeWorkspaceId,
    collectionTrees,
    fetchCollections,
    createRequest,
    createCollection,
    renameCollection,
    deleteCollection,
    createFolder,
    createWs,
  } = useWorkspaceStore();

  const [isAddingCollection, setIsAddingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  // const [inputValue, setInputValue] = useState("");
  const [editValue, setEditValue] = useState("");

  // Dropdown & Child Item States
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [addingItem, setAddingItem] = useState<{
    collectionId: string;
    type: "folder" | "request" | "ws" | "grpc";
  } | null>(null);
  const [newItemName, setNewItemName] = useState("");

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeWorkspaceId) {
      fetchCollections();
    }
  }, [activeWorkspaceId, fetchCollections]);

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    await createCollection(newCollectionName);
    setNewCollectionName("");
    setIsAddingCollection(false);
  };

  const handleRenameCollection = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (editValue.trim()) {
      await renameCollection(id, editValue);
      setEditValue("");
      setEditingId(null);
    }
  };

  // Click-outside listener for the dropdown menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !addingItem) return;

    if (addingItem.type === "folder") {
      // null as parentFolderId since it's at the collection root
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

  return (
    <div className="mt-2 flex-1 overflow-y-auto">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-3 mb-2 group">
        <div className="text-[11px] font-semibold tracking-wider text-text-muted">
          COLLECTIONS
        </div>
        <button
          onClick={() => setIsAddingCollection(true)}
          className="opacity-70 group-hover:opacity-100 p-1 rounded text-text-muted hover:text-text-primary hover:bg-panel transition-all cursor-pointer"
          title="New Collection"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Inline Create Collection Form */}
      {isAddingCollection && (
        <form
          onSubmit={handleCreateCollection}
          className="px-3 mb-2 flex gap-1"
        >
          <input
            autoFocus
            type="text"
            placeholder="Collection name..."
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            onBlur={() => setIsAddingCollection(false)}
            className="input-shell w-full py-1 text-xs"
          />
        </form>
      )}

      {/* Tree Data */}
      <div className="flex flex-col gap-3 pb-4">
        {collectionTrees.length === 0 && !isAddingCollection ? (
          <div className="px-3 text-xs text-text-muted italic">
            No collections found.
          </div>
        ) : (
          collectionTrees.map((tree) => (
            <div key={tree.collection.id}>
              {editingId === tree.collection.id ? (
                // Inline Edit Form
                <form
                  onSubmit={(e) =>
                    handleRenameCollection(e, tree.collection.id)
                  }
                  className="flex items-center gap-1 w-full px-2"
                >
                  <input
                    type="text"
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
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
                // Collection View Mode
                <div className="group relative flex items-center justify-between px-2 py-1 mx-1 rounded-md text-sm font-semibold text-text-primary hover:bg-panel transition-colors">
                  <div className="flex items-center gap-1.5 truncate">
                    <Library className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate">{tree.collection.name}</span>
                  </div>

                  {/* Hover Actions */}
                  <div className="opacity-70 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                    {/* Add Item Dropdown Trigger */}
                    <div className="relative">
                      <button
                        onClick={() => setActiveMenuId(tree.collection.id)}
                        className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-borderMuted cursor-pointer"
                        title="Add..."
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>

                      {/* Dropdown Menu */}
                      {activeMenuId === tree.collection.id && (
                        <div
                          ref={menuRef}
                          className="absolute right-0 top-full mt-1 w-36 py-1 z-50 bg-panel-raised border border-border shadow-elevated rounded-md animate-in fade-in zoom-in-95 duration-100"
                        >
                          <button
                            onClick={() => {
                              setAddingItem({
                                collectionId: tree.collection.id,
                                type: "request",
                              });
                              setActiveMenuId(null);
                            }}
                            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary hover:bg-panel hover:text-text-primary transition-colors cursor-pointer"
                          >
                            <FilePlus className="w-3.5 h-3.5" />
                            Add Request
                          </button>
                          <button
                            onClick={() => {
                              setAddingItem({
                                collectionId: tree.collection.id,
                                type: "ws",
                              });
                              setActiveMenuId(null);
                            }}
                            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary hover:bg-panel hover:text-text-primary transition-colors cursor-pointer"
                          >
                            <FilePlus className="w-3.5 h-3.5" />
                            Add WebSocket
                          </button>
                          <button
                            onClick={() => {
                              setAddingItem({
                                collectionId: tree.collection.id,
                                type: "folder",
                              });
                              setActiveMenuId(null);
                            }}
                            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary hover:bg-panel hover:text-text-primary transition-colors cursor-pointer"
                          >
                            <FolderPlus className="w-3.5 h-3.5" />
                            Add Folder
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setEditingId(tree.collection.id);
                        setEditValue(tree.collection.name);
                      }}
                      className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-borderMuted cursor-pointer"
                      title="Rename Collection"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => deleteCollection(tree.collection.id)}
                      className="p-1 rounded text-text-muted hover:text-error hover:bg-error/10 cursor-pointer"
                      title="Delete Collection"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Inline Create Form for Child Items (Requests/Folders) */}
              {addingItem?.collectionId === tree.collection.id && (
                <form
                  onSubmit={handleCreateItem}
                  className="pl-6 pr-2 py-1 flex gap-1 mt-1"
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

              {/* Folders in Root */}
              <div className="flex flex-col gap-0.5 mt-0.5">
                {tree.folders.map((folderNode) => (
                  <FolderNodeItem
                    key={folderNode.folder.id}
                    node={folderNode}
                  />
                ))}

                {/* Requests in Root */}
                {tree.requests.map((req) => (
                  <div key={req.id} className="pl-4">
                    <RequestItem request={req} />
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
