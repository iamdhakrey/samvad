import React, { useEffect, useState, useRef } from "react";
import { useVartaStore } from "../store/vartaStore";
import { useWorkspaceStore } from "../store/workspaceStore";
import { X, Save, Folder, ChevronDown } from "lucide-react";

interface NewRequestSaveModalProps {
  isMobile?: boolean;
}

export const NewReqSaveModal: React.FC<NewRequestSaveModalProps> = ({
  isMobile = false,
}) => {
  const isNewReqSaveOpen = useVartaStore((s) => s.isNewReqSaveOpen);
  const closeNewReqSave = useVartaStore((s) => s.closeNewReqSave);
  const saveActiveRequest = useVartaStore((s) => s.saveActiveRequest);
  const activeTab = useVartaStore((s) => s.activeTab);

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const collections = useWorkspaceStore((s) => s.collections);
  const activeCollectionId = useWorkspaceStore((s) => s.activeCollectionId);
  const setActiveCollection = useWorkspaceStore((s) => s.setActiveCollection);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");

  useEffect(() => {
    if (activeCollectionId && !selectedCollectionId) {
      setSelectedCollectionId(activeCollectionId);
    }
  }, [activeCollectionId, selectedCollectionId]);

  // Handle Escape key and Outside Click to close dropdown/modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isOpen) {
          setIsOpen(false);
        } else if (isNewReqSaveOpen) {
          closeNewReqSave();
        }
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isNewReqSaveOpen, closeNewReqSave, isOpen]);

  if (!isNewReqSaveOpen) return null;

  const handleSave = async () => {
    if (!selectedCollectionId) return;
    if (activeTab?.request.id.startsWith("new-")) {
      activeTab.request.collectionId = selectedCollectionId;
      saveActiveRequest();
      if (selectedCollectionId !== activeCollectionId) {
        await setActiveCollection(selectedCollectionId);
      }
    }

    closeNewReqSave();
  };

  // Find the selected collection name for the custom dropdown button
  const selectedCollection = collections.find(
    (c) => c.id === selectedCollectionId,
  );
  const displayLabel = selectedCollection
    ? selectedCollection.name
    : "Select Collection...";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={closeNewReqSave}
    >
      <div
        className={`relative flex flex-col overflow-visible rounded-md border border-border bg-bg shadow-elevated animate-in zoom-in-95 duration-200 ${
          isMobile ? "w-[95vw] h-[50vh]" : "w-[90vw] max-w-lg min-h-[30vh]"
        }`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border bg-panel rounded-t-md">
          <h3 className="font-semibold text-text-primary">Save Request</h3>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!selectedCollectionId}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-all ${
                selectedCollectionId
                  ? "bg-primary text-white hover:bg-primary-hover shadow-panel"
                  : "bg-panel text-text-muted opacity-50 cursor-default border border-border"
              }`}
            >
              <Save size={16} />
              Save
            </button>
            <button
              onClick={closeNewReqSave}
              className="rounded-md p-1.5 text-text-muted hover:bg-error/20 hover:text-error transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 p-6 flex flex-col bg-bg rounded-b-md overflow-visible">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-primary">
              Collection
            </label>

            {collections.length === 0 ? (
              <div className="p-4 border border-border rounded-md bg-panel text-center text-sm text-text-muted flex items-center justify-center">
                No collections available in this workspace.
              </div>
            ) : (
              <div className="relative" ref={dropdownRef}>
                {/* Custom Select Button */}
                <button
                  onClick={() => setIsOpen(!isOpen)}
                  className={`flex items-center justify-between w-full px-3 py-2.5 text-sm font-medium rounded-md bg-panel border transition-all duration-200 cursor-pointer ${
                    isOpen
                      ? "border-primary/60 ring-1 ring-primary/60"
                      : "border-border hover:border-primary/40"
                  } ${selectedCollectionId ? "text-text-primary" : "text-text-muted"}`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Folder
                      className={`w-4 h-4 shrink-0 ${selectedCollectionId ? "text-primary" : "text-text-muted"}`}
                    />
                    <span className="truncate">{displayLabel}</span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-text-secondary transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Custom Select Dropdown Menu */}
                {isOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-lg bg-panel-raised border border-border shadow-elevated overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="max-h-60 overflow-y-auto py-1">
                      {collections.map((collection) => (
                        <button
                          key={collection.id}
                          onClick={() => {
                            setSelectedCollectionId(collection.id);
                            setIsOpen(false);
                          }}
                          className={`flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-panel hover:text-text-primary transition-colors cursor-pointer ${
                            collection.id === selectedCollectionId
                              ? "text-text-primary bg-panel/60 font-medium"
                              : "text-text-secondary"
                          }`}
                        >
                          <Folder className="w-4 h-4 shrink-0" />
                          <span className="truncate">{collection.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
