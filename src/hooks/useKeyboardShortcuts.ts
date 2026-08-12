import { useEffect } from "react";
import { useVartaStore } from "../store/vartaStore";
import { useSettingsStore } from "../store/settingStore";

export function useKeyboardShortcuts() {
  const newTab = useVartaStore((s) => s.newTab);
  const sendActiveRequest = useVartaStore((s) => s.sendActiveRequest);
  const saveActiveRequest = useVartaStore((s) => s.saveActiveRequest);
  const toggleCommandPalette = useVartaStore((s) => s.toggleCommandPalette);
  const toggleHistory = useVartaStore((s) => s.toggleHistory);
  const setSettingsOpen = useSettingsStore((s) => s.setSettingsOpen);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      switch (e.key.toLowerCase()) {
        case "t":
          e.preventDefault();
          newTab();
          break;
        case "p":
          e.preventDefault();
          toggleCommandPalette(true);
          break;
        case "enter":
          e.preventDefault();
          sendActiveRequest();
          break;
        case "s":
          e.preventDefault();
          saveActiveRequest();
          break;
        case ",":
          e.preventDefault();
          setSettingsOpen(true);
          break;
        case "h":
          e.preventDefault();
          toggleHistory();
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [newTab, sendActiveRequest, saveActiveRequest, toggleCommandPalette, toggleHistory, setSettingsOpen]);
}
