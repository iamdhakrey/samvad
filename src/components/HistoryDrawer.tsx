import { X } from "lucide-react";
import { useVartaStore } from "../store/vartaStore";
import { MethodStyles } from "../types";
import { useEffect } from "react";
// import { HttpMethod } from "../types";



function statusColor(status: number) {
  if (status >= 200 && status < 300) return "text-success";
  if (status >= 400) return "text-error";
  return "text-warning";
}

interface HistoryDrawerProps {
  isMobile?: boolean;
}

export default function HistoryDrawer({
  isMobile = false,
}: HistoryDrawerProps) {
  const isOpen = useVartaStore((s) => s.isHistoryOpen);
  const toggle = useVartaStore((s) => s.toggleHistory);
  const historyEntries = useVartaStore((s) => s.historyEntries);
  const fetchHistory = useVartaStore((s) => s.fetchHistory);
  // const clearHistory = useVartaStore((s) => s.clearHistory);
  const deleteHistoryEntry = useVartaStore((s) => s.deleteHistoryEntry);
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  if (!isOpen) return null;

  // ── Mobile: full-screen overlay ──
  if (isMobile) {
    return (
      <div
        className="fixed inset-0 z-40 flex animate-backdrop-in"
        onClick={() => toggle(false)}
      >
        <div className="absolute inset-0 bg-black/60" />
        <div
          className="relative z-10 flex h-full w-full flex-col bg-panel animate-sidebar-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-medium text-text-primary">
              History
            </span>
            <button
              onClick={() => toggle(false)}
              aria-label="Close history"
              className="text-text-secondary hover:text-text-primary p-1"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {historyEntries.map((h) => (
              <button
                key={h.requestid}
                className="flex w-full flex-col gap-1 border-b border-borderMuted px-4 py-2.5 text-left hover:bg-panel-raised"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-semibold ${MethodStyles[h.method]}`}
                  >
                    {h.method}
                  </span>
                  <span className="truncate text-sm text-text-primary">
                    {h.name}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-text-muted">
                  <span className={statusColor(h.status)}>{h.status}</span>
                  <span>{h.timestamp}</span>
                  <span>{h.durationMs} ms</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Desktop: side panel ──
  return (
    <div className="absolute inset-y-0 right-0 z-40 flex w-[320px] flex-col border-l border-border bg-panel shadow-elevated">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-medium text-text-primary">History</span>
        <button
          onClick={() => toggle(false)}
          aria-label="Close history"
          className="text-text-secondary hover:text-text-primary"
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {historyEntries.map((h) => (
          <div
            key={h.requestid}
            className="flex w-full flex-col gap-1 border-b border-borderMuted px-4 py-2.5 text-left hover:bg-panel-raised"
          >
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-semibold ${MethodStyles[h.method]}`}
              >
                {h.method}
              </span>
              <span className="truncate text-sm text-text-primary">
                {h.name}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteHistoryEntry(h.id);
                }}
                className="ml-auto text-text-secondary hover:text-text-primary"
                aria-label="Delete history entry"
              >
                <X size={12} />
              </button>
            </div>
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span className={statusColor(h.status)}>{h.status}</span>
              <span className="truncate">{h.url}</span>
              {/*<span>{h.timestamp}</span>*/}
              <span>{h.durationMs} ms</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
