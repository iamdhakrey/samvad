import { useState, useRef, useEffect, useMemo } from "react";
import {
  Send,
  Unplug,
  Save,
  Trash2,
  ArrowUp,
  ArrowDown,
  X,
  Zap,
  Globe,
} from "lucide-react";
import { useVartaStore } from "../../store/vartaStore";
import { RequestTab, WsMessage } from "../../types";
import { WsSavedMessage } from "@samvad-internal/models";

interface WebSocketPanelProps {
  tab: RequestTab;
  isMobile?: boolean;
}

// ---------------------------------------------------------------------------
// GraphQL-WS message type helpers
// ---------------------------------------------------------------------------

interface GqlWsMessage {
  id?: string;
  type: string;
  payload?: any;
}

/** Try to parse a graphql-ws framed message */
function parseGqlWs(raw: string): GqlWsMessage | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.type === "string") return parsed;
  } catch {
    // not valid JSON / not a graphql-ws message
  }
  return null;
}

/** Human-readable label for graphql-ws message types */
function gqlWsTypeLabel(type: string): string {
  const map: Record<string, string> = {
    connection_init: "Init",
    connection_ack: "Ack",
    subscribe: "Subscribe",
    next: "Data",
    error: "Error",
    complete: "Complete",
    ping: "Ping",
    pong: "Pong",
  };
  return map[type] ?? type;
}

/** Color class for graphql-ws message types */
function gqlWsTypeBadgeClass(type: string): string {
  switch (type) {
    case "connection_ack":
      return "bg-success/20 text-success";
    case "next":
      return "bg-secondary/20 text-secondary";
    case "error":
      return "bg-error/20 text-error";
    case "complete":
      return "bg-text-muted/20 text-text-muted";
    case "subscribe":
    case "connection_init":
      return "bg-primary/20 text-primary";
    default:
      return "bg-text-muted/20 text-text-muted";
  }
}

// ---------------------------------------------------------------------------
// GraphQL composer component
// ---------------------------------------------------------------------------

