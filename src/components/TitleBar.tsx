import { getCurrentWindow } from "@tauri-apps/api/window";
import { Maximize, Minimize, Minus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useVartaStore } from "../store/vartaStore";

const appWindow = getCurrentWindow();

export default function Titlebar() {
  const [isMaximized, setIsMaximized] = useState(false);

  const activeTab = useVartaStore((s) => s.activeTab);

  // Keep maximized state in sync for the restore icon
  useEffect(() => {
    const unlisten = appWindow.onResized(async () => {
      const maximized = await appWindow.isMaximized();
      setIsMaximized(maximized);
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  return (
    // data-tauri-drag-region tells Tauri to treat this div as the window drag handle
    <div
      data-tauri-drag-region
      className="flex h-10 w-full select-none items-center justify-between bg-surface-950/80 border-b border-ink/10 backdrop-blur-md"
    >
      {/* App Title / Logo */}
      <div className="pointer-events-none ml-4 flex items-center gap-2">
        <img
          src="/icon.png"
          alt="Samvad Logo"
          className="h-4 w-4 object-contai"
        />
      </div>

      <div className="flex h-full pointer-events-auto text-text-secondary">
        <button className="inline-flex h-full w-12 items-center justify-center transition hover:bg-surface-900/50 hover:text-text-primary">
          {activeTab?.request.name ? (
            <div className="flex items-center gap-2">
              <span className="max-w-[100px] truncate text-sm font-medium">
                {activeTab.request.method} :
              </span>
              <span className="max-w-[100px] truncate text-sm font-medium">
                {activeTab.request.name}
              </span>
            </div>
          ) : (
            <span className="text-sm font-medium text-text-secondary"></span>
          )}
        </button>
      </div>

      {/* Window Controls */}
      {/* We apply 'pointer-events-auto' so the buttons work inside the drag region */}
      <div className="flex h-full pointer-events-auto text-text-secondary">
        <button
          onClick={() => appWindow.minimize()}
          className="inline-flex h-full w-12 items-center justify-center transition hover:bg-surface-900/50 hover:text-text-primary"
        >
          <Minus size={16} strokeWidth={2} />
        </button>

        {isMaximized ? (
          <button
            onClick={() => appWindow.toggleMaximize()}
            className="inline-flex h-full w-12 items-center justify-center transition hover:bg-surface-900/50 hover:text-text-primary"
          >
            <Maximize size={14} strokeWidth={2.5} />
          </button>
        ) : (
          <button
            onClick={() => appWindow.toggleMaximize()}
            className="inline-flex h-full w-12 items-center justify-center transition hover:bg-surface-900/50 hover:text-text-primary"
          >
            <Minimize size={14} strokeWidth={2.5} />
          </button>
        )}

        <button
          onClick={() => appWindow.close()}
          className="inline-flex h-full w-12 items-center justify-center transition hover:bg-danger hover:text-white"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
