import { useState, useEffect, useRef, useMemo } from "react";
import {
  Zap,
  Play,
  Square,
  Loader2,
  RefreshCw,
  BookOpen,
  Layers,
  ChevronDown,
  Check,
} from "lucide-react";
import { RequestTab } from "../../types";
import { useVartaStore } from "../../store/vartaStore";
import { UrlAutocompleteInput } from "../RequestEditor/RequestBar";
import { parseDocumentOperations } from "./queryGenerator";

interface GraphQlAddressBarProps {
  tab: RequestTab;
  isMobile?: boolean;
}

export default function GraphQlAddressBar({
  tab,
  isMobile = false,
}: GraphQlAddressBarProps) {
  const callStatus = useVartaStore((s) => s.graphqlCallStatus);
  const schemaLoading = useVartaStore((s) => s.graphqlSchemaLoading);
  const loadSchema = useVartaStore((s) => s.loadGraphqlSchema);
  const invokeGraphql = useVartaStore((s) => s.invokeGraphql);
  const subscribeGraphql = useVartaStore((s) => s.subscribeGraphql);
  const cancelSub = useVartaStore((s) => s.cancelGraphqlSubscription);
  const updateActiveRequest = useVartaStore((s) => s.updateActiveRequest);

  // Docs drawer — stored locally here, passed down via custom event
  const openDocs = () => window.dispatchEvent(new CustomEvent("graphql:open-docs"));

  const url = (tab.request as any).url ?? "";
  const query = (tab.request as any).query ?? "";
  const requestType = (tab.request as any).requestType ?? "query";
  const operationName =
    (tab.request as any).operationName ??
    (tab.request as any).operation_name ??
    "";

  // Parse all named operations in the document
  const docOperations = useMemo(() => parseDocumentOperations(query), [query]);
  const activeOp = docOperations.find((o) => o.name === operationName) ?? docOperations[0];
  console.log("activeOp", activeOp)

  const isSubscription = (activeOp ? activeOp.type === "subscription" : requestType === "subscription");
  const isActive = callStatus === "sending" || callStatus === "streaming";

  const handleSend = () => {
    // If an operation is found, ensure it is set on the request state before running
    if (activeOp && activeOp.name !== operationName) {
      updateActiveRequest({
        operationName: activeOp.name,
        operation_name: activeOp.name,
        requestType: activeOp.type,
      } as any);
    }

    if (isSubscription) {
      subscribeGraphql();
    } else {
      invokeGraphql();
    }
  };

  const canSend = url.trim() && !isActive;

  const handleSelectOp = (op: { name: string; type: "query" | "mutation" | "subscription" }) => {
    updateActiveRequest({
      operationName: op.name,
      operation_name: op.name,
      requestType: op.type,
    } as any);
  };

  const operationSelector = (
    <GraphQlOperationDropdown
      docOperations={docOperations}
      activeOp={activeOp}
      onSelect={handleSelectOp}
    />
  );

  if (isMobile) {
    return (
      <div className="flex flex-col gap-2 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <GraphQlBadge />
          {operationSelector}
          <div className="ml-auto flex items-center gap-2">
            <IntrospectButton loading={schemaLoading} disabled={!url.trim()} onClick={loadSchema} />
            <DocsButton onClick={openDocs} />
            {isActive && isSubscription ? (
              <CancelButton onClick={cancelSub} />
            ) : (
              <SendButton
                isSubscription={isSubscription}
                disabled={!canSend}
                onClick={handleSend}
                isSending={callStatus === "sending"}
                operationName={activeOp?.name}
              />
            )}
          </div>
        </div>
        <UrlAutocompleteInput
          url={url}
          onChange={(u) => updateActiveRequest({ url: u } as any)}
          onEnter={loadSchema}
          disabled={isActive}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <GraphQlBadge />

      <UrlAutocompleteInput
        url={url}
        onChange={(u) => updateActiveRequest({ url: u } as any)}
        onEnter={loadSchema}
        disabled={isActive}
      />

      {operationSelector}

      <IntrospectButton loading={schemaLoading} disabled={!url.trim()} onClick={loadSchema} />
      <DocsButton onClick={openDocs} />

      {isActive && isSubscription ? (
        <CancelButton onClick={cancelSub} />
      ) : (
        <SendButton
          isSubscription={isSubscription}
          disabled={!canSend}
          onClick={handleSend}
          isSending={callStatus === "sending"}
          operationName={docOperations.length > 1 ? activeOp?.name : undefined}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GraphQlBadge() {
  return (
    <span className="input-shell flex items-center gap-1.5 font-semibold text-method-graphql px-3 py-1.5 text-sm cursor-default select-none">
      <Zap size={12} className="fill-method-graphql" />
      GraphQL
    </span>
  );
}

function IntrospectButton({
  loading,
  disabled,
  onClick,
}: {
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-panel-raised hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      title="Fetch schema via introspection"
    >
      {loading ? (
        <Loader2 size={13} className="animate-spin" />
      ) : (
        <RefreshCw size={13} />
      )}
      {loading ? "Fetching…" : "Introspect"}
    </button>
  );
}

function DocsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-panel-raised hover:text-method-graphql hover:border-method-graphql/40 transition-colors"
      title="Open schema docs drawer"
    >
      <BookOpen size={13} />
      Docs
    </button>
  );
}

function SendButton({
  isSubscription,
  disabled,
  onClick,
  isSending,
  operationName,
}: {
  isSubscription: boolean;
  disabled: boolean;
  onClick: () => void;
  isSending: boolean;
  operationName?: string;
}) {
  const label = isSubscription
    ? operationName
      ? `Subscribe (${operationName})`
      : "Subscribe"
    : operationName
      ? `Send (${operationName})`
      : "Send";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-semibold text-white shadow-panel hover:opacity-90 disabled:opacity-60 transition-opacity cursor-pointer shrink-0"
      style={{
        background: isSubscription
          ? "linear-gradient(90deg, #E10098 0%, #FF6B9D 100%)"
          : "linear-gradient(90deg, #E10098 0%, #8B5CF6 100%)",
      }}
      title={operationName ? `Execute operation: ${operationName}` : undefined}
    >
      {isSending ? (
        <Loader2 size={13} className="animate-spin" />
      ) : (
        <Play size={12} fill="currentColor" />
      )}
      <span>{label}</span>
    </button>
  );
}

function CancelButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md bg-error/90 px-5 py-1.5 text-sm font-medium text-white shadow-panel hover:bg-error transition-colors"
    >
      <Square size={13} fill="currentColor" />
      Cancel
    </button>
  );
}

