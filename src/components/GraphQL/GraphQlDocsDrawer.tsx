import { useState, useEffect, useRef } from "react";
import {
  X,
  Search,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  Layers,
  Zap,
  Check,
  Radio,
  Pencil,
  BookOpen,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { useVartaStore } from "../../store/vartaStore";
import {
  GraphQlSchemaType,
  GraphQlSchemaField,
} from "../../types";
import {
  formatTypeRef,
  getNamedTypeName,
  generateOperation,
  GeneratedOperation,
} from "./queryGenerator";
import InsertQueryModal from "./InsertQueryModal";

// ── Type kind styling ─────────────────────────────────────────────────────────

function KindBadge({ kind }: { kind: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    OBJECT: {
      label: "Object",
      cls: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    },
    SCALAR: {
      label: "Scalar",
      cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    },
    ENUM: {
      label: "Enum",
      cls: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    },
    INTERFACE: {
      label: "Interface",
      cls: "text-sky-400 bg-sky-500/10 border-sky-500/20",
    },
    UNION: {
      label: "Union",
      cls: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    },
    INPUT_OBJECT: {
      label: "Input",
      cls: "text-slate-400 bg-slate-500/10 border-slate-500/20",
    },
  };
  const c = cfg[kind] ?? {
    label: kind,
    cls: "text-text-muted bg-panel-raised border-border",
  };
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${c.cls}`}
    >
      {c.label}
    </span>
  );
}

// ── FieldRow ─────────────────────────────────────────────────────────────────

function FieldRow({
  field,
  opType,
  onTypeClick,
  onInsertClick,
}: {
  field: GraphQlSchemaField;
  opType?: "query" | "mutation" | "subscription";
  onTypeClick: (name: string) => void;
  onInsertClick: (
    field: GraphQlSchemaField,
    opType: "query" | "mutation" | "subscription"
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  const typeName = getNamedTypeName(field.typeRef);
  const hasArgs = field.args.length > 0;
  const hasRequiredArgs = field.args.some((a) => a.typeRef.kind === "NON_NULL");

  const effectiveOpType = opType ?? "query";

  return (
    <div className="border-b border-border/40 last:border-0 hover:bg-panel-raised/30 transition-colors group">
      <div className="flex items-start gap-2 px-4 py-2.5">
        {/* Toggle chevron */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="mt-0.5 p-0.5 rounded text-text-muted hover:text-text-primary hover:bg-panel-raised transition-colors shrink-0"
          title={open ? "Collapse details" : "Expand details"}
        >
          {open ? (
            <ChevronDown size={13} />
          ) : (
            <ChevronRight size={13} className="text-text-muted/70" />
          )}
        </button>

        {/* Field Details */}
        <div className="flex-1 min-w-0" onClick={() => setOpen((o) => !o)}>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-xs font-semibold text-text-primary">
              {field.name}
            </span>

            {/* Required args indicator */}
            {hasArgs && (
              <span
                className={`text-[10px] font-mono px-1 rounded ${
                  hasRequiredArgs
                    ? "bg-warning/15 text-warning font-semibold"
                    : "text-text-muted bg-panel-raised"
                }`}
                title={
                  hasRequiredArgs
                    ? "Has required arguments"
                    : `${field.args.length} optional argument(s)`
                }
              >
                ({field.args.length} arg{field.args.length !== 1 ? "s" : ""}
                {hasRequiredArgs ? "*" : ""})
              </span>
            )}

            {field.isDeprecated && (
              <span className="text-[9px] font-bold uppercase text-error bg-error/10 px-1 py-0.5 rounded border border-error/20">
                deprecated
              </span>
            )}

            <span className="text-text-muted text-xs">:</span>

            {/* Return Type Clickable */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTypeClick(typeName);
              }}
              className="font-mono text-xs text-method-graphql hover:underline font-medium hover:text-primary transition-colors"
              title={`View ${typeName} definition`}
            >
              {formatTypeRef(field.typeRef)}
            </button>
          </div>

          {/* Quick description preview */}
          {field.description && !open && (
            <p className="text-[11px] text-text-muted line-clamp-1 mt-0.5">
              {field.description}
            </p>
          )}
        </div>

        {/* Quick "Insert into Editor" Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onInsertClick(field, effectiveOpType);
          }}
          className="flex items-center gap-1 px-2 py-1 rounded bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/20 hover:border-primary text-[10px] font-medium transition-all shrink-0 cursor-pointer shadow-xs"
          title={`Generate and insert ${field.name} ${effectiveOpType} into editor`}
        >
          <Sparkles size={11} />
          <span>Insert</span>
        </button>
      </div>

      {/* Expanded details (Arguments, Full Description, Deprecations) */}
      {open && (
        <div className="px-9 pb-3 pt-1 space-y-2.5 bg-panel-raised/20 border-t border-border/20 text-xs animate-in fade-in duration-100">
          {field.description && (
            <p className="text-text-secondary leading-relaxed text-[11px]">
              {field.description}
            </p>
          )}

          {field.deprecationReason && (
            <div className="flex items-start gap-1.5 p-2 rounded bg-error/10 border border-error/20 text-error text-[11px]">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <span>{field.deprecationReason}</span>
            </div>
          )}

          {hasArgs && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Arguments
              </div>
              <div className="space-y-1 bg-panel/60 p-2 rounded-lg border border-border/40 font-mono text-[11px]">
                {field.args.map((arg) => {
                  const isRequired = arg.typeRef.kind === "NON_NULL";
                  const argTypeName = getNamedTypeName(arg.typeRef);

                  return (
                    <div
                      key={arg.name}
                      className="flex items-start gap-1.5 py-0.5 flex-wrap"
                    >
                      <span className="text-text-primary font-semibold">
                        {arg.name}
                      </span>
                      {isRequired && (
                        <span
                          className="text-error font-bold"
                          title="Required argument"
                        >
                          *
                        </span>
                      )}
                      <span className="text-text-muted">:</span>
                      <button
                        onClick={() => onTypeClick(argTypeName)}
                        className="text-method-graphql hover:underline font-medium"
                      >
                        {formatTypeRef(arg.typeRef)}
                      </button>
                      {arg.defaultValue && (
                        <span className="text-text-muted font-sans text-[10px]">
                          = {arg.defaultValue}
                        </span>
                      )}
                      {arg.description && (
                        <span className="w-full text-text-muted font-sans text-[10px] pl-2 border-l border-border/60 mt-0.5">
                          {arg.description}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── TypeDetail ─────────────────────────────────────────────────────────────────

function TypeDetail({
  type,
  opType,
  onTypeClick,
  onBack,
  onInsertClick,
}: {
  type: GraphQlSchemaType;
  opType?: "query" | "mutation" | "subscription";
  onTypeClick: (name: string) => void;
  onBack: () => void;
  onInsertClick: (
    field: GraphQlSchemaField,
    opType: "query" | "mutation" | "subscription"
  ) => void;
}) {
  const allFields = [
    ...type.fields,
    ...type.inputFields.map((f) => ({
      name: f.name,
      description: f.description,
      typeRef: f.typeRef,
      args: [],
      isDeprecated: false,
      deprecationReason: undefined,
    })),
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Type navigation header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 bg-panel-raised/50 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 rounded p-1 text-text-secondary hover:text-text-primary hover:bg-panel transition-colors text-xs font-medium cursor-pointer"
          title="Back to previous view"
        >
          <ArrowLeft size={14} />
          <span>Back</span>
        </button>
        <KindBadge kind={type.kind} />
        <span className="font-mono text-xs font-bold text-method-graphql truncate">
          {type.name}
        </span>
      </div>

      {/* Type description banner */}
      {type.description && (
        <div className="px-4 py-2 bg-panel-raised/30 border-b border-border/30 text-xs text-text-secondary leading-relaxed">
          {type.description}
        </div>
      )}

      {/* Fields / Values List */}
      <div className="flex-1 overflow-y-auto">
        {/* Enum values */}
        {type.kind === "ENUM" && type.enumValues.length > 0 && (
          <div className="p-4 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Enum Values ({type.enumValues.length})
            </p>
            <div className="space-y-1 divide-y divide-border/20">
              {type.enumValues.map((ev) => (
                <div
                  key={ev.name}
                  className={`text-xs font-mono py-1.5 ${
                    ev.isDeprecated
                      ? "line-through opacity-50 text-text-muted"
                      : "text-text-primary"
                  }`}
                >
                  <span className="font-semibold text-amber-400">{ev.name}</span>
                  {ev.description && (
                    <p className="text-text-muted font-sans text-[11px] mt-0.5">
                      {ev.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fields list */}
        {allFields.length > 0 && (
          <div>
            <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted bg-panel/30 border-b border-border/20">
              Fields ({allFields.length})
            </div>
            {allFields.map((f) => (
              <FieldRow
                key={f.name}
                field={f as any}
                opType={opType}
                onTypeClick={onTypeClick}
                onInsertClick={onInsertClick}
              />
            ))}
          </div>
        )}

        {allFields.length === 0 && type.enumValues.length === 0 && (
          <div className="flex h-40 items-center justify-center text-xs text-text-muted">
            No fields defined for this type
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Docs Drawer ─────────────────────────────────────────────────────────

type RootFilter = "all" | "queries" | "mutations" | "subscriptions";

export default function GraphQlDocsDrawer() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<GraphQlSchemaType | null>(
    null
  );
  const [history, setHistory] = useState<GraphQlSchemaType[]>([]);
  const [activeFilter, setActiveFilter] = useState<RootFilter>("all");

  // State for interactive Insert Modal
  const [insertModalOp, setInsertModalOp] = useState<GeneratedOperation | null>(
    null
  );
  const [insertFieldDesc, setInsertFieldDesc] = useState<string | undefined>();
  const [insertSuccessToast, setInsertSuccessToast] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const schema = useVartaStore((s) => s.graphqlSchema);
  const schemaLoading = useVartaStore((s) => s.graphqlSchemaLoading);

  // Listen for the custom open event from the address bar
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("graphql:open-docs", handler);
    return () => window.removeEventListener("graphql:open-docs", handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open && !insertModalOp) setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, insertModalOp]);

  if (!open) return null;

  const types = schema?.types ?? [];
  const queryType = schema?.types.find((t) => t.name === schema?.queryType);
  const mutationType = schema?.types.find(
    (t) => t.name === schema?.mutationType
  );
  const subscriptionType = schema?.types.find(
    (t) => t.name === schema?.subscriptionType
  );

  const handleTypeClick = (name: string) => {
    const found = types.find((t) => t.name === name);
    if (!found) return;
    if (selectedType) setHistory((h) => [...h, selectedType]);
    setSelectedType(found);
  };

  const handleBack = () => {
    const prev = history[history.length - 1] ?? null;
    setHistory((h) => h.slice(0, -1));
    setSelectedType(prev);
  };

  const handleOpenInsertModal = (
    field: GraphQlSchemaField,
    opType: "query" | "mutation" | "subscription"
  ) => {
    const generated = generateOperation(field, opType, schema);
    setInsertModalOp(generated);
    setInsertFieldDesc(field.description);
  };

  const handleInsertSuccess = () => {
    setInsertSuccessToast(true);
    setTimeout(() => setInsertSuccessToast(false), 2500);
  };

  // Determine current operation type context when inspecting a root type
  const currentOpType: "query" | "mutation" | "subscription" | undefined =
    selectedType?.name === schema?.queryType
      ? "query"
      : selectedType?.name === schema?.mutationType
      ? "mutation"
      : selectedType?.name === schema?.subscriptionType
      ? "subscription"
      : undefined;

  // Filter types based on search and active tab
  const filteredTypes = types.filter((t) => {
    if (activeFilter === "queries" && t.name !== schema?.queryType) return false;
    if (activeFilter === "mutations" && t.name !== schema?.mutationType)
      return false;
    if (activeFilter === "subscriptions" && t.name !== schema?.subscriptionType)
      return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.fields.some((f) => f.name.toLowerCase().includes(q))
    );
  });

  return (
    <>
      <div className="fixed right-0 top-0 bottom-0 z-40 flex">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 -left-[100vw] backdrop-blur-2xs"
          onClick={() => setOpen(false)}
        />

        {/* Drawer panel — width expanded for readability */}
        <div className="relative z-50 flex flex-col bg-panel border-l border-border shadow-elevated w-[440px] max-w-[95vw]">
          {/* Drawer Top Bar */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-panel-raised/50 shrink-0">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-method-graphql" />
              <h2 className="text-sm font-semibold text-text-primary">
                GraphQL Schema Docs
              </h2>
              {schema && (
                <span className="text-[10px] bg-panel-raised px-1.5 py-0.5 rounded text-text-muted border border-border">
                  {types.length} types
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-panel transition-colors"
              title="Close drawer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Success toast banner */}
          {insertSuccessToast && (
            <div className="px-4 py-2 bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-1.5 animate-in slide-in-from-top-2 duration-150">
              <Check size={14} />
              <span className="font-semibold">Operation inserted into Request Editor!</span>
            </div>
          )}

          {/* Root Operation Shortcut Pills */}
          {schema && !selectedType && (
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-panel-raised/20 overflow-x-auto scrollbar-hide shrink-0">
              <button
                onClick={() => setActiveFilter("all")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  activeFilter === "all"
                    ? "bg-primary text-white shadow-xs"
                    : "text-text-secondary hover:bg-panel hover:text-text-primary"
                }`}
              >
                All Types
              </button>

              {queryType && (
                <button
                  onClick={() => {
                    setActiveFilter("all");
                    handleTypeClick(queryType.name);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all"
                >
                  <Search size={11} />
                  <span>Query ({queryType.fields.length})</span>
                </button>
              )}

              {mutationType && (
                <button
                  onClick={() => {
                    setActiveFilter("all");
                    handleTypeClick(mutationType.name);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all"
                >
                  <Pencil size={11} />
                  <span>Mutation ({mutationType.fields.length})</span>
                </button>
              )}

              {subscriptionType && (
                <button
                  onClick={() => {
                    setActiveFilter("all");
                    handleTypeClick(subscriptionType.name);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-method-graphql bg-method-graphql/10 border border-method-graphql/20 hover:bg-method-graphql/20 transition-all"
                >
                  <Radio size={11} />
                  <span>Subscription ({subscriptionType.fields.length})</span>
                </button>
              )}
            </div>
          )}

          {/* Content Area */}
          {selectedType ? (
            <div className="flex-1 overflow-hidden">
              <TypeDetail
                type={selectedType}
                opType={currentOpType}
                onTypeClick={handleTypeClick}
                onBack={handleBack}
                onInsertClick={handleOpenInsertModal}
              />
            </div>
          ) : (
            <>
              {/* Search Bar */}
              <div className="p-3 border-b border-border bg-panel shrink-0">
                <div className="flex items-center gap-2 rounded-lg bg-bg border border-border px-3 py-1.5 focus-within:border-primary transition-colors">
                  <Search size={13} className="text-text-muted shrink-0" />
                  <input
                    ref={inputRef}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search operations, types, or fields…"
                    className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-muted outline-none"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="text-text-muted hover:text-text-primary p-0.5 rounded"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Types List */}
              <div className="flex-1 overflow-y-auto divide-y divide-border/30">
                {schemaLoading && (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs text-text-muted">
                    <Zap
                      size={16}
                      className="text-method-graphql animate-pulse"
                    />
                    <span>Loading introspection schema…</span>
                  </div>
                )}

                {!schemaLoading && !schema && (
                  <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                    <div className="h-12 w-12 rounded-full bg-method-graphql/10 border border-method-graphql/20 flex items-center justify-center">
                      <Layers size={22} className="text-method-graphql" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-text-primary">
                        No Schema Loaded
                      </p>
                      <p className="text-[11px] text-text-muted max-w-xs leading-relaxed">
                        Enter your GraphQL endpoint above and click{" "}
                        <span className="font-semibold text-text-secondary">
                          Introspect
                        </span>{" "}
                        to explore types, queries, and mutations.
                      </p>
                    </div>
                  </div>
                )}

                {!schemaLoading &&
                  filteredTypes.map((t) => {
                    const isQuery = t.name === schema?.queryType;
                    const isMutation = t.name === schema?.mutationType;
                    const isSubscription = t.name === schema?.subscriptionType;
                    const isRoot = isQuery || isMutation || isSubscription;

                    return (
                      <button
                        key={t.name}
                        onClick={() => handleTypeClick(t.name)}
                        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs hover:bg-panel-raised transition-colors cursor-pointer ${
                          isRoot ? "bg-panel-raised/40 font-medium" : ""
                        }`}
                      >
                        <KindBadge kind={t.kind} />
                        <span
                          className={`font-mono text-xs ${
                            isQuery
                              ? "text-cyan-400 font-bold"
                              : isMutation
                              ? "text-amber-400 font-bold"
                              : isSubscription
                              ? "text-method-graphql font-bold"
                              : "text-text-primary"
                          }`}
                        >
                          {t.name}
                        </span>

                        {isRoot && (
                          <span
                            className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                              isQuery
                                ? "text-cyan-400 bg-cyan-500/10 border-cyan-500/30"
                                : isMutation
                                ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
                                : "text-method-graphql bg-method-graphql/10 border-method-graphql/30"
                            }`}
                          >
                            Root
                          </span>
                        )}

                        <span className="ml-auto flex items-center gap-1.5 text-text-muted text-[11px]">
                          {t.fields.length > 0 && (
                            <span>
                              {t.fields.length} field
                              {t.fields.length !== 1 ? "s" : ""}
                            </span>
                          )}
                          <ChevronRight size={13} />
                        </span>
                      </button>
                    );
                  })}

                {!schemaLoading && schema && filteredTypes.length === 0 && (
                  <div className="flex h-32 items-center justify-center text-xs text-text-muted">
                    No types match "{search}"
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Interactive Insert Query Modal */}
      {insertModalOp && (
        <InsertQueryModal
          operation={insertModalOp}
          fieldDescription={insertFieldDesc}
          isOpen={Boolean(insertModalOp)}
          onClose={() => setInsertModalOp(null)}
          onSuccess={handleInsertSuccess}
        />
      )}
    </>
  );
}
