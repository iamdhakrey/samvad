
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Editor from "@monaco-editor/react";
import { useVartaStore } from "../../store/vartaStore";
import { GrpcMetadataRow } from "../../types";

type GrpcReqTab = "message" | "metadata";

const TABS: { id: GrpcReqTab; label: string }[] = [
  { id: "message", label: "Message" },
  { id: "metadata", label: "Metadata" },
];

interface GrpcRequestPanelProps {
  isMobile?: boolean;
}

export default function GrpcRequestPanel({ isMobile = false }: GrpcRequestPanelProps) {
  const [activeTab, setActiveTab] = useState<GrpcReqTab>("message");

  const requestBody = useVartaStore((s) => s.grpcRequestBody);
  const setRequestBody = useVartaStore((s) => s.setGrpcRequestBody);
  const metadata = useVartaStore((s) => s.grpcMetadata);
  const setMetadata = useVartaStore((s) => s.setGrpcMetadata);
  const selectedMethod = useVartaStore((s) => s.grpcSelectedMethod);

  return (
    <div className="flex h-full flex-col">
      {/* Sub-tab strip */}
      <div
        className={`flex gap-1 border-b border-border ${
          isMobile ? "overflow-x-auto scrollbar-hide px-2" : "px-4"
        }`}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`tab-trigger shrink-0 ${activeTab === t.id ? "tab-trigger-active" : ""}`}
          >
            {t.label}
            {t.id === "metadata" && metadata.filter((r) => r.key.trim()).length > 0 && (
              <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary">
                {metadata.filter((r) => r.key.trim()).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "message" && (
          <div className="flex h-full flex-col">
            {/* Type hint */}
            {selectedMethod && (
              <div className={`flex items-center gap-2 border-b border-borderMuted ${isMobile ? "px-3 py-1.5" : "px-4 py-1.5"}`}>
                <span className="text-[10px] font-mono text-text-muted">
                  Request type:{" "}
                  <span className="text-method-grpc">{selectedMethod.requestType}</span>
                </span>
              </div>
            )}

            {/* Monaco Editor */}
            <div className="flex-1 min-h-0">
              <Editor
                height="100%"
                defaultLanguage="json"
                value={requestBody}
                onChange={(value) => setRequestBody(value ?? "")}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 12.5,
                  fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  wordWrap: "on",
                  padding: { top: 8 },
                  renderLineHighlight: "none",
                  overviewRulerLanes: 0,
                  hideCursorInOverviewRuler: true,
                  scrollbar: {
                    verticalScrollbarSize: 8,
                    horizontalScrollbarSize: 8,
                  },
                }}
              />
            </div>
          </div>
        )}

        {activeTab === "metadata" && (
          <MetadataTable
            rows={metadata}
            onChange={setMetadata}
            isMobile={isMobile}
          />
        )}
      </div>
    </div>
  );
}

// ── Metadata Key-Value Table ────────────────────────────────────────────

function MetadataTable({
  rows,
  onChange,
  isMobile,
}: {
  rows: GrpcMetadataRow[];
  onChange: (rows: GrpcMetadataRow[]) => void;
  isMobile: boolean;
}) {
  function update(id: string, patch: Partial<GrpcMetadataRow>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    onChange([
      ...rows,
      { id: crypto.randomUUID(), key: "", value: "", enabled: true },
    ]);
  }

  function removeRow(id: string) {
    onChange(rows.filter((r) => r.id !== id));
  }

  // Mobile: stacked cards
  if (isMobile) {
    return (
      <div className="px-3 py-2.5 overflow-y-auto">
        {rows.map((row) => (
          <div
            key={row.id}
            className="mb-2 rounded-md border border-border bg-panel p-2.5"
          >
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 text-xs text-text-muted">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={(e) => update(row.id, { enabled: e.target.checked })}
                  className="h-3.5 w-3.5 accent-primary"
                />
                Enabled
              </label>
              <button
                onClick={() => removeRow(row.id)}
                aria-label="Remove row"
                className="text-text-muted hover:text-error p-1"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <input
              value={row.key}
              onChange={(e) => update(row.id, { key: e.target.value })}
              placeholder="Metadata key"
              className="mb-1.5 w-full rounded-md border border-border bg-bg px-2.5 py-1.5 font-mono text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-primary"
            />
            <input
              value={row.value}
              onChange={(e) => update(row.id, { value: e.target.value })}
              placeholder="Value"
              className="w-full rounded-md border border-border bg-bg px-2.5 py-1.5 font-mono text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-primary"
            />
          </div>
        ))}
        <button
          onClick={addRow}
          className="mt-1 flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
        >
          <Plus size={13} />
          Add metadata
        </button>
      </div>
    );
  }

  // Desktop: grid table
  return (
    <div className="px-4 py-3 overflow-y-auto">
      <div className="grid grid-cols-[24px_1fr_1fr_28px] gap-2 border-b border-border pb-2 text-[11px] font-medium tracking-wide text-text-muted">
        <span />
        <span>KEY</span>
        <span>VALUE</span>
        <span />
      </div>

      {rows.map((row) => (
        <div
          key={row.id}
          className="grid grid-cols-[24px_1fr_1fr_28px] items-center gap-2 border-b border-borderMuted py-1.5"
        >
          <input
            type="checkbox"
            checked={row.enabled}
            onChange={(e) => update(row.id, { enabled: e.target.checked })}
            className="h-3.5 w-3.5 accent-primary"
          />
          <input
            value={row.key}
            onChange={(e) => update(row.id, { key: e.target.value })}
            placeholder="Metadata key"
            className="bg-transparent font-mono text-sm text-text-primary placeholder:text-text-muted outline-none"
          />
          <input
            value={row.value}
            onChange={(e) => update(row.id, { value: e.target.value })}
            placeholder="Value"
            className="bg-transparent font-mono text-sm text-text-primary placeholder:text-text-muted outline-none"
          />
          <button
            onClick={() => removeRow(row.id)}
            aria-label="Remove row"
            className="text-text-muted hover:text-error"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}

      <button
        onClick={addRow}
        className="mt-2 flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
      >
        <Plus size={13} />
        Add metadata
      </button>
    </div>
  );
}
