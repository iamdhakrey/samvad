import { useState } from "react";
import { Copy, Download, Code2, AlignLeft, AlertCircle } from "lucide-react";
import { ApiResponse } from "@samvad-internal/models";
// import { ApiResponse } from "../../types";

type RespTab = "body" | "headers" | "cookies" | "raw";

const TABS: { id: RespTab; label: string }[] = [
  { id: "body", label: "Body" },
  { id: "headers", label: "Headers" },
  { id: "cookies", label: "Cookies" },
  { id: "raw", label: "Raw" },
];

function statusColor(status: number) {
  if (status >= 200 && status < 300) return "text-success";
  if (status >= 400) return "text-error";
  return "text-warning";
}

function formatBytes(bytes: BigInt | number): string {
  bytes = Number(bytes);

  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

interface ResponsePanelProps {
  response?: ApiResponse;
  isSending: boolean;
  error?: string;
  isMobile?: boolean;
}

export default function ResponsePanel({
  response,
  isSending,
  error,
  isMobile = false,
}: ResponsePanelProps) {
  const [tab, setTab] = useState<RespTab>("body");
  const [pretty, setPretty] = useState(true);

  // Loading state
  if (isSending) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-secondary">
        Sending request…
      </div>
    );
  }

  // 2. Error view state
  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <AlertCircle className="text-error" size={28} />
        <h3 className="text-sm font-semibold text-text-primary">
          Request Failed
        </h3>
        <p className="max-w-md font-mono text-xs text-error bg-error/10 border border-error/20 rounded-md px-3 py-2 whitespace-pre-wrap">
          {error}
        </p>
      </div>
    );
  }

  // Empty state
  if (!response) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        Send a request to see the response here.
      </div>
    );
  }

  // Helper safely formats string data to prevent runtime crashes
  const renderFormattedBody = () => {
    if (!pretty) return response.body; // Minified / Raw raw string format
    try {
      // If it's valid JSON, pretty print it
      return JSON.stringify(JSON.parse(response.body), null, 2);
    } catch {
      // Fallback if the body isn't clean JSON
      return response.body;
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Metrics bar */}
      <div
        className={`flex items-center gap-4 border-b border-border bg-panel text-sm ${
          isMobile ? "flex-wrap gap-2 px-3 py-2" : "px-4 py-2"
        }`}
      >
        <span className={`font-semibold ${statusColor(response.status)}`}>
          {response.status} {response.statusText}
        </span>
        <span className="text-text-secondary">Time: {response.timeMs} ms</span>
        <span className="text-text-secondary">
          Size: {formatBytes(response.sizeBytes)}
        </span>

        <div className={`flex items-center gap-2 ${isMobile ? "" : "ml-auto"}`}>
          {tab === "body" && (
            <button
              onClick={() => setPretty((p) => !p)}
              className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-text-secondary hover:bg-panel-raised"
            >
              {pretty ? <AlignLeft size={12} /> : <Code2 size={12} />}
              {pretty ? "Raw" : "Pretty"}
            </button>
          )}
          <button
            onClick={() => navigator.clipboard.writeText(response.body)}
            aria-label="Copy response"
            className="rounded-md border border-border p-1.5 text-text-secondary hover:bg-panel-raised"
          >
            <Copy size={13} />
          </button>
          <button
            aria-label="Download response"
            className="rounded-md border border-border p-1.5 text-text-secondary hover:bg-panel-raised"
          >
            <Download size={13} />
          </button>
        </div>
      </div>

      {/* Sub tabs — scrollable on mobile */}
      <div
        className={`flex gap-1 border-b border-border ${
          isMobile ? "overflow-x-auto scrollbar-hide px-2" : "px-4"
        }`}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`tab-trigger shrink-0 ${tab === t.id ? "tab-trigger-active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Main Panel Content */}
      <div
        className={`flex-1 overflow-auto font-mono text-sm ${isMobile ? "px-3 py-2" : "px-4 py-3"}`}
      >
        {tab === "body" && (
          <pre className="whitespace-pre-wrap text-text-primary">
            {renderFormattedBody()}
          </pre>
        )}
        {tab === "headers" && (
          <div className="flex flex-col gap-1">
            {Object.entries(response.headers || {}).map(([k, v]) => (
              <div
                key={k}
                className={`flex ${isMobile ? "flex-col" : "gap-2"}`}
              >
                <span className={`text-secondary ${isMobile ? "text-xs" : ""}`}>
                  {k}:
                </span>
                <span
                  className={`text-text-primary ${isMobile ? "text-xs break-all" : ""}`}
                >
                  {v}
                </span>
              </div>
            ))}
          </div>
        )}
        {tab === "cookies" && (
          <p className="text-text-muted">
            {response.cookies && response.cookies.length > 0
              ? // Add map logic here if cookies are structured later
                JSON.stringify(response.cookies)
              : "No cookies were set by this response."}
          </p>
        )}
        {tab === "raw" && (
          <pre className="whitespace-pre-wrap text-text-secondary">
            {response.body}
          </pre>
        )}
      </div>
    </div>
  );
}
