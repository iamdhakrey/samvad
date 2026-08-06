import React, { useEffect, useState } from "react";
import { useSettingsStore } from "../store/settingStore";
import { AppSettings } from "../types";
import {
  X,
  Shield,
  Globe,
  Clock,
  FastForward,
  Settings2,
  Palette,
  Keyboard,
  CornerDownLeft,
} from "lucide-react";

type SettingsTab = "general" | "appearance" | "shortcuts";

const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "general", label: "General", icon: <Settings2 className="w-4 h-4" /> },
  { id: "appearance", label: "Appearance", icon: <Palette className="w-4 h-4" /> },
  { id: "shortcuts", label: "Shortcuts", icon: <Keyboard className="w-4 h-4" /> },
];

const SHORTCUT_LIST = [
  { action: "Open Command Palette", keys: ["Ctrl", "P"] },
  { action: "New Request Tab", keys: ["Ctrl", "T"] },
  { action: "Send Request", keys: ["Ctrl", "↵"] },
  { action: "Save Request", keys: ["Ctrl", "S"] },
  { action: "Open Settings", keys: ["Ctrl", ","] },
  { action: "Toggle History", keys: ["Ctrl", "H"] },
  { action: "Close Modal / Palette", keys: ["Esc"] },
];

interface SettingsPanelProps {
  isMobile?: boolean;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isMobile = false }) => {
  const { isSettingsOpen, setSettingsOpen, settings, updateSettings, isLoadingSettings, fetchSettings } =
    useSettingsStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [formData, setFormData] = useState<AppSettings | null>(null);

  // Load settings when panel opens
  useEffect(() => {
    if (isSettingsOpen) {
      fetchSettings();
    }
  }, [isSettingsOpen, fetchSettings]);

  // Sync form when settings load
  useEffect(() => {
    if (settings) {
      setFormData({ ...settings });
    }
  }, [settings]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSettingsOpen) {
        setSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSettingsOpen, setSettingsOpen]);

  if (!isSettingsOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;
    const payload = {
      ...formData,
      proxyUrl: formData.proxyUrl?.trim() === "" ? null : formData.proxyUrl,
    };
    await updateSettings(payload);
  };

  const updateField = <K extends keyof AppSettings>(field: K, value: AppSettings[K]) => {
    setFormData((prev) => (prev ? { ...prev, [field]: value } : null));
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={() => setSettingsOpen(false)}
    >
      <div
        className={`relative flex overflow-hidden rounded-xl border border-border bg-bg shadow-elevated animate-in zoom-in-95 duration-200 ${isMobile
          ? "w-[95vw] h-[90vh] flex-col"
          : "w-full max-w-3xl h-[78vh] flex-row"
          }`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ── Nav — sidebar on desktop, horizontal tabs on mobile ── */}
        {isMobile ? (
          <div className="flex items-center gap-1 border-b border-border bg-panel px-3 py-2 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-1 flex-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${activeTab === tab.id
                    ? "bg-primary/15 text-primary"
                    : "text-text-secondary hover:bg-borderMuted hover:text-text-primary"
                    }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSettingsOpen(false)}
              className="shrink-0 rounded-md p-1.5 text-text-muted hover:bg-borderMuted hover:text-text-primary transition-colors cursor-pointer ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <aside className="flex w-48 shrink-0 flex-col border-r border-border bg-panel p-3 gap-1">
            <div className="mb-2 px-2">
              <h2 className="text-xs font-bold tracking-widest text-text-muted uppercase">
                Settings
              </h2>
            </div>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer text-left ${activeTab === tab.id
                  ? "bg-primary/15 text-primary"
                  : "text-text-secondary hover:bg-borderMuted hover:text-text-primary"
                  }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </aside>
        )}

        {/* ── Right content area ── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header — desktop only (mobile has close in the tab bar) */}
          {!isMobile && (
            <div className="flex items-center justify-between border-b border-border bg-panel-raised px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-text-primary">
                  {TABS.find((t) => t.id === activeTab)?.label}
                </h2>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                className="rounded-md p-1.5 text-text-muted hover:bg-borderMuted hover:text-text-primary transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "general" && (
              <GeneralTab
                formData={formData}
                isLoading={isLoadingSettings}
                onSubmit={handleSubmit}
                updateField={updateField}
                isMobile={isMobile}
              />
            )}
            {activeTab === "appearance" && <AppearanceTab />}
            {activeTab === "shortcuts" && <ShortcutsTab isMobile={isMobile} />}
          </div>

          {/* Footer — only shown on General tab */}
          {activeTab === "general" && (
            <div className={`flex items-center justify-end gap-2 border-t border-border bg-panel-raised ${isMobile ? "px-3 py-2.5" : "px-5 py-3"}`}>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-md px-4 py-1.5 text-sm font-medium text-text-secondary hover:bg-borderMuted hover:text-text-primary transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="settings-general-form"
                className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-white shadow-panel hover:bg-primary-hover transition-colors cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── General Tab ────────────────────────────────────────────────────────────

interface GeneralTabProps {
  formData: AppSettings | null;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  updateField: <K extends keyof AppSettings>(field: K, value: AppSettings[K]) => void;
  isMobile?: boolean;
}

const GeneralTab: React.FC<GeneralTabProps> = ({ formData, isLoading, onSubmit, updateField, isMobile = false }) => {
  if (isLoading || !formData) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        Loading settings…
      </div>
    );
  }

  return (
    <form id="settings-general-form" onSubmit={onSubmit} className={`flex flex-col gap-6 ${isMobile ? "p-4" : "p-6"}`}>
      {/* HTTP Behavior */}
      <section className="flex flex-col gap-4">
        <h3 className="text-[11px] font-bold tracking-wider text-text-muted uppercase">
          HTTP Behavior
        </h3>

        <ToggleRow
          icon={<FastForward className="w-4 h-4 text-text-secondary" />}
          label="Follow Redirects"
          description="Automatically follow 3xx redirect responses"
          checked={formData.followRedirects}
          onChange={(v) => updateField("followRedirects", v)}
        />

        <div className={`flex items-center justify-between ${isMobile ? "flex-wrap gap-2" : ""}`}>
          <label className="text-sm font-medium text-text-primary">Max Redirects</label>
          <input
            type="number"
            min="0"
            max="50"
            disabled={!formData.followRedirects}
            value={formData.maxRedirects}
            onChange={(e) => updateField("maxRedirects", parseInt(e.target.value) || 0)}
            className="input-shell w-24 text-right disabled:opacity-40"
          />
        </div>

        <ToggleRow
          icon={<Shield className="w-4 h-4 text-text-secondary" />}
          label="Validate SSL Certificates"
          description="Reject self-signed or invalid certificates"
          checked={formData.verifySslCertificates}
          onChange={(v) => updateField("verifySslCertificates", v)}
        />
      </section>

      <div className="h-px bg-borderMuted" />

      {/* Network */}
      <section className="flex flex-col gap-4">
        <h3 className="text-[11px] font-bold tracking-wider text-text-muted uppercase">
          Network Configuration
        </h3>

        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
            <Clock className="w-4 h-4 text-text-secondary" />
            Timeout (milliseconds)
          </label>
          <input
            type="number"
            min="0"
            step="1000"
            value={formData.timeoutMs}
            onChange={(e) => updateField("timeoutMs", parseInt(e.target.value) || 0)}
            className="input-shell w-full"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-primary">User Agent</label>
          <input
            type="text"
            value={formData.userAgent}
            onChange={(e) => updateField("userAgent", e.target.value)}
            className="input-shell w-full font-mono text-xs"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-primary">
            Proxy URL{" "}
            <span className="text-text-muted font-normal">(optional)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. http://127.0.0.1:8080"
            value={formData.proxyUrl ?? ""}
            onChange={(e) => updateField("proxyUrl", e.target.value)}
            className="input-shell w-full font-mono text-xs"
          />
        </div>
      </section>
    </form>
  );
};

