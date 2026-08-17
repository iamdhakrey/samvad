import { useEffect, useState } from "react";
import { RequestTab } from "../../types";
import { useVartaStore } from "../../store/vartaStore";
import { Save, Send, Trash2, X } from "lucide-react";
import { WsSavedMessage } from "@samvad-internal/models";

function SavedWSTab({ tab, isMobile }: { tab: RequestTab; isMobile: boolean }) {
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [newMsgName, setNewMsgName] = useState("");
  const [newMsgData, setNewMsgData] = useState("");

  const isConnected = tab.wsStatus === "connected";

  const loadSavedMessages = useVartaStore((s) => s.loadSavedMessages);
  const sendWsMessage = useVartaStore((s) => s.sendWsMessage);
  const addSavedMessage = useVartaStore((s) => s.addSavedMessage);
  const deleteSavedMessage = useVartaStore((s) => s.deleteSavedMessage);

  useEffect(() => {
    if (tab.request.id && !tab.request.id.startsWith("new-")) {
      loadSavedMessages(tab.request.id);
    }
  }, [tab.request.id, loadSavedMessages]);
  const handleSaveMessage = async () => {
    if (!newMsgName.trim() || !newMsgData.trim()) return;
    await addSavedMessage(tab.request.id, newMsgName.trim(), newMsgData.trim());
    setNewMsgName("");
    setNewMsgData("");
    setShowSaveForm(false);
  };

  const handleSendSaved = (msg: WsSavedMessage) => {
    if (tab.wsStatus !== "connected") return;
    sendWsMessage(msg.data);
  };

  return (
    <div
      className={`flex-1 overflow-y-auto ${isMobile ? "px-3 py-2" : "px-4 py-3"}`}
    >
      {/* Add new saved message form */}
      {showSaveForm && (
        <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-primary">
              Save Message Template
            </span>
            <button
              onClick={() => setShowSaveForm(false)}
              className="p-1 text-text-muted hover:text-text-primary rounded"
            >
              <X size={14} />
            </button>
          </div>
          <input
            value={newMsgName}
            onChange={(e) => setNewMsgName(e.target.value)}
            placeholder="Template name (e.g. 'Subscribe to ticker')"
            className="input-shell w-full text-xs"
            autoFocus
          />
          <textarea
            value={newMsgData}
            onChange={(e) => setNewMsgData(e.target.value)}
            placeholder="Message payload"
            className="input-shell w-full resize-none font-mono text-xs min-h-15"
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowSaveForm(false)}
              className="rounded-md border border-border px-3 py-1 text-xs text-text-secondary hover:bg-panel-raised"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveMessage}
              disabled={!newMsgName.trim() || !newMsgData.trim()}
              className="rounded-md bg-brand-gradient px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {!showSaveForm && (
        <button
          onClick={() => {
            setNewMsgName("");
            setNewMsgData("");
            setShowSaveForm(true);
          }}
          className="mb-3 flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-xs text-text-secondary hover:border-primary/50 hover:text-text-primary transition-colors w-full justify-center"
        >
          <Save size={12} />
          New saved message
        </button>
      )}

      {/* Saved messages list */}
      {tab.wsSavedMessages.length === 0 && !showSaveForm ? (
        <div className="flex h-32 items-center justify-center text-sm text-text-muted">
          No saved messages yet. Create one to quickly re-send common payloads.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tab.wsSavedMessages.map((msg) => (
            <div
              key={msg.id}
              className="group rounded-md border border-border bg-panel p-3 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-text-primary">
                  {msg.name}
                </span>
                <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleSendSaved(msg)}
                    disabled={!isConnected}
                    className="rounded p-1 text-primary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed"
                    title={isConnected ? "Send this message" : "Connect first"}
                  >
                    <Send size={13} />
                  </button>
                  <button
                    onClick={() => deleteSavedMessage(tab.request.id, msg.id)}
                    className="rounded p-1 text-text-muted hover:text-error hover:bg-error/10"
                    title="Delete saved message"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <pre className="whitespace-pre-wrap break-all font-mono text-xs text-text-secondary bg-bg rounded p-2">
                {msg.data}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SavedWSTab;
