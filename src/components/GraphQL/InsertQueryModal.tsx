import { useState } from "react";
import {
  X,
  Code2,
  Check,
  FileCode2,
  Sparkles,
} from "lucide-react";
import { GeneratedOperation } from "./queryGenerator";
import { useVartaStore } from "../../store/vartaStore";

interface Props {
  operation: GeneratedOperation;
  fieldDescription?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function InsertQueryModal({
  operation,
  fieldDescription,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const [insertMode, setInsertMode] = useState<"replace" | "append">("replace");
  const [includeVariables, setIncludeVariables] = useState<boolean>(
    Boolean(operation.variables)
  );

  const activeTab = useVartaStore((s) => s.activeTab);
  const updateActiveRequest = useVartaStore((s) => s.updateActiveRequest);

  if (!isOpen) return null;

  const currentQuery = (activeTab?.request as any)?.query ?? "";
  const hasExistingQuery =
    currentQuery.trim() && currentQuery.trim() !== "{\n  \n}";

  const opColors = {
    query: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
    mutation: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    subscription: "text-method-graphql bg-method-graphql/10 border-method-graphql/30",
  }[operation.operationType];

  const handleInsert = () => {
    let finalQuery = operation.query;
    if (insertMode === "append" && hasExistingQuery) {
      finalQuery = `${currentQuery.trim()}\n\n${operation.query}`;
    }

    const updates: Record<string, any> = {
      query: finalQuery,
      requestType: operation.operationType,
    };

    if (includeVariables && operation.variables) {
      updates.variables = operation.variables;
    }

    updateActiveRequest(updates as any);
    if (onSuccess) onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-panel border border-border shadow-elevated rounded-xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-panel-raised/50">
          <div className="flex items-center gap-2.5">
            <span
              className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${opColors}`}
            >
              {operation.operationType}
            </span>
            <h3 className="text-sm font-semibold text-text-primary">
              Insert into Request Editor
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-panel transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {fieldDescription && (
            <p className="text-text-secondary bg-panel-raised p-2.5 rounded-lg border border-border/50 leading-relaxed">
              {fieldDescription}
            </p>
          )}

          {/* Insertion Mode Options */}
          {hasExistingQuery && (
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Insertion Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setInsertMode("replace")}
                  className={`flex items-start gap-2 p-3 rounded-lg border text-left transition-all ${
                    insertMode === "replace"
                      ? "border-primary bg-primary/10 text-text-primary"
                      : "border-border bg-panel-raised text-text-secondary hover:border-border/80"
                  }`}
                >
                  <Sparkles
                    size={14}
                    className={
                      insertMode === "replace"
                        ? "text-primary mt-0.5"
                        : "text-text-muted mt-0.5"
                    }
                  />
                  <div>
                    <p className="font-semibold text-xs">Replace Editor</p>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      Clear current editor and insert this operation
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setInsertMode("append")}
                  className={`flex items-start gap-2 p-3 rounded-lg border text-left transition-all ${
                    insertMode === "append"
                      ? "border-primary bg-primary/10 text-text-primary"
                      : "border-border bg-panel-raised text-text-secondary hover:border-border/80"
                  }`}
                >
                  <FileCode2
                    size={14}
                    className={
                      insertMode === "append"
                        ? "text-primary mt-0.5"
                        : "text-text-muted mt-0.5"
                    }
                  />
                  <div>
                    <p className="font-semibold text-xs">Append to Document</p>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      Add below existing query definitions
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Preview: Query */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <Code2 size={12} />
                Generated Operation
              </span>
              <span className="font-mono text-[10px] text-text-muted">
                {operation.operationName}
              </span>
            </div>
            <pre className="p-3 bg-bg border border-border rounded-lg font-mono text-[11px] text-text-primary overflow-x-auto leading-relaxed max-h-48 scrollbar-thin">
              {operation.query}
            </pre>
          </div>

          {/* Variables checkbox & preview */}
          {operation.variables && (
            <div className="space-y-2 pt-1 border-t border-border/50">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeVariables}
                  onChange={(e) => setIncludeVariables(e.target.checked)}
                  className="rounded border-border accent-primary cursor-pointer h-3.5 w-3.5"
                />
                <span className="text-xs font-medium text-text-primary">
                  Populate Variables Tab with template variables
                </span>
              </label>

              {includeVariables && (
                <pre className="p-3 bg-bg border border-border rounded-lg font-mono text-[11px] text-text-secondary overflow-x-auto leading-relaxed max-h-32 scrollbar-thin">
                  {operation.variables}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-panel-raised/50">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-panel transition-colors text-xs font-medium cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleInsert}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white transition-colors text-xs font-medium shadow-panel cursor-pointer"
          >
            <Check size={13} />
            Insert into Editor
          </button>
        </div>
      </div>
    </div>
  );
}
