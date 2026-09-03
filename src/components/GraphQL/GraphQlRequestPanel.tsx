import { useState, useEffect, useRef, useMemo } from "react";
import {
  Plus,
  Trash2,
  Sparkles,
  Search,
  Code2,
  LayoutGrid,
  List,
} from "lucide-react";
import Editor, { useMonaco } from "@monaco-editor/react";
import { useVartaStore } from "../../store/vartaStore";
import {
  useSettingsStore,
  DEFAULT_FONT_SETTINGS,
} from "../../store/settingStore";
import { GraphQlHeaderRow, GraphQlSchemaField } from "../../types";
import AuthTab from "../RequestEditor/AuthTab";
import { registerGraphQlCompletionProvider } from "./graphqlCompletion";
import InsertQueryModal from "./InsertQueryModal";
import {
  generateOperation,
  GeneratedOperation,
  formatTypeRef,
  parseDocumentOperations,
} from "./queryGenerator";

type GqlReqTab = "query" | "variables" | "headers" | "auth";

const TABS: { id: GqlReqTab; label: string }[] = [
  { id: "query", label: "Query" },
  { id: "variables", label: "Variables" },
  { id: "headers", label: "Headers" },
  { id: "auth", label: "Auth" },
];

interface Props {
  isMobile?: boolean;
}

// Initialize monaco-graphql language extension once
let graphqlLangInitialized = false;
function ensureGraphQlLanguage() {
  if (graphqlLangInitialized) return;
  graphqlLangInitialized = true;
  import("monaco-graphql").catch(() => {
    // graceful fallback
  });
}

