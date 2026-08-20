import GrpcServicePicker from "./GrpcServicePicker";
import GrpcRequestPanel from "./GrpcRequestPanel";
import GrpcResponsePanel from "./GrpcResponsePanel";
import TabStrip from "../RequestEditor/TabStrip";
import { useEffect } from "react";
import { useVartaStore } from "../../store/vartaStore";
import RequestBar from "./GrpcAddressBar";

interface GrpcEditorProps {
  isMobile?: boolean;
}

export default function GrpcEditor({ isMobile = false }: GrpcEditorProps) {
  const activeTab = useVartaStore((s) => s.activeTab);
  const saveActiveRequest = useVartaStore((s) => s.saveActiveRequest);

  if (!activeTab) return;

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
  return (
    <>
      <div className="flex h-full flex-1 flex-col bg-bg">
        <TabStrip />

        {/* Top Bar: Server Address, TLS, Reflection, Invoke Actions */}
        <div className="shrink-0 border-b border-border bg-panel">
          <RequestBar isMobile={isMobile} tab={activeTab} />
        </div>

        {/* Second Bar: Service and Method Selection */}
        <div className="shrink-0 bg-panel">
          <GrpcServicePicker isMobile={isMobile} />
        </div>

        {/* Main Workspace Area */}
        <div
          className={`flex flex-1 overflow-hidden ${isMobile ? "flex-col" : "flex-row"}`}
        >
          {/* Left Pane (Desktop) / Top Pane (Mobile): Request Message & Metadata */}
          <div
            className={`flex flex-1 flex-col min-w-0 bg-bg ${
              isMobile ? "border-b border-border" : "border-r border-border"
            }`}
          >
            <GrpcRequestPanel isMobile={isMobile} />
          </div>

          {/* Right Pane (Desktop) / Bottom Pane (Mobile): Response Log & Status */}
          <div className="flex flex-1 flex-col min-w-0 bg-bg">
            <GrpcResponsePanel isMobile={isMobile} error={activeTab?.error} />
          </div>
        </div>
      </div>
    </>
  );
}
