import { useRef, useEffect, useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Copy,
  Check,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Radio,
  AlertCircle,
  Square,
  Search,
  Layers,
} from "lucide-react";
import { useVartaStore } from "../../store/vartaStore";
import { GrpcCallStatus, GrpcMessage } from "../../types";

interface GrpcResponsePanelProps {
  error?: string;
  isMobile?: boolean;
}

type ResponseTab = "messages" | "metadata";

// ── Status bar config ───────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  GrpcCallStatus,
  { label: string; dotClass: string; textClass: string; icon: React.ReactNode }
> = {
  idle: {
    label: "Idle",
    dotClass: "bg-text-muted",
    textClass: "text-text-muted",
    icon: null,
  },
  invoking: {
    label: "Invoking…",
    dotClass: "bg-warning animate-pulse",
    textClass: "text-warning",
    icon: <Loader2 size={12} className="animate-spin" />,
  },
  streaming: {
    label: "Streaming",
    dotClass: "bg-secondary animate-pulse",
    textClass: "text-secondary",
    icon: <Radio size={12} className="animate-pulse" />,
  },
  ok: {
    label: "OK",
    dotClass: "bg-success",
    textClass: "text-success",
    icon: <CheckCircle2 size={12} />,
  },
  error: {
    label: "Error",
    dotClass: "bg-error",
    textClass: "text-error",
    icon: <XCircle size={12} />,
  },
  cancelled: {
    label: "Cancelled",
    dotClass: "bg-text-muted",
    textClass: "text-text-muted",
    icon: <AlertTriangle size={12} />,
  },
};