// ── Operation Dropdown (styled like WorkspaceSelector) ────────────────────────

interface OperationDropdownProps {
  docOperations: { name: string; type: "query" | "mutation" | "subscription" }[];
  activeOp?: { name: string; type: "query" | "mutation" | "subscription" };
  onSelect: (op: { name: string; type: "query" | "mutation" | "subscription" }) => void;
}

function GraphQlOperationDropdown({
  docOperations,
  activeOp,
  onSelect,
}: OperationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen]);

  if (docOperations.length <= 1) return null;

  const currentOp = activeOp ?? docOperations[0];

  const getTypeBadge = (type: "query" | "mutation" | "subscription") => {
    switch (type) {
      case "query":
        return "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30";
      case "mutation":
        return "bg-amber-500/15 text-amber-400 border border-amber-500/30";
      case "subscription":
        return "bg-method-graphql/15 text-method-graphql border border-method-graphql/30";
    }
  };

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      {/* Active Op Trigger Button styled like WorkspaceSelector */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium rounded-md bg-panel border border-border text-text-primary hover:border-primary/60 transition-all duration-200 cursor-pointer shadow-2xs"
        title="Select which operation to run from document"
      >
        <div className="flex items-center gap-1.5 truncate max-w-[190px]">
          <Layers size={13} className="text-method-graphql shrink-0" />
          <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider shrink-0">
            Op:
          </span>
          <span className="font-mono text-xs font-semibold text-text-primary truncate">
            {currentOp?.name}
          </span>
          {currentOp && (
            <span
              className={`text-[9px] uppercase px-1 py-0.2 rounded font-bold shrink-0 ${getTypeBadge(
                currentOp.type
              )}`}
            >
              {currentOp.type}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-text-secondary transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""
            }`}
        />
      </button>

      {/* Dropdown Menu Overlay styled like WorkspaceSelector */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 z-50 min-w-[220px] rounded-lg bg-panel-raised border border-border shadow-elevated overflow-hidden animate-in fade-in duration-100">
          <div className="px-3 py-1.5 border-b border-border bg-panel/50 text-[10px] uppercase font-bold text-text-muted tracking-wider flex items-center justify-between">
            <span>Document Operations</span>
            <span className="text-text-muted font-normal">
              {docOperations.length} found
            </span>
          </div>

          <div className="max-h-60 overflow-y-auto py-1 scrollbar-thin">
            {docOperations.map((op) => {
              const isSelected = currentOp?.name === op.name;
              return (
                <button
                  key={op.name}
                  type="button"
                  onClick={() => {
                    onSelect(op);
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between w-full px-3 py-2 text-xs text-left transition-all duration-150 cursor-pointer ${isSelected
                    ? "bg-panel text-text-primary font-semibold"
                    : "text-text-secondary hover:bg-panel/70 hover:text-text-primary"
                    }`}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span
                      className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold shrink-0 ${getTypeBadge(
                        op.type
                      )}`}
                    >
                      {op.type}
                    </span>
                    <span className="font-mono text-xs truncate">
                      {op.name}
                    </span>
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
