import { useState } from "react";
import {
  Plus,
  X,
  Save,
  Copy,
  History,
  Settings,
  MoreHorizontal,
} from "lucide-react";
import { MethodStyles } from "../../types";
import { useMobileDetect } from "../../hooks/useMobileDetect";
import { useVartaStore } from "../../store/vartaStore";
import { useSettingsStore } from "../../store/settingStore";
import { HttpMethod } from "@samvad-internal/models";

export default function TabStrip() {
  const isMobile = useMobileDetect();
  const tabs = useVartaStore((s) => s.tabs);
  const activeTabId = useVartaStore((s) => s.activeTabId);
  const setActiveTab = useVartaStore((s) => s.setActiveTab);
  const closeTab = useVartaStore((s) => s.closeTab);
  const newTab = useVartaStore((s) => s.newTab);
  const toggleHistory = useVartaStore((s) => s.toggleHistory);
  const setSettingsOpen = useSettingsStore((s) => s.setSettingsOpen);

  const [showOverflow, setShowOverflow] = useState(false);

  return (
    <div className="flex items-center justify-between border-b border-border bg-panel pr-2">
      <div className="flex items-center overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group flex max-w-45 shrink-0 cursor-pointer items-center gap-2 border-r border-border px-3 py-2.5 text-sm ${
                active
                  ? "bg-bg text-text-primary border-t-2 border-t-primary"
                  : "text-text-secondary border-t-2 border-t-transparent hover:bg-panel-raised"
              }`}
            >
              <span
                className={`text-[10px] font-semibold ${
                  (tab.request as any).type === "grpc"
                    ? "text-method-grpc"
                    : (tab.request as any).type === "graphql"
                    ? "text-method-graphql"
                    : MethodStyles[tab.request.method as HttpMethod] || "text-text-muted"
                }`}
              >
                {(tab.request as any).type === "grpc"
                  ? "gRPC"
                  : (tab.request as any).type === "graphql"
                  ? "GQL"
                  : tab.request.method}
              </span>
              <span className="truncate">
                {tab.request.name}
                {tab.isDirty ? " •" : ""}
              </span>
              <X
                size={12}
                className="ml-auto shrink-0 text-text-muted opacity-70 group-hover:opacity-100 hover:text-text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
              />
            </div>
          );
        })}
        <button
          onClick={newTab}
          className="flex shrink-0 items-center justify-center px-3 py-2.5 text-text-secondary hover:text-text-primary"
          aria-label="New tab"
        >
          <Plus size={15} />
        </button>
      </div>

      {/* Desktop: inline action buttons */}
      {!isMobile && (
        <div className="flex shrink-0 items-center gap-1 pl-2">
          <button
            className="rounded-md p-1.5 text-text-secondary hover:bg-panel-raised hover:text-text-primary"
            aria-label="Save"
          >
            <Save size={15} />
          </button>
          <button
            className="rounded-md p-1.5 text-text-secondary hover:bg-panel-raised hover:text-text-primary"
            aria-label="Duplicate"
          >
            <Copy size={15} />
          </button>
          <button
            onClick={() => toggleHistory()}
            className="rounded-md p-1.5 text-text-secondary hover:bg-panel-raised hover:text-text-primary"
            aria-label="History"
          >
            <History size={15} />
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded-md p-1.5 text-text-secondary hover:bg-panel-raised hover:text-text-primary"
            aria-label="Settings"
          >
            <Settings size={15} />
          </button>
        </div>
      )}

      {/* Mobile: overflow menu */}
      {isMobile && (
        <div className="relative shrink-0 pl-1">
          <button
            onClick={() => setShowOverflow((v) => !v)}
            className="rounded-md p-1.5 text-text-secondary hover:bg-panel-raised hover:text-text-primary"
            aria-label="More actions"
          >
            <MoreHorizontal size={17} />
          </button>
          {showOverflow && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowOverflow(false)}
              />
              <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-md border border-border bg-panel-raised shadow-elevated p-1">
                <button
                  onClick={() => {
                    setShowOverflow(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-text-secondary hover:bg-panel hover:text-text-primary"
                >
                  <Save size={14} /> Save
                </button>
                <button
                  onClick={() => {
                    setShowOverflow(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-text-secondary hover:bg-panel hover:text-text-primary"
                >
                  <Copy size={14} /> Duplicate
                </button>
                <button
                  onClick={() => {
                    toggleHistory();
                    setShowOverflow(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-text-secondary hover:bg-panel hover:text-text-primary"
                >
                  <History size={14} /> History
                </button>
                <button
                  onClick={() => {
                    setSettingsOpen(true);
                    setShowOverflow(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-text-secondary hover:bg-panel hover:text-text-primary"
                >
                  <Settings size={14} /> Settings
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
