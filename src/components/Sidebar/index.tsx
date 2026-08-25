import { useEffect } from "react";
import { Settings, X } from "lucide-react";
import { CollectionsTree } from "./CollectionTree";
import { EnvironmentSelector } from "./EnvironmentSelector";
import { useWorkspaceStore } from "../../store/workspaceStore";
import { useSettingsStore } from "../../store/settingStore";

interface SidebarProps {
  isMobile: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isMobile, onClose }: SidebarProps) {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const fetchEnvironments = useWorkspaceStore((s) => s.fetchEnvironments);

  const setSettingsOpen = useSettingsStore((s) => s.setSettingsOpen);

  // Fetch environments when the active workspace changes
  useEffect(() => {
    if (activeWorkspaceId) {
      fetchEnvironments(activeWorkspaceId);
    }
  }, [activeWorkspaceId, fetchEnvironments]);

  const handleSettings = () => {
    setSettingsOpen(true);
    if (isMobile && onClose) onClose();
  };

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-border bg-bg ${isMobile ? "w-[85vw] max-w-[320px]" : "w-70"
        }`}
    >
      {/* Mobile close header */}
      {isMobile && (
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <span className="text-sm font-semibold bg-brand-gradient bg-clip-text text-transparent">
            Samvad
          </span>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-text-secondary hover:bg-panel-raised hover:text-text-primary"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>
      )}


      {/* Collections tree */}
      <CollectionsTree />

      {/* Environment + actions */}
      <div className="border-t border-border p-3">
        {/* <-- Custom Dropdown replaces native select --> */}
        <EnvironmentSelector />
      </div>

      {/* FOOTER - Stacked Buttons */}
      <div className="flex flex-col gap-1 border-t border-border p-2">
        <button
          onClick={handleSettings}
          className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-borderMuted hover:text-text-primary"
        >
          <Settings size={16} />
          Settings
        </button>
      </div>
    </aside>
  );
}
