import { useEffect } from "react";
import Sidebar from "./components/Sidebar";
import RequestEditor from "./components/RequestEditor";
import ResponsePanel from "./components/ResponsePanel";
import WebSocketPanel from "./components/WebSocketPanel";
import CommandPalette from "./components/CommandPalette";
import HistoryDrawer from "./components/HistoryDrawer";
import { useVartaStore } from "./store/vartaStore";
import { useSettingsStore, DEFAULT_FONT_SETTINGS } from "./store/settingStore";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useAuth0Desktop } from "./hooks/useAuth0Desktop";
import { useResizablePanel } from "./hooks/useResizablePanel";
import { useMobileDetect } from "./hooks/useMobileDetect";
import { SettingsPanel } from "./components/SettingsPanel";
import { EnvironmentModal } from "./components/EnvironmentModal";
import { Menu } from "lucide-react";
import { UpdaterOverlay } from "./components/UpdaterOverlay";
import Titlebar from "./components/TitleBar";
import { NewReqSaveModal } from "./components/NewRequestSaveModal";
import GrpcEditor from "./components/gRPC";

export default function App() {
  useAuth0Desktop();
  useKeyboardShortcuts();
  const isMobile = useMobileDetect();

  const tabs = useVartaStore((s) => s.tabs);
  const activeTabId = useVartaStore((s) => s.activeTabId);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const { height, onMouseDown } = useResizablePanel(300, 160, 640);

  const isSidebarOpen = useVartaStore((s) => s.isSidebarOpen);
  const toggleSidebar = useVartaStore((s) => s.toggleSidebar);
  const initWsListener = useVartaStore((s) => s.initWsListener);
  const initGrpcListener = useVartaStore((s) => s.initGrpcListener);

  // Detect if active tab is a WebSocket tab
  const isWsTab = activeTab?.request.method === "WS";
  const isGrpcTab = activeTab?.request.type === "grpc";

  // Initialize Tauri WS & gRPC event listeners on mount
  useEffect(() => {
    const cleanupWs = initWsListener();
    const cleanupGrpc = initGrpcListener();
    return () => {
      cleanupWs.then((fn) => fn());
      cleanupGrpc.then((fn) => fn());
    };
  }, [initWsListener, initGrpcListener]);

  const initFonts = useSettingsStore(s => s.initFonts);
  const settingsFont = useSettingsStore(s => s.settings?.font);
  const font = settingsFont || DEFAULT_FONT_SETTINGS;

  useEffect(() => {
    initFonts();
  }, [initFonts]);

  useEffect(() => {
    if (font.appFontFamily) {
      document.documentElement.style.setProperty("--font-sans", font.appFontFamily);
    }
    if (font.fontFamily) {
      document.documentElement.style.setProperty("--font-mono", font.fontFamily);
    }
  }, [font.appFontFamily, font.fontFamily]);

  return (
    <>
      {/*<Titlebar />*/}
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg text-text-primary">
        <Titlebar />

        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          {/* ── Desktop sidebar (always visible) ── */}
          {!isMobile && <Sidebar isMobile={false} />}

          {/* ── Mobile sidebar (slide-over drawer) ── */}
          {isMobile && isSidebarOpen && (
            <div
              className="fixed inset-0 z-50 flex animate-backdrop-in"
              onClick={() => toggleSidebar(false)}
            >
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/60" />

              {/* Sidebar drawer */}
              <div
                className="relative z-10 animate-sidebar-in"
                onClick={(e) => e.stopPropagation()}
              >
                <Sidebar isMobile={true} onClose={() => toggleSidebar(false)} />
              </div>
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            {/* ── Mobile top header bar ── */}
            {isMobile && (
              <div className="flex items-center gap-3 border-b border-border bg-panel px-3 py-2.5">
                <button
                  onClick={() => toggleSidebar(true)}
                  className="rounded-md p-1.5 text-text-secondary hover:bg-panel-raised hover:text-text-primary"
                  aria-label="Open sidebar"
                >
                  <Menu size={20} />
                </button>
                <span className="text-sm font-semibold bg-brand-gradient bg-clip-text text-transparent">
                  Varta
                </span>
              </div>
            )}

            {activeTab && isGrpcTab ? (
              <GrpcEditor isMobile={isMobile} />
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-hidden">
                  <RequestEditor isMobile={isMobile} />
                </div>

                {activeTab && (
                  <>
                    {/* Drag-resize handle — desktop only */}
                    {!isMobile && (
                      <div
                        onMouseDown={onMouseDown}
                        className="h-1 shrink-0 cursor-row-resize bg-border hover:bg-primary/60"
                      />
                    )}

                    {/* Response / WebSocket panel */}
                    <div
                      style={isMobile ? { height: "45vh" } : { height }}
                      className="shrink-0 border-t border-border bg-bg"
                    >
                      {isWsTab ? (
                        <WebSocketPanel tab={activeTab} isMobile={isMobile} />
                      ) : (
                        <ResponsePanel
                          response={activeTab.response}
                          isSending={activeTab.isSending}
                          error={activeTab.error}
                          isMobile={isMobile}
                        />
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Global Overlays & Modals */}
          <UpdaterOverlay />
          <HistoryDrawer isMobile={isMobile} />
          <CommandPalette isMobile={isMobile} />
          <SettingsPanel isMobile={isMobile} />

          {/* Mount the Environment Modal here */}
          <EnvironmentModal isMobile={isMobile} />
          <NewReqSaveModal isMobile={isMobile} />
        </div>
      </div>
    </>
  );
}
