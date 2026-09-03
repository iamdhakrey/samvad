import React, { useEffect, useRef, useState } from "react";
import {
  Plus,
  Loader2,
  Folder,
  Layers,
} from "lucide-react";
import * as Icons from "lucide-react";
import { FolderNodeItem } from "./FolderNodeItem";
import { RequestItem } from "./RequestItem";
import { useWorkspaceStore } from "../../store/workspaceStore";

export const CollectionsTree: React.FC = () => {
  const {
    activeWorkspaceId,
    collections,
    activeCollectionTree,
    isLoadingCollectionTree,
    fetchCollections,
    createRequest,
    createFolder,
    createWs,
    additionTypes,
    fetchAdditionTypes,
  } = useWorkspaceStore();

  // Action menu & Child Item creation for active collection
  const [activeMenuOpen, setActiveMenuOpen] = useState(false);
  const [addingItem, setAddingItem] = useState<{
    collectionId: string;
    type: "folder" | "request" | "ws" | "grpc" | "graphql";
  } | null>(null);
  const [newItemName, setNewItemName] = useState("");

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

  // Click-outside listener for item creation menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
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

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !addingItem) return;

    if (addingItem.type === "folder") {
      await createFolder(addingItem.collectionId, null, newItemName);
    } else if (addingItem.type === "ws") {
      await createWs(addingItem.collectionId, null, newItemName);
    } else if (addingItem.type === "grpc") {
      await createRequest(addingItem.collectionId, null, newItemName, "GRPC");
    } else if (addingItem.type === "graphql") {
      await createRequest(addingItem.collectionId, null, newItemName, "GRAPHQL");
    } else {
      await createRequest(addingItem.collectionId, null, newItemName, "REST");
    }

    setAddingItem(null);
    setNewItemName("");
  };

  return (
    <div className="mt-2 flex-1 overflow-y-auto flex flex-col">
      {/* ── Active Collection Actions Bar & Tree View ── */}
      <div className="flex-1 flex flex-col">
        {collections.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-text-muted italic flex flex-col items-center gap-2">
            <Layers className="w-6 h-6 text-text-muted/40 mb-1" />
            <span>No collections in this workspace.</span>
            <span className="text-[11px] text-text-muted">
              Use the top bar to create a collection.
            </span>
          </div>
        ) : !activeCollectionTree ? (
          isLoadingCollectionTree ? (
            <div className="flex items-center justify-center py-8 text-xs text-text-muted gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Loading collection...</span>
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-xs text-text-muted italic flex flex-col items-center gap-1">
              <Folder className="w-6 h-6 text-text-muted/40 mb-1" />
              <span>Select a collection from the top bar to view requests.</span>
            </div>
          )
        ) : (
          <div className="flex flex-col flex-1">
            {/* Active Collection Header & Quick Add Bar */}
            <div className="group flex items-center justify-between px-3 py-1.5 mx-1 rounded-md text-xs font-semibold text-text-primary hover:bg-panel/60 transition-colors">
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
