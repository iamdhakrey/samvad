import { ChevronDown } from "lucide-react";
import { RequestTab } from "../../types";
import { useRef, useState } from "react";
import { useVartaStore } from "../../store/vartaStore";
import { useWorkspaceStore } from "../../store/workspaceStore";
import { MethodStyles } from "../../types";
import { HttpMethod } from "@samvad-internal/models";

interface UrlInputProps {
  url: string;
  onChange: (url: string) => void;
  onEnter: () => void;
  disabled?: boolean;
}

const UrlAutocompleteInput: React.FC<UrlInputProps> = ({
  url,
  onChange,
  onEnter,
  disabled,
}) => {
  const { environments, activeEnvironmentId } = useWorkspaceStore();

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // 1. Get Active Variables
  const activeEnv = environments.find(
    (e) => e.environment.id === activeEnvironmentId,
  );
  const envVars = activeEnv?.variables.filter((v) => v.enabled) || [];

  // Filter variables based on what is typed after {{
  const filteredVars = envVars.filter((v) =>
    v.key.toLowerCase().includes(filterText.toLowerCase()),
  );

  // 2. Sync Scrolling between transparent input and colored overlay
  const handleScroll = (e: React.UIEvent<HTMLInputElement>) => {
    if (overlayRef.current) {
      overlayRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  // 3. Track cursor to detect if we are inside a {{...}} block
  const updateAutocompleteState = (
    currentCursor: number,
    currentUrl: string,
  ) => {
    const textBeforeCursor = currentUrl.slice(0, currentCursor);
    const lastOpen = textBeforeCursor.lastIndexOf("{{");
    const lastClose = textBeforeCursor.lastIndexOf("}}");

    // If the last open bracket is after the last close bracket, we are typing a variable
    if (lastOpen > lastClose) {
      setFilterText(textBeforeCursor.slice(lastOpen + 2));
      setShowSuggestions(true);
      setSelectedIndex(0);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    const newCursor = e.target.selectionStart || 0;

    onChange(newUrl);
    setCursorPosition(newCursor);
    updateAutocompleteState(newCursor, newUrl);
  };

  const insertSuggestion = (envKey: string) => {
    const textBeforeCursor = url.slice(0, cursorPosition);
    const lastOpen = textBeforeCursor.lastIndexOf("{{");

    if (lastOpen !== -1) {
      const newUrl =
        url.slice(0, lastOpen) +
        "{{" +
        envKey +
        "}}" +
        url.slice(cursorPosition);
      onChange(newUrl);
      setShowSuggestions(false);

      // Restore focus and push cursor past the inserted variable
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const newPos = lastOpen + envKey.length + 4; // +4 accounts for {{ and }}
          inputRef.current.setSelectionRange(newPos, newPos);
        }
      }, 0);
    }
  };

  // Keyboard navigation for dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && filteredVars.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredVars.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev === 0 ? filteredVars.length - 1 : prev - 1,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertSuggestion(filteredVars[selectedIndex].key);
        return;
      }
      if (e.key === "Escape") {
        setShowSuggestions(false);
        return;
      }
    }

    if (e.key === "Enter") {
      onEnter();
    }
  };

  // 4. Render Highlighted Text
  const renderUrl = () => {
    // Split by complete {{...}} blocks to colorize them
    const parts = url.split(/(\\{\\{[^}]*\\}\\})/g);

    return parts.map((part, i) => {
      if (part.startsWith("{{") && part.endsWith("}}")) {
        const key = part.slice(2, -2);
        const exists = envVars.some((v) => v.key === key);
        // Green if valid, Red if invalid
        return (
          <span key={i} className={exists ? "text-success" : "text-error"}>
            {part}
          </span>
        );
      }
      return (
        <span key={i} className="text-text-primary">
          {part}
        </span>
      );
    });
  };

  return (
    <div className="relative flex-1 h-full">
      <div className="relative w-full h-8.5 rounded-md border border-border bg-panel overflow-hidden">
        {/* UNDERLAY: Colored Text */}
        <div
          ref={overlayRef}
          className="absolute inset-0 px-3 py-1.5 font-mono text-sm whitespace-pre overflow-x-hidden pointer-events-none"
        >
          {renderUrl()}
          {/* Invisible spacer to match input padding/scrolling bounds exactly */}
          <span className="inline-block w-8"></span>
        </div>

        {/* OVERLAY: Actual Input */}
        <input
          ref={inputRef}
          value={url}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          onClick={(e) => {
            const pos = e.currentTarget.selectionStart || 0;
            setCursorPosition(pos);
            updateAutocompleteState(pos, url);
          }}
          disabled={disabled}
          placeholder="https://api.example.com/users"
          // text-transparent makes text invisible, caret-text-primary keeps cursor visible
          className="absolute inset-0 w-full h-full px-3 py-1.5 font-mono text-sm bg-transparent outline-none text-transparent caret-text-primary"
          spellCheck="false"
        />
      </div>

      {/* Suggestion Dropdown */}
      {showSuggestions && activeEnv && (
        <div className="absolute top-full left-0 mt-1 w-64 max-h-48 overflow-y-auto z-50 rounded-md border border-border bg-panel-raised shadow-elevated p-1">
          {filteredVars.length === 0 ? (
            <div className="px-3 py-2 text-xs text-text-muted">
              No matching variables
            </div>
          ) : (
            filteredVars.map((v, index) => (
              <button
                key={v.id}
                onClick={() => insertSuggestion(v.key)}
                className={`flex w-full flex-col px-3 py-1.5 text-left rounded-sm cursor-pointer transition-colors ${
                  index === selectedIndex ? "bg-primary/20" : "hover:bg-panel"
                }`}
              >
                <span className="text-sm font-mono text-success">{v.key}</span>
                <span className="text-xs text-text-muted truncate">
                  {v.isSecret ? "••••••••" : v.value}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

interface RequestBarProps {
  tab: RequestTab;
  isMobile?: boolean;
}

export default function RequestBar({ tab, isMobile }: RequestBarProps) {
  const updateActiveRequest = useVartaStore((s) => s.updateActiveRequest);
  const sendActiveRequest = useVartaStore((s) => s.sendActiveRequest);
  const connectWebSocket = useVartaStore((s) => s.connectWebSocket);
  const disconnectWebSocket = useVartaStore((s) => s.disconnectWebSocket);

  const methods: HttpMethod[] = [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "HEAD",
    "OPTIONS",
    "QUERY",
  ];
  const isWs = tab.request.method === "WS";
  const wsConnected = tab.wsStatus === "connected";
  const wsConnecting = tab.wsStatus === "connecting";
  const method = tab.request.method;

  /** When user picks a method from the dropdown, handle WS ↔ HTTP transitions. */
  const handleMethodChange = (newMethod: HttpMethod) => {
    const patches: Partial<typeof tab.request> = { method: newMethod };
    if (
      newMethod === "WS" &&
      !tab.request.url.trim().toLowerCase().startsWith("ws://") &&
      !tab.request.url.trim().toLowerCase().startsWith("wss://")
    ) {
      // Auto-prefix URL for convenience
      const existingUrl = tab.request.url.trim();
      if (existingUrl.startsWith("http://")) {
        patches.url = existingUrl.replace(/^http:\/\//, "ws://");
      } else if (existingUrl.startsWith("https://")) {
        patches.url = existingUrl.replace(/^https:\/\//, "wss://");
      } else if (!existingUrl) {
        patches.url = "ws://";
      }
    } else if (
      newMethod !== "WS" &&
      (tab.request.url.trim().toLowerCase().startsWith("ws://") ||
        tab.request.url.trim().toLowerCase().startsWith("wss://"))
    ) {
      // Switching away from WS — convert URL back to HTTP
      const existingUrl = tab.request.url.trim();
      if (existingUrl.startsWith("wss://")) {
        patches.url = existingUrl.replace(/^wss:\/\//, "https://");
      } else if (existingUrl.startsWith("ws://")) {
        patches.url = existingUrl.replace(/^ws:\/\//, "http://");
      }
    }
    updateActiveRequest(patches);
  };

  // console.log(tab.request);
  // -- WS action button ---------------------------------------------------
  const renderWsButton = () => {
    if (wsConnected) {
      return (
        <button
          onClick={disconnectWebSocket}
          className="rounded-md bg-error/90 px-5 py-1.5 text-sm font-medium text-white shadow-panel hover:bg-error transition-colors"
        >
          Disconnect
        </button>
      );
    }
    return (
      <button
        onClick={connectWebSocket}
        disabled={wsConnecting || !tab.request.url.trim()}
        className="rounded-md bg-success/90 px-5 py-1.5 text-sm font-medium text-white shadow-panel hover:bg-success disabled:opacity-60 transition-colors"
      >
        {wsConnecting ? "Connecting…" : "Connect"}
      </button>
    );
  };

  // -- WS badge instead of method selector --------------------------------
  const renderWsBadge = () => (
    <span className="input-shell flex items-center gap-1.5 font-semibold text-success px-3 py-1.5 text-sm cursor-default select-none">
      <span
        className={`inline-block h-2 w-2 rounded-full ${wsConnected ? "bg-success animate-pulse" : "bg-success/50"}`}
      />
      WS
    </span>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col gap-2 px-3 py-2.5">
        {/* Row 1: Method select (or WS badge) + action button */}
        <div className="flex items-center gap-2">
          {isWs ? (
            renderWsBadge()
          ) : (
            <div className="relative">
              <select
                value={method}
                onChange={(e) =>
                  handleMethodChange(e.target.value as HttpMethod)
                }
                className={`input-shell appearance-none pr-7 font-semibold ${MethodStyles[method as HttpMethod]}`}
              >
                {methods.map((m) => (
                  <option
                    key={m}
                    value={m}
                    className="bg-panel text-text-primary"
                  >
                    {m}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary"
              />
            </div>
          )}

          {isWs ? (
            renderWsButton()
          ) : (
            <button
              onClick={sendActiveRequest}
              disabled={tab.isSending}
              className="rounded-md bg-brand-gradient px-5 py-1.5 text-sm font-medium text-white shadow-panel hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {tab.isSending ? "Sending…" : "Send"}
            </button>
          )}
        </div>

        {/* Row 2: URL input (full width) */}
        <UrlAutocompleteInput
          url={tab.request.url}
          onChange={(url) => updateActiveRequest({ url })}
          onEnter={isWs ? connectWebSocket : sendActiveRequest}
          disabled={tab.isSending || wsConnected}
        />
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="flex items-center gap-2 px-4 py-3">
      {isWs ? (
        renderWsBadge()
      ) : (
        <div className="relative">
          <select
            value={tab.request.method}
            onChange={(e) => handleMethodChange(e.target.value as HttpMethod)}
            className={`input-shell appearance-none pr-7 font-semibold ${MethodStyles[tab.request.method as HttpMethod]}`}
          >
            {methods.map((m) => (
              <option key={m} value={m} className="bg-panel text-text-primary">
                {m}
              </option>
            ))}
          </select>
          <ChevronDown
            size={13}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary"
          />
        </div>
      )}

      <UrlAutocompleteInput
        url={tab.request.url}
        onChange={(url) => updateActiveRequest({ url })}
        onEnter={isWs ? connectWebSocket : sendActiveRequest}
        disabled={tab.isSending || wsConnected}
      />

      {isWs ? (
        renderWsButton()
      ) : (
        <button
          onClick={sendActiveRequest}
          disabled={tab.isSending}
          className="rounded-md bg-brand-gradient px-5 py-1.5 text-sm font-medium text-white shadow-panel hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {tab.isSending ? "Sending…" : "Send"}
        </button>
      )}
    </div>
  );
}
