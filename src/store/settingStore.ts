import { create } from "zustand";

import { invoke } from "@tauri-apps/api/core";
import { AppSettings, FontSettings } from "@samvad-internal/models";
import { convertFileSrc } from '@tauri-apps/api/core';

export const DEFAULT_FONT_SETTINGS: FontSettings = {
  appFontFamily: "Inter",
  fontFamily: "Fira Code, monospace",
  customFontPath: null,
  fontSize: 14,
  lineHeight: 1.5,
  enableLigatures: true,
};

interface SettingsStore {
  settings: AppSettings | null;
  isSettingsOpen: boolean;
  isLoadingSettings: boolean;

  setSettingsOpen: (isOpen: boolean) => void;
  fetchSettings: () => Promise<void>;
  updateSettings: (newSettings: AppSettings) => Promise<void>;

  // Font specific
  updateFontSettings: (newFont: Partial<FontSettings>) => Promise<void>;
  loadCustomFont: (name: string, filePath: string) => Promise<void>;
  initFonts: () => Promise<void>;
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

  updateFontSettings: async (newFont: Partial<FontSettings>) => {
    const currentSettings = get().settings;
    if (!currentSettings) return;

    const updatedSettings: AppSettings = {
      ...currentSettings,
      font: {
        ...currentSettings.font,
        ...newFont,
      },
    };
    await get().updateSettings(updatedSettings);
  },

  loadCustomFont: async (name, filePath) => {
    try {
      // Convert absolute OS path to a webview-readable asset URL
      const assetUrl = convertFileSrc(filePath);

      // Use the Web Font API to dynamically load the bytes
      const fontFace = new FontFace(name, `url(${assetUrl})`);
      const loadedFont = await fontFace.load();
      document.fonts.add(loadedFont);

      await get().updateFontSettings({ fontFamily: name, customFontPath: filePath });
    } catch (error) {
      console.error("Failed to load custom font file:", error);
    }
  },

  initFonts: async () => {
    let currentSettings = get().settings;
    if (!currentSettings) {
      await get().fetchSettings();
      currentSettings = get().settings;
    }

    if (currentSettings?.font) {
      const { customFontPath, fontFamily } = currentSettings.font;
      if (customFontPath) {
        await get().loadCustomFont(fontFamily, customFontPath);
      }
    }
  },
}));