export default function GraphQlRequestPanel({ isMobile = false }: Props) {
  const [activeTab, setActiveTab] = useState<GqlReqTab>("query");
  const [activeOpFilter, setActiveOpFilter] = useState<
    "queries" | "mutations" | "subscriptions"
  >("queries");
  const [chipSearch, setChipSearch] = useState("");
  const [showQuickToolbar, setShowQuickToolbar] = useState(true);

  // Modal state for interactive insertion
  const [insertModalOp, setInsertModalOp] = useState<GeneratedOperation | null>(
    null
  );
  const [insertFieldDesc, setInsertFieldDesc] = useState<string | undefined>();

  const updateActiveRequest = useVartaStore((s) => s.updateActiveRequest);
  const activeTabData = useVartaStore((s) => s.activeTab);
  const headers = useVartaStore((s) => s.graphqlHeaders);
  const setHeaders = useVartaStore((s) => s.setGraphqlHeaders);
  const schema = useVartaStore((s) => s.graphqlSchema);

  const monaco = useMonaco();

  const settingsFont = useSettingsStore((s) => s.settings?.font);
  const { fontFamily, fontSize, enableLigatures, lineHeight } =
    settingsFont || DEFAULT_FONT_SETTINGS;

  const req = activeTabData?.request as any;
  const query: string = req?.query ?? "{\n  \n}";
  const variables: string = req?.variables ?? "{}";

  const chipsRef = useRef<HTMLDivElement>(null);
  const docOpsRef = useRef<HTMLDivElement>(null);
  const [isWrapMode, setIsWrapMode] = useState(false);

  const docOperations = useMemo(() => parseDocumentOperations(query), [query]);


  // Schema Operations for Quick Suggest Bar
  const queryType = schema?.types.find((t) => t.name === schema?.queryType);
  const mutationType = schema?.types.find(
    (t) => t.name === schema?.mutationType
  );
  const subscriptionType = schema?.types.find(
    (t) => t.name === schema?.subscriptionType
  );

  const availableFields: {
    field: GraphQlSchemaField;
    opType: "query" | "mutation" | "subscription";
  }[] = (() => {
    if (!schema) return [];
    if (activeOpFilter === "queries" && queryType) {
      return queryType.fields.map((f) => ({ field: f, opType: "query" as const }));
    }
    if (activeOpFilter === "mutations" && mutationType) {
      return mutationType.fields.map((f) => ({
        field: f,
        opType: "mutation" as const,
      }));
    }
    if (activeOpFilter === "subscriptions" && subscriptionType) {
      return subscriptionType.fields.map((f) => ({
        field: f,
        opType: "subscription" as const,
      }));
    }
    return [];
  })();

  const filteredFields = chipSearch.trim()
    ? availableFields.filter((item) =>
      item.field.name.toLowerCase().includes(chipSearch.toLowerCase())
    )
    : availableFields;

  // Attach non-passive wheel listener directly so horizontal mouse wheel works in WebKitGTK / Tauri
  useEffect(() => {
    const el = chipsRef.current;
    if (!el || isWrapMode) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [filteredFields, isWrapMode]);

  // Attach non-passive wheel listener to document operations bar
  useEffect(() => {
    const el = docOpsRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [docOperations]);

  useEffect(() => {
    ensureGraphQlLanguage();
  }, []);

  // Register schema-aware autocompletion whenever monaco or schema updates
  useEffect(() => {
    if (!monaco || !schema) return;
    const disposable = registerGraphQlCompletionProvider(monaco, schema);
    return () => disposable.dispose();
  }, [monaco, schema]);

  const addHeaderRow = () => {
    setHeaders([
      ...headers,
      { id: crypto.randomUUID(), key: "", value: "", enabled: true },
    ]);
  };

  const removeHeaderRow = (id: string) => {
    setHeaders(headers.filter((h) => h.id !== id));
  };

  const updateHeaderRow = (
    id: string,
    field: keyof GraphQlHeaderRow,
    value: string | boolean
  ) => {
    setHeaders(
      headers.map((h) => (h.id === id ? { ...h, [field]: value } : h))
    );
  };

  const activeHeaderCount = headers.filter((h) => h.key.trim()).length;

  const handleSelectField = (
    field: GraphQlSchemaField,
    opType: "query" | "mutation" | "subscription"
  ) => {
    const generated = generateOperation(field, opType, schema);
    setInsertModalOp(generated);
    setInsertFieldDesc(field.description);
  };

  const isQueryEmpty =
    !query.trim() || query.trim() === "{\n  \n}" || query.trim() === "{}";

  return (
    <div className="flex h-full flex-col min-w-0">
      {/* Sub-tab strip */}
      <div
        className={`flex gap-1 border-b border-border ${isMobile ? "overflow-x-auto scrollbar-hide px-2" : "px-4"
          }`}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`tab-trigger shrink-0 ${activeTab === t.id ? "tab-trigger-active" : ""
              }`}
          >
            {t.label}
            {t.id === "headers" && activeHeaderCount > 0 && (
              <span className="ml-1.5 rounded-full bg-method-graphql/20 px-1.5 py-0.5 text-[10px] text-method-graphql">
                {activeHeaderCount}
              </span>
            )}
            {t.id === "auth" && req?.auth && req.auth.type !== "none" && (
              <span className="ml-1.5 rounded-full bg-method-graphql/20 px-1.5 py-0.5 text-[10px] text-method-graphql uppercase font-medium">
                {req.auth.type}
              </span>
            )}
          </button>
        ))}

        {/* Schema Status Indicator & Quick Docs trigger */}
        {schema && activeTab === "query" && (
          <div className="ml-auto flex items-center gap-1.5 py-1 text-xs">
            <button
              onClick={() => setShowQuickToolbar((v) => !v)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${showQuickToolbar
                ? "text-primary bg-primary/10"
                : "text-text-muted hover:text-text-primary"
                }`}
              title="Toggle schema suggestions bar"
            >
              <Sparkles size={11} />
              <span>Operations ({availableFields.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden flex flex-col min-w-0">
        {/* Query tab */}
        {activeTab === "query" && (
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Quick Operations Suggestion Bar */}
            {schema && showQuickToolbar && (
              <div className="border-b border-border bg-panel-raised/40 px-3 py-2 shrink-0 space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-wrap sm:flex-nowrap">
                  <div
                    onWheel={(e) => {
                      if (e.deltaY !== 0) e.currentTarget.scrollLeft += e.deltaY;
                    }}
                    className="flex items-center gap-1 overflow-x-auto scrollbar-thin min-w-0 py-0.5"
                  >
                    <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider flex items-center gap-1 shrink-0">
                      <Sparkles size={10} className="text-primary" />
                      Available:
                    </span>
                    {queryType && (
                      <button
                        onClick={() => setActiveOpFilter("queries")}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors shrink-0 ${activeOpFilter === "queries"
                          ? "bg-cyan-500/20 text-cyan-400 font-semibold"
                          : "text-text-secondary hover:text-text-primary"
                          }`}
                      >
                        Queries ({queryType.fields.length})
                      </button>
                    )}
                    {mutationType && (
                      <button
                        onClick={() => setActiveOpFilter("mutations")}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors shrink-0 ${activeOpFilter === "mutations"
                          ? "bg-amber-500/20 text-amber-400 font-semibold"
                          : "text-text-secondary hover:text-text-primary"
                          }`}
                      >
                        Mutations ({mutationType.fields.length})
                      </button>
                    )}
                    {subscriptionType && (
                      <button
                        onClick={() => setActiveOpFilter("subscriptions")}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors shrink-0 ${activeOpFilter === "subscriptions"
                          ? "bg-method-graphql/20 text-method-graphql font-semibold"
                          : "text-text-secondary hover:text-text-primary"
                          }`}
                      >
                        Subscriptions ({subscriptionType.fields.length})
                      </button>
                    )}
                  </div>

                  <div className="ml-auto flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsWrapMode((v) => !v)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${isWrapMode
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "text-text-muted hover:text-text-primary hover:bg-panel border border-transparent"
                        }`}
                      title={
                        isWrapMode
                          ? "Switch to single-line carousel"
                          : "Wrap to show all operations"
                      }
                    >
                      {isWrapMode ? <List size={10} /> : <LayoutGrid size={10} />}
                      <span>{isWrapMode ? "Carousel" : "View All"}</span>
                    </button>

                    {availableFields.length > 5 && (
                      <div className="flex items-center gap-1 bg-bg border border-border/80 px-2 py-0.5 rounded text-[11px]">
                        <Search size={10} className="text-text-muted" />
                        <input
                          value={chipSearch}
                          onChange={(e) => setChipSearch(e.target.value)}
                          placeholder="Filter..."
                          className="bg-transparent text-[11px] text-text-primary placeholder:text-text-muted outline-none w-20"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Operations Chips: Carousel (default) or Wrapped Grid */}
                {isWrapMode ? (
                  <div className="flex items-center gap-1.5 flex-wrap max-h-48 overflow-y-auto scrollbar-thin p-1">
                    {filteredFields.map(({ field, opType }) => (
                      <button
                        key={field.name}
                        onClick={() => handleSelectField(field, opType)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-panel border border-border/80 hover:border-primary hover:bg-panel-raised text-text-secondary hover:text-text-primary text-[11px] font-mono transition-all cursor-pointer group shadow-2xs"
                        title={`${field.name}: ${formatTypeRef(field.typeRef)}${field.description ? ` — ${field.description}` : ""
                          }`}
                      >
                        <span className="text-primary font-bold">+</span>
                        <span>{field.name}</span>
                        {field.args.length > 0 && (
                          <span className="text-[9px] text-text-muted">
                            ({field.args.length})
                          </span>
                        )}
                      </button>
                    ))}
                    {filteredFields.length === 0 && (
                      <span className="text-[11px] text-text-muted italic py-1">
                        No matching operations
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="relative flex items-center min-w-0 group/chips">

                    <div
                      ref={chipsRef}
                      className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide  pt-1.5 pb-3.5 px-1 w-full min-w-0 scroll-smooth flex-nowrap"
                    >
                      {filteredFields.map(({ field, opType }) => (
                        <button
                          key={field.name}
                          onClick={() => handleSelectField(field, opType)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-panel border border-border/80 hover:border-primary hover:bg-panel-raised text-text-secondary hover:text-text-primary text-[11px] font-mono shrink-0 transition-all cursor-pointer group shadow-2xs"
                          title={`${field.name}: ${formatTypeRef(field.typeRef)}${field.description ? ` — ${field.description}` : ""
                            }`}
                        >
                          <span className="text-primary font-bold">+</span>
                          <span>{field.name}</span>
                          {field.args.length > 0 && (
                            <span className="text-[9px] text-text-muted">
                              ({field.args.length})
                            </span>
                          )}
                        </button>
                      ))}
                      {filteredFields.length === 0 && (
                        <span className="text-[11px] text-text-muted italic py-1">
                          No matching operations
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Empty state quick-start card */}
            {schema && isQueryEmpty && (
              <div className="m-3 p-4 rounded-xl border border-primary/20 bg-primary/5 flex flex-col gap-2.5 animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-primary" />
                  <span className="text-xs font-semibold text-text-primary">
                    Schema Introspected! Choose an operation to get started:
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {queryType?.fields.slice(0, 6).map((f) => (
                    <button
                      key={f.name}
                      onClick={() => handleSelectField(f, "query")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-panel border border-border hover:border-primary text-text-primary text-xs font-mono font-medium hover:bg-panel-raised transition-all cursor-pointer shadow-xs"
                    >
                      <Code2 size={12} className="text-primary" />
                      <span>{f.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Monaco Editor */}
            <div className="flex-1 overflow-hidden">
              <Editor
                height="100%"
                language="graphql"
                value={query}
                onChange={(v) => updateActiveRequest({ query: v ?? "" } as any)}
                theme="vs-dark"
                options={{
                  fontFamily,
                  fontSize,
                  lineHeight,
                  fontLigatures: enableLigatures,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  padding: { top: 12, bottom: 12 },
                  wordWrap: "on",
                  tabSize: 2,
                  renderLineHighlight: "none",
                  overviewRulerBorder: false,
                  suggestOnTriggerCharacters: true,
                  quickSuggestions: true,
                }}
              />
            </div>
          </div>
        )}

        {/* Variables tab */}
        {activeTab === "variables" && (
          <Editor
            height="100%"
            language="json"
            value={variables}
            onChange={(v) =>
              updateActiveRequest({ variables: v ?? "{}" } as any)
            }
            theme="vs-dark"
            options={{
              fontFamily,
              fontSize,
              lineHeight,
              fontLigatures: enableLigatures,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              padding: { top: 12, bottom: 12 },
              wordWrap: "on",
              tabSize: 2,
              renderLineHighlight: "none",
              overviewRulerBorder: false,
            }}
          />
        )}

        {/* Headers tab */}
        {activeTab === "headers" && (
          <div className="flex h-full flex-col overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-panel z-10">
                <tr className="border-b border-border text-text-muted">
                  <th className="w-8 px-2 py-2 text-center font-medium">#</th>
                  <th className="px-3 py-2 text-left font-medium">Key</th>
                  <th className="px-3 py-2 text-left font-medium">Value</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {headers.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-b border-border/50 group hover:bg-panel-raised/30 ${!row.enabled ? "opacity-50" : ""
                      }`}
                  >
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={(e) =>
                          updateHeaderRow(row.id, "enabled", e.target.checked)
                        }
                        className="h-3 w-3 cursor-pointer rounded accent-method-graphql"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        value={row.key}
                        placeholder="Header name"
                        onChange={(e) =>
                          updateHeaderRow(row.id, "key", e.target.value)
                        }
                        className="w-full bg-transparent px-2 py-1 font-mono text-xs text-text-primary outline-none placeholder:text-text-muted focus:bg-panel-raised/50 rounded"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        value={row.value}
                        placeholder="Value"
                        onChange={(e) =>
                          updateHeaderRow(row.id, "value", e.target.value)
                        }
                        className="w-full bg-transparent px-2 py-1 font-mono text-xs text-text-primary outline-none placeholder:text-text-muted focus:bg-panel-raised/50 rounded"
                      />
                    </td>
                    <td className="px-2">
                      <button
                        onClick={() => removeHeaderRow(row.id)}
                        className="invisible group-hover:visible rounded p-0.5 text-text-muted hover:text-error transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-border p-2">
              <button
                onClick={addHeaderRow}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-text-secondary hover:bg-panel-raised hover:text-text-primary transition-colors cursor-pointer"
              >
                <Plus size={12} />
                Add Header
              </button>
            </div>
          </div>
        )}

        {/* Auth tab */}
        {activeTab === "auth" && (
          <div className="h-full overflow-y-auto">
            <AuthTab
              auth={
                req?.auth ?? {
                  type: "none",
                  basic: null,
                  bearer: null,
                  apiKey: null,
                }
              }
              onChange={(auth) => updateActiveRequest({ auth } as any)}
              isMobile={isMobile}
            />
          </div>
        )}
      </div>

      {/* Insert Query Modal */}
      {insertModalOp && (
        <InsertQueryModal
          operation={insertModalOp}
          fieldDescription={insertFieldDesc}
          isOpen={Boolean(insertModalOp)}
          onClose={() => setInsertModalOp(null)}
        />
      )}
    </div>
  );
}