// ─── Appearance Tab ──────────────────────────────────────────────────────────

const AppearanceTab: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
    <Palette className="w-10 h-10 text-text-muted opacity-40" />
    <p className="text-sm font-medium text-text-secondary">Theme Customisation</p>
    <p className="text-xs text-text-muted max-w-xs leading-relaxed">
      Custom theme support is coming soon. You'll be able to choose from built-in themes or
      create your own colour palette.
    </p>
  </div>
);

// ─── Shortcuts Tab ───────────────────────────────────────────────────────────

const ShortcutsTab: React.FC<{ isMobile?: boolean }> = ({ isMobile = false }) => (
  <div className={`flex flex-col gap-4 ${isMobile ? "p-4" : "p-6"}`}>
    <h3 className="text-[11px] font-bold tracking-wider text-text-muted uppercase">
      Keyboard Shortcuts
    </h3>
    <div className="flex flex-col divide-y divide-borderMuted rounded-lg border border-border overflow-hidden">
      {SHORTCUT_LIST.map(({ action, keys }) => (
        <div
          key={action}
          className={`flex items-center justify-between bg-panel hover:bg-panel-raised transition-colors ${isMobile ? "px-3 py-2" : "px-4 py-2.5"
            }`}
        >
          <span className={`text-text-primary ${isMobile ? "text-xs" : "text-sm"}`}>{action}</span>
          <div className="flex items-center gap-1">
            {keys.map((k, i) => (
              <React.Fragment key={k}>
                {i > 0 && <span className="text-text-muted text-xs">+</span>}
                {k === "↵" ? (
                  <kbd className="kbd flex items-center gap-0.5">
                    <CornerDownLeft className="w-2.5 h-2.5" />
                  </kbd>
                ) : (
                  <kbd className="kbd">{k}</kbd>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ─── Toggle Row helper ───────────────────────────────────────────────────────

interface ToggleRowProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ icon, label, description, checked, onChange }) => (
  <label className="flex cursor-pointer items-center justify-between group">
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
        {icon}
        {label}
      </span>
      <span className="text-xs text-text-muted pl-6">{description}</span>
    </div>
    <div className="relative shrink-0 ml-4">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div
        className={`w-9 h-5 rounded-full border transition-colors cursor-pointer ${checked
          ? "bg-primary border-primary"
          : "bg-panel-raised border-border"
          }`}
        onClick={() => onChange(!checked)}
      >
        <div
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-4" : "translate-x-0"
            }`}
        />
      </div>
    </div>
  </label>
);
