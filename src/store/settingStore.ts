import { create } from "zustand";

import { invoke } from "@tauri-apps/api/core";
import { AppSettings } from "@samvad-internal/models";

interface SettingsStore {
  settings: AppSettings | null;
  isSettingsOpen: boolean;
  isLoadingSettings: boolean;

  setSettingsOpen: (isOpen: boolean) => void;
  fetchSettings: () => Promise<void>;
  updateSettings: (newSettings: AppSettings) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: null,
  isSettingsOpen: false,
  isLoadingSettings: false,

  setSettingsOpen: (isOpen: boolean) => {
    set({ isSettingsOpen: isOpen });
    // Always re-fetch from disk when opening so we see the latest persisted values
    if (isOpen) {
      get().fetchSettings();
    }
  },

  fetchSettings: async () => {
    set({ isLoadingSettings: true });
    try {
      const settings = await invoke<AppSettings>("get_settings");
      set({ settings, isLoadingSettings: false });
    } catch (error) {
      console.error("Failed to load settings:", error);
      set({ isLoadingSettings: false });
    }
  },

  updateSettings: async (newSettings: AppSettings) => {
    try {
      await invoke("update_settings", { settings: newSettings });
      set({ settings: newSettings, isSettingsOpen: false });
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  },
}));
