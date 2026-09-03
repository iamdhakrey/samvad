import { useEffect } from "react";
import { useVartaStore } from "../../store/vartaStore";
import TabStrip from "../RequestEditor/TabStrip";
import GraphQlAddressBar from "./GraphQlAddressBar";
import GraphQlRequestPanel from "./GraphQlRequestPanel";
import GraphQlResponsePanel from "./GraphQlResponsePanel";
import GraphQlDocsDrawer from "./GraphQlDocsDrawer";

interface GraphQlEditorProps {
  isMobile?: boolean;
}

export default function GraphQlEditor({ isMobile = false }: GraphQlEditorProps) {
  const activeTab = useVartaStore((s) => s.activeTab);
  const saveActiveRequest = useVartaStore((s) => s.saveActiveRequest);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveActiveRequest();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveActiveRequest]);

  if (!activeTab) return null;

  return (
    <div className="flex h-full flex-1 flex-col bg-bg">
      <TabStrip />

      {/* Top Bar: Endpoint URL + action buttons */}
      <div className="shrink-0 border-b border-border bg-panel">
        <GraphQlAddressBar isMobile={isMobile} tab={activeTab} />
      </div>

      {/* Main workspace: request (left) + response (right) */}
      <div
        className={`flex flex-1 overflow-hidden ${isMobile ? "flex-col" : "flex-row"}`}
      >
        {/* Left / Top pane: Query, Variables, Headers tabs */}
        <div
          className={`flex flex-1 flex-col min-w-0 bg-bg ${isMobile ? "border-b border-border" : "border-r border-border"
            }`}
        >
          <GraphQlRequestPanel isMobile={isMobile} />
        </div>

        {/* Right / Bottom pane: Response viewer */}
        <div className="flex flex-1 flex-col min-w-0 bg-bg">
          <GraphQlResponsePanel isMobile={isMobile} />
        </div>
      </div>

      {/* Slide-out Docs Drawer (schema browser) */}
      <GraphQlDocsDrawer />
    </div>
  );
}
