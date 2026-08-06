import React, { useState } from "react";
import { ApiRequest, HttpMethod } from "../../types";
import { Check, Edit2, Trash2, X } from "lucide-react";
import { useWorkspaceStore } from "../../store/workspaceStore";
import { useVartaStore } from "../../store/vartaStore";

const methodColors: Record<HttpMethod, string> = {
  GET: "text-method-get",
  POST: "text-method-post",
  PUT: "text-method-put",
  PATCH: "text-method-patch",
  DELETE: "text-method-delete",
  OPTIONS: "text-text-muted",
  HEAD: "text-text-muted",
  WS: "text-method-ws",
};

export const RequestItem: React.FC<{ request: ApiRequest }> = ({ request }) => {
  const { deleteRequest, renameRequest } = useWorkspaceStore();
  const activeTabId = useVartaStore((s) => s.activeTabId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");


  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editValue.trim() && editValue !== request.name) {
      console.log(`Renaming request ${request.id} to "${editValue}"`);
      await renameRequest(request.id, editValue);
    }
    setEditingId(null);
  };
  // Bring in the action to open a tab from your UI/Tabs store
  const openRequestTab = useVartaStore((s) => s.openRequest);

  return (
    <>
      {editingId === request.id ? (
        <form
          onSubmit={handleRenameSubmit}
          className="flex items-center gap-1 w-full pr-1"
        >
          <input
            autoFocus
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onClick={(e) => e.stopPropagation()} // Prevent toggling folder open/close
            className="input-shell w-full py-0.5 px-2 text-xs"
          />
          <button
            type="submit"
            className="p-1 hover:text-success cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditingId(null);
            }}
            className="p-1 hover:text-error cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </form>
      ) : (
        <div
          // Trigger the open action when the row is clicked
          onClick={() => openRequestTab(request)}
          className={`group flex items-center justify-between px-2 py-1.5 mx-1 my-0.5 rounded-md text-sm cursor-pointer hover:bg-panel hover:text-text-primary text-text-secondary transition-colors ${activeTabId === request.id
            ? "border-2 border-primary /10"
            : "border border-transparent"
            }`}
        >

          <div className={`flex items-center gap-2.5 truncate transition-colors`}>
            <span className={`text-[10px] font-bold w-10 text-right ${methodColors[request.method as HttpMethod] || "text-text-muted"}`}>
              {request.method}
            </span>
            <span className="truncate">{request.name}</span>
          </div >
          {/* Hover Actions */}
          < div className="opacity-70 group-hover:opacity-100 flex items-center transition-opacity pr-1" >
            <button
              onClick={() => {
                setEditingId(request.id);
                setEditValue(request.name);
              }}
              title="Rename Request"
              className="p-1 hover:text-text-primary hover:bg-panel rounded transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevents the row click (open tab) from firing when deleting
                deleteRequest(request.id);
              }}
              className="p-1 hover:text-error hover:bg-error/10 rounded transition-colors"
              title="Delete Request"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div >
        </div >
      )}
    </>
  );
};
