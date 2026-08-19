
import { useRef, useEffect } from "react";
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Copy,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Radio,
} from "lucide-react";
import { useVartaStore } from "../../store/vartaStore";
import { GrpcCallStatus, GrpcMessage } from "../../types";

interface GrpcResponsePanelProps {
  isMobile?: boolean;
}

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
}: GrpcResponsePanelProps) {
  const messages = useVartaStore((s) => s.grpcMessages);
  const callStatus = useVartaStore((s) => s.grpcCallStatus);
  const lastLatency = useVartaStore((s) => s.grpcLastLatencyMs);
  const clearMessages = useVartaStore((s) => s.clearGrpcMessages);

  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const statusCfg = STATUS_CONFIG[callStatus];

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
          <span className={`font-medium flex items-center gap-1.5 ${statusCfg.textClass}`}>
            {statusCfg.icon}
            {statusCfg.label}
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
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-text-secondary hover:bg-panel-raised hover:text-text-primary transition-colors"
              title="Clear messages"
            >
              <Trash2 size={12} />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Messages tab header */}
      <div
        className={`flex gap-1 border-b border-border ${
          isMobile ? "overflow-x-auto scrollbar-hide px-2" : "px-4"
        }`}
      >
        <button className="tab-trigger shrink-0 tab-trigger-active">
          Messages
          {messages.length > 0 && (
            <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary">
              {messages.length}
            </span>
          )}
        </button>
      </div>

      {/* Message log */}
      <div
        className={`flex-1 overflow-y-auto ${
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
            Waiting for response…
          </span>
        </>
      ) : (
        <>
          <div className="rounded-full bg-panel-raised p-3">
            <Radio size={20} className="text-text-muted" />
          </div>
          <span className="text-sm text-text-muted">
            Select a service & method, then click <strong className="text-text-secondary">Invoke</strong> to see responses here.
          </span>
        </>
      )}
    </div>
  );
}

// ── Message row ─────────────────────────────────────────────────────────

function MessageRow({ msg, isMobile }: { msg: GrpcMessage; isMobile: boolean }) {
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
          ? "border-primary/20 bg-primary/5"
          : msg.isError
            ? "border-error/20 bg-error/5"
            : "border-success/20 bg-success/5"
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
        {/* Status code badge */}
        {msg.statusCode && (
          <div className="mb-1">
            <span
              className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                msg.statusCode === "OK"
                  ? "bg-success/20 text-success"
                  : "bg-error/20 text-error"
              }`}
            >
              {msg.statusCode}
            </span>
          </div>
        )}

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

        {/* Copy button — visible on hover */}
        <button
          onClick={handleCopy}
          className={`rounded p-0.5 text-text-muted hover:text-text-primary hover:bg-panel-raised transition-colors ${
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
