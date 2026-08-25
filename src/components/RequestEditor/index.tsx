import { useEffect, useState } from "react";
import { RequestTab } from "../../types";
import { useVartaStore } from "../../store/vartaStore";
import TabStrip from "./TabStrip";
import RequestBar from "./RequestBar";
import KeyValueTable from "./KeyValueTable";
import CookiesTab from "./CookiesTab";
import AuthTab from "./AuthTab";
import BodyTab from "./BodyTab";
import EmptyState from "../EmptyState";
import SavedWSTab from "./SavedWSTab";

type SubTab = "params" | "headers" | "cookies" | "auth" | "body" | "saved";

const HTTP_SUB_TABS: { id: SubTab; label: string }[] = [
  { id: "params", label: "Params" },
  { id: "headers", label: "Headers" },
  { id: "cookies", label: "Cookies" },
  { id: "auth", label: "Authorization" },
  { id: "body", label: "Body" },
];

const WS_SUB_TABS: { id: SubTab; label: string }[] = [
  { id: "params", label: "Params" },
  { id: "headers", label: "Headers" },
  { id: "saved", label: "Saved" },
];

function RequestPanel({
  tab,
  isMobile,
}: {
  tab: RequestTab;
  isMobile: boolean;
}) {
  const [subTab, setSubTab] = useState<SubTab>("params");
  const updateActiveRequest = useVartaStore((s) => s.updateActiveRequest);
  const saveActiveRequest = useVartaStore((s) => s.saveActiveRequest);

  const isWs = tab.request.method === "WS";
  const visibleTabs = isWs ? WS_SUB_TABS : HTTP_SUB_TABS;

  // If the current sub-tab is hidden (e.g. "body" while in WS mode), reset.
  const activeSubTab = visibleTabs.find((t) => t.id === subTab)
    ? subTab
    : visibleTabs[0].id;

  // Global Keydown Listener for Save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault(); // Block browser "Save Page" dialog
        saveActiveRequest();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveActiveRequest]);

  if (tab.request.type === "grpc") {
    return null;
  }
  return (
    <div className="flex h-full flex-col">
      <RequestBar tab={tab} isMobile={isMobile} />

      {/* Sub-tabs — scrollable on mobile */}
      <div
        className={`flex gap-1 border-b border-border ${
          isMobile ? "overflow-x-auto scrollbar-hide px-2" : "px-4"
        }`}
      >
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`tab-trigger shrink-0 ${activeSubTab === t.id ? "tab-trigger-active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeSubTab === "params" && (
          <KeyValueTable
            rows={tab.request.params}
            onChange={(rows) => updateActiveRequest({ params: rows })}
            keyPlaceholder="Key"
            valuePlaceholder="Value"
            isMobile={isMobile}
          />
        )}
        {activeSubTab === "headers" && (
          <KeyValueTable
            rows={tab.request.headers}
            onChange={(rows) => updateActiveRequest({ headers: rows })}
            keyPlaceholder="Key"
            valuePlaceholder="Value"
            suggestKeys
            isMobile={isMobile}
          />
        )}

        {activeSubTab === "saved" && (
          <SavedWSTab tab={tab} isMobile={isMobile} />
        )}

        {/*<button
          onClick={() => setSubTab("saved")}
          className={`tab-trigger shrink-0 ${subTab === "saved" ? "tab-trigger-active" : ""}`}
        >
          <Bookmark size={12} className="inline mr-1" />
          Saved
          {tab.wsSavedMessages.length > 0 && (
            <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary">
              {tab.wsSavedMessages.length}
            </span>
          )}
        </button>*/}
        {activeSubTab === "cookies" && (
          <CookiesTab
            rows={tab.request.cookies}
            onChange={(rows) => updateActiveRequest({ cookies: rows })}
            isMobile={isMobile}
          />
        )}
        {activeSubTab === "auth" && (
          <AuthTab
            auth={tab.request.auth}
            onChange={(auth) => updateActiveRequest({ auth })}
            isMobile={isMobile}
          />
        )}
        {activeSubTab === "body" && (
          <BodyTab
            body={{
              ...tab.request.body,
              mode: tab.request.body?.mode || "raw",
              // Safely map the files if they exist to include id and sizeBytes
              files: tab.request.body?.files?.map((file) => ({
                ...file,
                id: file.id || crypto.randomUUID(), // Fallback ID if missing
                sizeBytes: file.sizeBytes || BigInt(0), // Fallback size if missing
              })),
            }}
            onChange={(body) => updateActiveRequest({ body })}
            isMobile={isMobile}
          />
        )}
      </div>
    </div>
  );
}

interface RequestEditorProps {
  isMobile?: boolean;
}

export default function RequestEditor({
  isMobile = false,
}: RequestEditorProps) {
  const tabs = useVartaStore((s) => s.tabs);
  const activeTabId = useVartaStore((s) => s.activeTabId);
  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="flex h-full flex-1 flex-col bg-bg">
      <TabStrip />
      {activeTab ? (
        <RequestPanel tab={activeTab} isMobile={isMobile} />
      ) : (
        <EmptyState isMobile={isMobile} />
      )}
    </div>
  );
}