export default function GrpcResponsePanel({
  isMobile = false,
  error,
}: GrpcResponsePanelProps) {
  const [activeTab, setActiveTab] = useState<ResponseTab>("messages");
  const messages = useVartaStore((s) => s.grpcMessages);
  const callStatus = useVartaStore((s) => s.grpcCallStatus);
  const lastLatency = useVartaStore((s) => s.grpcLastLatencyMs);
  const responseMetadata = useVartaStore((s) => s.grpcResponseMetadata);
  const responseStatus = useVartaStore((s) => s.grpcResponseStatus);
  const clearMessages = useVartaStore((s) => s.clearGrpcMessages);
  const cancelGrpcCall = useVartaStore((s) => s.cancelGrpcCall);

  const metadataEntries = Object.entries(responseMetadata || {});
  const metadataCount = metadataEntries.length;

  const logEndRef = useRef<HTMLDivElement>(null);
  const isStreaming = callStatus === "streaming";

  // Auto-scroll on new messages
  useEffect(() => {
    if (activeTab === "messages") {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, activeTab]);

  const statusCfg = STATUS_CONFIG[callStatus];

  // Error view state
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

  return (
    <div className="flex h-full flex-col">
      {/* Status bar */}
      <div
        className={`flex items-center gap-3 border-b border-border bg-panel text-sm ${
          isMobile ? "px-3 py-2" : "px-4 py-2"
        }`}
      >
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${statusCfg.dotClass}`} />
          <span
            className={`font-medium flex items-center gap-1.5 ${statusCfg.textClass}`}
          >
            {statusCfg.icon}
            {responseStatus ? (
              <span>
                {responseStatus.text}
                <span className="ml-1 text-[10px] font-mono opacity-75">
                  ({responseStatus.code})
                </span>
              </span>
            ) : (
              statusCfg.label
            )}
          </span>
        </div>

        {/* Message count */}
        {messages.length > 0 && (
          <span className="text-text-muted text-xs">
            {messages.length} message{messages.length !== 1 ? "s" : ""}
          </span>
        )}

        {/* Latency */}
        {lastLatency !== null && (
          <span className="flex items-center gap-1 text-xs text-text-secondary">
            <Clock size={11} />
            {lastLatency} ms
          </span>
        )}

        {/* Actions */}
        <div className="ml-auto flex items-center gap-1.5">
          {isStreaming && (
            <button
              onClick={cancelGrpcCall}
              className="flex items-center gap-1.5 rounded-md bg-error/20 border border-error/40 px-2.5 py-1 text-xs text-error hover:bg-error hover:text-white transition-colors cursor-pointer"
              title="Stop active stream"
            >
              <Square size={11} fill="currentColor" />
              Stop Stream
            </button>
          )}

          {(messages.length > 0 || metadataCount > 0) && (
            <button
              onClick={clearMessages}
              className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-text-secondary hover:bg-panel-raised hover:text-text-primary transition-colors cursor-pointer"
              title="Clear messages and metadata"
            >
              <Trash2 size={12} />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Tabs header */}
      <div
        className={`flex gap-1 border-b border-border ${
          isMobile ? "overflow-x-auto scrollbar-hide px-2" : "px-4"
        }`}
      >
        <button
          onClick={() => setActiveTab("messages")}
          className={`tab-trigger shrink-0 ${
            activeTab === "messages" ? "tab-trigger-active" : ""
          }`}
        >
          Messages
          {messages.length > 0 && (
            <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary font-medium">
              {messages.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("metadata")}
          className={`tab-trigger shrink-0 ${
            activeTab === "metadata" ? "tab-trigger-active" : ""
          }`}
        >
          Trailing Metadata
          {metadataCount > 0 && (
            <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary font-medium">
              {metadataCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab contents */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "messages" && (
          <div
            className={`h-full overflow-y-auto ${
              isMobile ? "px-3 py-2" : "px-4 py-3"
            }`}
          >
            {messages.length === 0 ? (
              <EmptyState callStatus={callStatus} />
            ) : (
              <div className="flex flex-col gap-1.5">
                {messages.map((msg) => (
                  <MessageRow key={msg.id} msg={msg} isMobile={isMobile} />
                ))}
                <div ref={logEndRef} />
              </div>
            )}
          </div>
        )}

        {activeTab === "metadata" && (
          <MetadataViewer
            metadata={responseMetadata}
            isMobile={isMobile}
          />
        )}
      </div>
    </div>
  );
}

// ── Metadata Viewer ─────────────────────────────────────────────────────

function MetadataViewer({
  metadata,
  isMobile,
}: {
  metadata: Record<string, string>;
  isMobile: boolean;
}) {
  const [filter, setFilter] = useState("");
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const entries = Object.entries(metadata || {});
  const filtered = entries.filter(
    ([k, v]) =>
      k.toLowerCase().includes(filter.toLowerCase()) ||
      v.toLowerCase().includes(filter.toLowerCase())
  );

  const handleCopyAll = () => {
    navigator.clipboard.writeText(JSON.stringify(metadata, null, 2));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  };

  const handleCopyValue = (k: string, v: string) => {
    navigator.clipboard.writeText(v);
    setCopiedKey(k);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  if (entries.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="rounded-full bg-panel-raised p-3">
          <Layers size={20} className="text-text-muted" />
        </div>
        <span className="text-sm text-text-muted">
          No response or trailing metadata received yet.
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Search & Toolbar */}
      <div
        className={`flex items-center gap-2 border-b border-border bg-panel ${
          isMobile ? "px-3 py-2" : "px-4 py-2"
        }`}
      >
        <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-bg px-2.5 py-1 text-xs">
          <Search size={12} className="text-text-muted shrink-0" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter metadata by key or value…"
            className="w-full bg-transparent text-xs text-text-primary placeholder:text-text-muted outline-none"
          />
        </div>

        <button
          onClick={handleCopyAll}
          className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-text-secondary hover:bg-panel-raised hover:text-text-primary transition-colors cursor-pointer shrink-0"
          title="Copy metadata as JSON"
        >
          {copiedAll ? (
            <>
              <Check size={11} className="text-success" />
              <span className="text-success">Copied</span>
            </>
          ) : (
            <>
              <Copy size={11} />
              <span>Copy JSON</span>
            </>
          )}
        </button>
      </div>

      {/* Metadata Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border bg-panel-raised/50 text-[11px] font-medium text-text-muted uppercase tracking-wider">
              <th className="px-4 py-2 w-1/3">Key</th>
              <th className="px-4 py-2">Value</th>
              <th className="px-3 py-2 w-10 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border font-mono">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-text-muted">
                  No matching metadata found for "{filter}"
                </td>
              </tr>
            ) : (
              filtered.map(([k, v]) => (
                <tr
                  key={k}
                  className="group hover:bg-panel-raised/40 transition-colors"
                >
                  <td className="px-4 py-2 text-text-primary font-semibold select-text align-top">
                    {k}
                  </td>
                  <td className="px-4 py-2 text-text-secondary select-text break-all whitespace-pre-wrap align-top">
                    {v}
                  </td>
                  <td className="px-3 py-2 text-right align-top">
                    <button
                      onClick={() => handleCopyValue(k, v)}
                      className="rounded p-1 text-text-muted hover:text-text-primary hover:bg-panel-raised opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      title="Copy value"
                    >
                      {copiedKey === k ? (
                        <Check size={12} className="text-success" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────

function EmptyState({ callStatus }: { callStatus: GrpcCallStatus }) {
  const isActive = callStatus === "invoking" || callStatus === "streaming";

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      {isActive ? (
        <>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-warning animate-pulse" />
            <div className="h-2 w-2 rounded-full bg-warning animate-pulse [animation-delay:150ms]" />
            <div className="h-2 w-2 rounded-full bg-warning animate-pulse [animation-delay:300ms]" />
          </div>
          <span className="text-sm text-text-secondary">
            Waiting for stream messages…
          </span>
        </>
      ) : (
        <>
          <div className="rounded-full bg-panel-raised p-3">
            <Radio size={20} className="text-text-muted" />
          </div>
          <span className="text-sm text-text-muted">
            Select a service & method, then click{" "}
            <strong className="text-text-secondary">Invoke</strong> to see
            streaming messages here.
          </span>
        </>
      )}
    </div>
  );
}

// ── Message row ─────────────────────────────────────────────────────────

function MessageRow({
  msg,
  isMobile,
}: {
  msg: GrpcMessage;
  isMobile: boolean;
}) {
  const isSent = msg.direction === "sent";

  // Format message data
  let displayContent = msg.data;
  try {
    const parsed = JSON.parse(msg.data);
    displayContent = JSON.stringify(parsed, null, 2);
  } catch {
    // not valid JSON — show as-is
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.data);
  };

  return (
    <div
      className={`group flex gap-2 rounded-md border px-3 py-2 text-sm font-mono transition-colors ${
        isSent
          ? "border-primary/30 bg-primary/5"
          : msg.isError
            ? "border-error/30 bg-error/5"
            : "border-success/30 bg-success/5"
      }`}
    >
      {/* Direction icon */}
      <div className="shrink-0 pt-0.5">
        {isSent ? (
          <ArrowUp size={13} className="text-primary" />
        ) : msg.isError ? (
          <XCircle size={13} className="text-error" />
        ) : (
          <ArrowDown size={13} className="text-success" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Status / Direction badge */}
        <div className="mb-1 flex items-center gap-1.5">
          <span
            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
              isSent
                ? "bg-primary/20 text-primary"
                : msg.isError
                  ? "bg-error/20 text-error"
                  : "bg-success/20 text-success"
            }`}
          >
            {isSent ? "Sent" : msg.isError ? "Error" : "Received"}
          </span>

          {msg.statusCode && msg.statusCode !== "OK" && (
            <span className="inline-flex items-center rounded bg-panel px-1.5 py-0.5 text-[9px] font-mono text-text-muted">
              {msg.statusCode}
            </span>
          )}
        </div>

        {displayContent && (
          <pre className="whitespace-pre-wrap break-all text-text-primary text-xs">
            {displayContent}
          </pre>
        )}
      </div>

      {/* Meta: timestamp, latency, copy */}
      <div className="shrink-0 flex flex-col items-end gap-1">
        <span className="font-mono text-[10px] text-text-muted">
          {new Date(msg.timestamp).toLocaleTimeString()}
        </span>

        {msg.latencyMs !== undefined && (
          <span className="flex items-center gap-0.5 text-[10px] text-text-muted">
            <Clock size={9} />
            {msg.latencyMs}ms
          </span>
        )}

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className={`rounded p-0.5 text-text-muted hover:text-text-primary hover:bg-panel-raised transition-colors cursor-pointer ${
            isMobile ? "" : "opacity-0 group-hover:opacity-100"
          }`}
          title="Copy message"
        >
          <Copy size={11} />
        </button>
      </div>
    </div>
  );
}
