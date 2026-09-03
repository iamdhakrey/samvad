import { useRef, useEffect, useState } from "react";
import {
  Clock,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Radio,
  Square,
  Copy,
  Check,
  AlertTriangle,
  Activity,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import { useVartaStore } from "../../store/vartaStore";
import { useSettingsStore, DEFAULT_FONT_SETTINGS } from "../../store/settingStore";
import { GraphQlCallStatus } from "../../types";

type ResTab = "response" | "headers" | "events";

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  GraphQlCallStatus,
  { label: string; dotClass: string; textClass: string; icon: React.ReactNode }
> = {
  idle: {
    label: "Idle",
    dotClass: "bg-text-muted",
    textClass: "text-text-muted",
    icon: null,
  },
  sending: {
    label: "Sending…",
    dotClass: "bg-warning animate-pulse",
    textClass: "text-warning",
    icon: <Loader2 size={12} className="animate-spin" />,
  },
  streaming: {
    label: "Subscribed",
    dotClass: "bg-method-graphql animate-pulse",
    textClass: "text-method-graphql",
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

interface Props {
  isMobile?: boolean;
}

export default function GraphQlResponsePanel({ isMobile = false }: Props) {
  const [activeTab, setActiveTab] = useState<ResTab>("response");
  const [copied, setCopied] = useState(false);

  const callStatus = useVartaStore((s) => s.graphqlCallStatus);
  const response = useVartaStore((s) => s.graphqlResponse);
  const subMessages = useVartaStore((s) => s.graphqlSubscriptionMessages);
  const clearMessages = useVartaStore((s) => s.clearGraphqlMessages);
  const cancelSub = useVartaStore((s) => s.cancelGraphqlSubscription);

  const settingsFont = useSettingsStore((s) => s.settings?.font);
  const { fontFamily, fontSize, lineHeight } = settingsFont || DEFAULT_FONT_SETTINGS;

  const logEndRef = useRef<HTMLDivElement>(null);
  const isStreaming = callStatus === "streaming";
  const statusCfg = STATUS_CONFIG[callStatus];

  useEffect(() => {
    if (activeTab === "events") {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [subMessages.length, activeTab]);

  // Auto-switch to events tab when streaming starts
  useEffect(() => {
    if (isStreaming) setActiveTab("events");
  }, [isStreaming]);

  // Switch to response tab when a query/mutation completes
  useEffect(() => {
    if ((callStatus === "ok" || callStatus === "error") && response) {
      setActiveTab("response");
    }
  }, [callStatus, response]);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const responseHeaderEntries = Object.entries(response?.headers ?? {});
  const hasEvents = subMessages.length > 0;

  // Compute what to show in the Monaco editor
  const editorValue = (() => {
    if (callStatus === "idle" && !response) return "";
    if (response?.data) return response.data;
    if (response?.errors) return response.errors;
    return "";
  })();

  return (
    <div className="flex h-full flex-col">
      {/* Status bar */}
      <div
        className={`flex items-center gap-3 border-b border-border bg-panel text-sm ${
          isMobile ? "px-3 py-2" : "px-4 py-2"
        }`}
      >
        {/* Status dot + label */}
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${statusCfg.dotClass}`} />
          <span className={`font-medium flex items-center gap-1.5 ${statusCfg.textClass}`}>
            {statusCfg.icon}
            {statusCfg.label}
          </span>
        </div>

        {/* HTTP status */}
        {response && (
          <span
            className={`font-mono text-xs px-1.5 py-0.5 rounded ${
              response.status >= 200 && response.status < 300
                ? "bg-success/15 text-success"
                : "bg-error/15 text-error"
            }`}
          >
            {response.status} {response.statusText}
          </span>
        )}

        {/* Error badge */}
        {response?.errors && (
          <span className="flex items-center gap-1 rounded bg-error/15 px-1.5 py-0.5 text-[10px] text-error font-medium">
            <AlertCircle size={10} />
            Errors
          </span>
        )}

        {/* Timing */}
        {response && (
          <span className="flex items-center gap-1 text-xs text-text-secondary">
            <Clock size={11} />
            {response.timeMs} ms
          </span>
        )}

        {/* Size */}
        {response && response.sizeBytes > 0 && (
          <span className="text-xs text-text-muted">
            {(response.sizeBytes / 1024).toFixed(1)} KB
          </span>
        )}

        {/* Subscription event count */}
        {hasEvents && (
          <span className="text-text-muted text-xs">
            {subMessages.length} event{subMessages.length !== 1 ? "s" : ""}
          </span>
        )}

        {/* Actions */}
        <div className="ml-auto flex items-center gap-1.5">
          {isStreaming && (
            <button
              onClick={cancelSub}
              className="flex items-center gap-1.5 rounded-md bg-method-graphql/20 border border-method-graphql/40 px-2.5 py-1 text-xs text-method-graphql hover:bg-method-graphql hover:text-white transition-colors cursor-pointer"
              title="Stop subscription"
            >
              <Square size={11} fill="currentColor" />
              Unsubscribe
            </button>
          )}

          {(response || hasEvents) && (
            <>
              {editorValue && (
                <button
                  onClick={() => handleCopy(editorValue)}
                  className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-text-secondary hover:bg-panel-raised hover:text-text-primary transition-colors cursor-pointer"
                  title="Copy response"
                >
                  {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              )}
              <button
                onClick={clearMessages}
                className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-text-secondary hover:bg-panel-raised hover:text-text-primary transition-colors cursor-pointer"
                title="Clear response"
              >
                <Trash2 size={12} />
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab strip */}
      <div
        className={`flex gap-1 border-b border-border ${
          isMobile ? "overflow-x-auto scrollbar-hide px-2" : "px-4"
        }`}
      >
        <button
          onClick={() => setActiveTab("response")}
          className={`tab-trigger shrink-0 ${activeTab === "response" ? "tab-trigger-active" : ""}`}
        >
          Response
          {response?.errors && (
            <span className="ml-1.5 rounded-full bg-error/20 px-1.5 py-0.5 text-[10px] text-error font-medium">
              !
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("headers")}
          className={`tab-trigger shrink-0 ${activeTab === "headers" ? "tab-trigger-active" : ""}`}
        >
          Headers
          {responseHeaderEntries.length > 0 && (
            <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary font-medium">
              {responseHeaderEntries.length}
            </span>
          )}
        </button>
        {hasEvents && (
          <button
            onClick={() => setActiveTab("events")}
            className={`tab-trigger shrink-0 ${activeTab === "events" ? "tab-trigger-active" : ""}`}
          >
            Events
            <span className="ml-1.5 rounded-full bg-method-graphql/20 px-1.5 py-0.5 text-[10px] text-method-graphql font-medium">
              {subMessages.length}
            </span>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* Response tab */}
        {activeTab === "response" && (
          <div className="flex h-full flex-col">
            {/* Idle / empty state */}
            {callStatus === "idle" && !response && (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center p-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-method-graphql/10 border border-method-graphql/20">
                  <Activity size={22} className="text-method-graphql" />
                </div>
                <p className="text-sm text-text-muted">
                  Send a query to see the response here
                </p>
              </div>
            )}

            {/* Errors section (always shown if present) */}
            {response?.errors && (
              <div className="border-b border-error/20 bg-error/5 px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={13} className="text-error" />
                  <span className="text-xs font-semibold text-error">GraphQL Errors</span>
                </div>
                <pre className="whitespace-pre-wrap font-mono text-xs text-error/90 leading-relaxed max-h-32 overflow-auto">
                  {response.errors}
                </pre>
              </div>
            )}

            {/* Data viewer */}
            {(response?.data || (response && !response.errors)) && (
              <div className="flex-1 overflow-hidden">
                <Editor
                  height="100%"
                  language="json"
                  value={response?.data ?? (callStatus === "sending" ? "" : "null")}
                  theme="vs-dark"
                  options={{
                    fontFamily,
                    fontSize,
                    lineHeight,
                    readOnly: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    padding: { top: 12, bottom: 12 },
                    wordWrap: "on",
                    renderLineHighlight: "none",
                    overviewRulerBorder: false,
                  }}
                />
              </div>
            )}

            {/* Extensions */}
            {response?.extensions && (
              <div className="border-t border-border px-4 py-2">
                <details>
                  <summary className="cursor-pointer text-xs text-text-muted hover:text-text-secondary">
                    Extensions
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-text-secondary max-h-24 overflow-auto">
                    {response.extensions}
                  </pre>
                </details>
              </div>
            )}
          </div>
        )}

        {/* Headers tab */}
        {activeTab === "headers" && (
          <div className="h-full overflow-auto">
            {responseHeaderEntries.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-text-muted">
                No response headers
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-panel">
                  <tr className="border-b border-border text-text-muted">
                    <th className="px-4 py-2 text-left font-medium">Header</th>
                    <th className="px-4 py-2 text-left font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {responseHeaderEntries.map(([k, v]) => (
                    <tr key={k} className="border-b border-border/50 hover:bg-panel-raised/30">
                      <td className="px-4 py-2 font-mono text-text-secondary">{k}</td>
                      <td className="px-4 py-2 font-mono text-text-primary break-all">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Events tab (subscriptions) */}
        {activeTab === "events" && (
          <div className="h-full overflow-auto">
            <div className="flex flex-col divide-y divide-border/40">
              {subMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`px-4 py-2.5 font-mono text-xs ${
                    msg.eventType === "error"
                      ? "bg-error/5 border-l-2 border-error"
                      : msg.eventType === "complete"
                      ? "bg-text-muted/5 border-l-2 border-text-muted"
                      : msg.eventType === "connecting"
                      ? "bg-method-graphql/5 border-l-2 border-method-graphql"
                      : "border-l-2 border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        msg.eventType === "data"
                          ? "bg-success/15 text-success"
                          : msg.eventType === "error"
                          ? "bg-error/15 text-error"
                          : msg.eventType === "complete"
                          ? "bg-text-muted/15 text-text-muted"
                          : "bg-method-graphql/15 text-method-graphql"
                      }`}
                    >
                      {msg.eventType}
                    </span>
                    <span className="text-text-muted text-[10px]">{msg.timestamp}</span>
                  </div>
                  {msg.payload && msg.payload !== "{}" && (
                    <pre className="text-text-primary whitespace-pre-wrap leading-relaxed max-h-48 overflow-auto">
                      {msg.payload}
                    </pre>
                  )}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>

            {subMessages.length === 0 && (
              <div className="flex h-full items-center justify-center text-xs text-text-muted">
                Waiting for subscription events…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