function GraphQLComposer({
  onSend,
  disabled,
  isMobile,
}: {
  onSend: (payload: string) => void;
  disabled: boolean;
  isMobile: boolean;
}) {
  const [query, setQuery] = useState("subscription {\n  \n}");
  const [variables, setVariables] = useState("{}");
  const [operationName, setOperationName] = useState("");
  const [activeField, setActiveField] = useState<"query" | "variables">(
    "query",
  );

  const handleSend = () => {
    const payload: Record<string, any> = { query };
    try {
      const vars = JSON.parse(variables);
      if (Object.keys(vars).length > 0) {
        payload.variables = vars;
      }
    } catch {
      // invalid JSON — skip variables
    }
    if (operationName.trim()) {
      payload.operationName = operationName.trim();
    }
    onSend(JSON.stringify(payload));
  };

  return (
    <div
      className={`border-t border-border bg-panel ${isMobile ? "p-2" : "p-3"}`}
    >
      {/* Field toggles */}
      <div className="flex items-center gap-1 mb-2">
        <button
          onClick={() => setActiveField("query")}
          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
            activeField === "query"
              ? "bg-primary/20 text-primary"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          Query
        </button>
        <button
          onClick={() => setActiveField("variables")}
          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
            activeField === "variables"
              ? "bg-primary/20 text-primary"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          Variables
        </button>
        <input
          value={operationName}
          onChange={(e) => setOperationName(e.target.value)}
          placeholder="operationName (optional)"
          className="ml-auto input-shell text-[10px] py-0.5 px-2 w-40 font-mono"
        />
      </div>

      <div className="flex gap-2">
        {activeField === "query" ? (
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={disabled}
            placeholder="subscription { newMessage { id content } }"
            className="input-shell flex-1 resize-none font-mono text-xs min-h-20 max-h-40 disabled:opacity-50"
            rows={4}
            spellCheck={false}
          />
        ) : (
          <textarea
            value={variables}
            onChange={(e) => setVariables(e.target.value)}
            disabled={disabled}
            placeholder='{ "key": "value" }'
            className="input-shell flex-1 resize-none font-mono text-xs min-h-20 max-h-40 disabled:opacity-50"
            rows={4}
            spellCheck={false}
          />
        )}

        <div className="flex flex-col gap-1.5">
          <button
            onClick={handleSend}
            disabled={disabled || !query.trim()}
            className="rounded-md bg-brand-gradient px-3 py-1.5 text-xs font-medium text-white shadow-panel hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center gap-1.5"
          >
            <Zap size={12} />
            Subscribe
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export default function WebSocketPanel({
  tab,
  isMobile = false,
}: WebSocketPanelProps) {
  const [input, setInput] = useState("");
  const [subTab, setSubTab] = useState<"messages" | "saved">("messages");
  const [newMsgName, setNewMsgName] = useState("");
  const [newMsgData, setNewMsgData] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);

  const logEndRef = useRef<HTMLDivElement>(null);

  const sendWsMessage = useVartaStore((s) => s.sendWsMessage);
  const loadSavedMessages = useVartaStore((s) => s.loadSavedMessages);
  const addSavedMessage = useVartaStore((s) => s.addSavedMessage);
  const deleteSavedMessage = useVartaStore((s) => s.deleteSavedMessage);
  const setWsProtocol = useVartaStore((s) => s.setWsProtocol);

  const isGraphqlWs = tab.wsProtocol === "graphql-ws";

  // Auto-scroll the log when new messages arrive
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [tab.wsMessages.length]);

  // Load saved messages when we first render or change request
  useEffect(() => {
    if (tab.request.id && !tab.request.id.startsWith("new-")) {
      loadSavedMessages(tab.request.id);
    }
  }, [tab.request.id, loadSavedMessages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || tab.wsStatus !== "connected") return;
    sendWsMessage(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSaveMessage = async () => {
    if (!newMsgName.trim() || !newMsgData.trim()) return;
    await addSavedMessage(tab.request.id, newMsgName.trim(), newMsgData.trim());
    setNewMsgName("");
    setNewMsgData("");
    setShowSaveForm(false);
  };

  const handleSendSaved = (msg: WsSavedMessage) => {
    if (tab.wsStatus !== "connected") return;
    sendWsMessage(msg.data);
  };

  const isConnected = tab.wsStatus === "connected";
  const isConnecting = tab.wsStatus === "connecting";

  // Count active subscriptions from messages
  const activeSubscriptions = useMemo(() => {
    if (!isGraphqlWs) return 0;
    const completed = new Set<string>();
    const subscribed = new Set<string>();
    for (const msg of tab.wsMessages) {
      const parsed = parseGqlWs(msg.data);
      if (!parsed?.id) continue;
      if (parsed.type === "subscribe") subscribed.add(parsed.id);
      if (parsed.type === "complete" || parsed.type === "error")
        completed.add(parsed.id);
    }
    // Active = subscribed but not completed
    return [...subscribed].filter((id) => !completed.has(id)).length;
  }, [tab.wsMessages, isGraphqlWs]);

  // ---------------------------------------------------------------------------
  // Render a single message row
  // ---------------------------------------------------------------------------
  const renderMessageRow = (msg: WsMessage, i: number) => {
    if (msg.direction === "closed") {
      return (
        <div
          key={i}
          className="flex items-center gap-2 py-1 text-xs text-text-muted italic"
        >
          <Unplug size={11} />
          Connection closed
          <span className="ml-auto font-mono text-[10px] opacity-60">
            {new Date(msg.timestamp).toLocaleTimeString()}
          </span>
        </div>
      );
    }

    const isSent = msg.direction === "sent";
    const gqlMsg = isGraphqlWs ? parseGqlWs(msg.data) : null;

    // Decide what content to display
    let displayContent = msg.data;
    let gqlBadge: React.ReactNode = null;

    if (gqlMsg) {
      gqlBadge = (
        <span
          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${gqlWsTypeBadgeClass(gqlMsg.type)}`}
        >
          {gqlWsTypeLabel(gqlMsg.type)}
          {gqlMsg.id && (
            <span className="ml-1 opacity-60 normal-case">
              #{gqlMsg.id.slice(0, 8)}
            </span>
          )}
        </span>
      );

      // For "next" messages, show just the payload for cleaner display
      if (gqlMsg.type === "next" && gqlMsg.payload) {
        try {
          displayContent = JSON.stringify(gqlMsg.payload, null, 2);
        } catch {
          displayContent = msg.data;
        }
      } else if (gqlMsg.type === "error" && gqlMsg.payload) {
        try {
          displayContent = JSON.stringify(gqlMsg.payload, null, 2);
        } catch {
          displayContent = msg.data;
        }
      } else if (
        gqlMsg.type === "connection_ack" ||
        gqlMsg.type === "complete" ||
        gqlMsg.type === "ping" ||
        gqlMsg.type === "pong"
      ) {
        displayContent = ""; // Control messages — badge is enough
      } else if (gqlMsg.type === "subscribe" && gqlMsg.payload?.query) {
        displayContent = gqlMsg.payload.query;
      } else {
        try {
          displayContent = JSON.stringify(gqlMsg, null, 2);
        } catch {
          displayContent = msg.data;
        }
      }
    } else {
      // Try to pretty-print plain JSON for raw mode too
      try {
        const parsed = JSON.parse(msg.data);
        displayContent = JSON.stringify(parsed, null, 2);
      } catch {
        displayContent = msg.data;
      }
    }

    return (
      <div
        key={i}
        className={`group flex gap-2 rounded-md border px-3 py-2 text-sm font-mono transition-colors ${
          isSent
            ? "border-primary/20 bg-primary/5"
            : "border-secondary/20 bg-secondary/5"
        }`}
      >
        <div className="shrink-0 pt-0.5">
          {isSent ? (
            <ArrowUp size={13} className="text-primary" />
          ) : (
            <ArrowDown size={13} className="text-secondary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          {gqlBadge && <div className="mb-1">{gqlBadge}</div>}
          {displayContent && (
            <pre className="whitespace-pre-wrap break-all text-text-primary text-xs">
              {displayContent}
            </pre>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span className="font-mono text-[10px] text-text-muted">
            {new Date(msg.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* Status bar */}
      <div
        className={`flex items-center gap-3 border-b border-border bg-panel text-sm ${
          isMobile ? "px-3 py-2" : "px-4 py-2"
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              isConnected
                ? "bg-success animate-pulse"
                : isConnecting
                  ? "bg-warning animate-pulse"
                  : "bg-text-muted"
            }`}
          />
          <span
            className={`font-medium ${
              isConnected
                ? "text-success"
                : isConnecting
                  ? "text-warning"
                  : "text-text-muted"
            }`}
          >
            {isConnected
              ? "Connected"
              : isConnecting
                ? "Connecting…"
                : "Disconnected"}
          </span>
        </div>

        {tab.wsMessages.length > 0 && (
          <span className="text-text-muted text-xs">
            {tab.wsMessages.filter((m) => m.direction !== "closed").length}{" "}
            messages
          </span>
        )}

        {isGraphqlWs && activeSubscriptions > 0 && (
          <span className="text-xs rounded-full bg-success/20 text-success px-2 py-0.5 font-medium">
            {activeSubscriptions} active subscription
            {activeSubscriptions > 1 ? "s" : ""}
          </span>
        )}

        {/* Protocol selector — only when disconnected */}
        {tab.wsStatus === "disconnected" && (
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setWsProtocol("raw")}
              className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                !isGraphqlWs
                  ? "bg-primary/20 text-primary"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              <Globe size={10} />
              Raw
            </button>
            <button
              onClick={() => setWsProtocol("graphql-ws")}
              className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                isGraphqlWs
                  ? "bg-primary/20 text-primary"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              <Zap size={10} />
              GraphQL
            </button>
          </div>
        )}

        {/* Show active protocol label when connected */}
        {tab.wsStatus !== "disconnected" && (
          <span className="ml-auto text-[10px] text-text-muted font-medium uppercase tracking-wider">
            {isGraphqlWs ? "graphql-transport-ws" : "raw"}
          </span>
        )}
      </div>

      {/* Sub tabs */}
      <div
        className={`flex gap-1 border-b border-border ${
          isMobile ? "overflow-x-auto scrollbar-hide px-2" : "px-4"
        }`}
      >
        <button
          onClick={() => setSubTab("messages")}
          className={`tab-trigger shrink-0 ${subTab === "messages" ? "tab-trigger-active" : ""}`}
        >
          Messages
          {tab.wsMessages.length > 0 && (
            <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary">
              {tab.wsMessages.filter((m) => m.direction !== "closed").length}
            </span>
          )}
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {subTab === "messages" && (
          <>
            {/* Message log */}
            <div
              className={`flex-1 overflow-y-auto ${isMobile ? "px-3 py-2" : "px-4 py-3"}`}
            >
              {tab.wsMessages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-text-muted">
                  {isConnected
                    ? isGraphqlWs
                      ? "Connected — compose a GraphQL subscription below."
                      : "Connected — send a message to begin."
                    : "Connect to a WebSocket server to see messages here."}
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {tab.wsMessages.map((msg, i) => renderMessageRow(msg, i))}
                  <div ref={logEndRef} />
                </div>
              )}
            </div>

            {/* Message composer — differs by protocol */}
            {isGraphqlWs ? (
              <GraphQLComposer
                onSend={sendWsMessage}
                disabled={!isConnected}
                isMobile={isMobile}
              />
            ) : (
              <div
                className={`border-t border-border bg-panel ${isMobile ? "p-2" : "p-3"}`}
              >
                <div className="flex gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={!isConnected}
                    placeholder={
                      isConnected
                        ? "Type a message… (Enter to send, Shift+Enter for newline)"
                        : "Connect first to send messages"
                    }
                    className="input-shell flex-1 resize-none font-mono text-xs min-h-15 max-h-30 disabled:opacity-50"
                    rows={2}
                  />
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={handleSend}
                      disabled={!isConnected || !input.trim()}
                      className="rounded-md bg-brand-gradient px-3 py-1.5 text-xs font-medium text-white shadow-panel hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center gap-1.5"
                    >
                      <Send size={12} />
                      Send
                    </button>
                    {input.trim() && (
                      <button
                        onClick={() => {
                          setNewMsgData(input.trim());
                          setNewMsgName("");
                          setShowSaveForm(true);
                          setSubTab("saved");
                        }}
                        className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-panel-raised hover:text-text-primary transition-colors flex items-center gap-1.5"
                      >
                        <Save size={12} />
                        Save
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {subTab === "saved" && (
          <div
            className={`flex-1 overflow-y-auto ${isMobile ? "px-3 py-2" : "px-4 py-3"}`}
          >
            {/* Add new saved message form */}
            {showSaveForm && (
              <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-primary">
                    Save Message Template
                  </span>
                  <button
                    onClick={() => setShowSaveForm(false)}
                    className="p-1 text-text-muted hover:text-text-primary rounded"
                  >
                    <X size={14} />
                  </button>
                </div>
                <input
                  value={newMsgName}
                  onChange={(e) => setNewMsgName(e.target.value)}
                  placeholder="Template name (e.g. 'Subscribe to ticker')"
                  className="input-shell w-full text-xs"
                  autoFocus
                />
                <textarea
                  value={newMsgData}
                  onChange={(e) => setNewMsgData(e.target.value)}
                  placeholder="Message payload"
                  className="input-shell w-full resize-none font-mono text-xs min-h-15"
                  rows={3}
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowSaveForm(false)}
                    className="rounded-md border border-border px-3 py-1 text-xs text-text-secondary hover:bg-panel-raised"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveMessage}
                    disabled={!newMsgName.trim() || !newMsgData.trim()}
                    className="rounded-md bg-brand-gradient px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {!showSaveForm && (
              <button
                onClick={() => {
                  setNewMsgName("");
                  setNewMsgData("");
                  setShowSaveForm(true);
                }}
                className="mb-3 flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-xs text-text-secondary hover:border-primary/50 hover:text-text-primary transition-colors w-full justify-center"
              >
                <Save size={12} />
                New saved message
              </button>
            )}

            {/* Saved messages list */}
            {tab.wsSavedMessages.length === 0 && !showSaveForm ? (
              <div className="flex h-32 items-center justify-center text-sm text-text-muted">
                No saved messages yet. Create one to quickly re-send common
                payloads.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {tab.wsSavedMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="group rounded-md border border-border bg-panel p-3 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-text-primary">
                        {msg.name}
                      </span>
                      <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleSendSaved(msg)}
                          disabled={!isConnected}
                          className="rounded p-1 text-primary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={
                            isConnected ? "Send this message" : "Connect first"
                          }
                        >
                          <Send size={13} />
                        </button>
                        <button
                          onClick={() =>
                            deleteSavedMessage(tab.request.id, msg.id)
                          }
                          className="rounded p-1 text-text-muted hover:text-error hover:bg-error/10"
                          title="Delete saved message"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <pre className="whitespace-pre-wrap break-all font-mono text-xs text-text-secondary bg-bg rounded p-2">
                      {msg.data}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
