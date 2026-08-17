import { useRef } from "react";
import Editor from "@monaco-editor/react";
import { Wand2, Upload, File as FileIcon, X } from "lucide-react";
import KeyValueTable from "./KeyValueTable";
import { BodyMode, RequestBody } from "@samvad-internal/models";

const MODES: { id: BodyMode; label: string }[] = [
  { id: "json", label: "JSON" },
  { id: "form-data", label: "Form data" },
  { id: "urlencoded", label: "URL encoded" },
  { id: "raw", label: "Raw text" },
  { id: "multipart", label: "Multipart" },
];

function formatBytes(bytes: number | bigint): string {
  const b = Number(bytes);

  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  body: RequestBody;
  onChange: (body: RequestBody) => void;
  isMobile?: boolean;
}

export default function BodyTab({ body, onChange, isMobile = false }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function setMode(mode: BodyMode) {
    onChange({ ...body, mode });
  }

  function formatJson() {
    try {
      const parsed = JSON.parse(body.raw || "{}");
      onChange({ ...body, raw: JSON.stringify(parsed, null, 2) });
    } catch {
      // invalid JSON — leave as-is; a real implementation surfaces an inline error
    }
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const next = Array.from(fileList).map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      sizeBytes: BigInt(f.size),
      path: "", // Tauri provides the path; in a browser, this will be empty
    }));
    onChange({ ...body, files: [...(body.files ?? []), ...next] });
  }

  return (
    <div
      className={`flex h-full flex-col ${isMobile ? "px-3 py-2.5" : "px-4 py-3"}`}
    >
      <div className="mb-3 flex items-center justify-between">
        {/* Mode selector — scrollable on mobile */}
        <div
          className={`flex gap-1 ${isMobile ? "overflow-x-auto scrollbar-hide" : ""}`}
        >
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`shrink-0 rounded-md px-2.5 py-1 text-sm ${
                body.mode === m.id
                  ? "bg-panel-raised text-text-primary"
                  : "text-text-secondary hover:bg-panel-raised"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {body.mode === "json" && (
          <button
            onClick={formatJson}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-text-secondary hover:bg-panel-raised ml-2"
          >
            <Wand2 size={12} />
            {isMobile ? "Format" : "Format JSON"}
          </button>
        )}
      </div>

      {body.mode === "json" && (
        <div className="flex-1 overflow-hidden rounded-md border border-border">
          <Editor
            height="100%"
            defaultLanguage="json"
            theme="vs-dark"
            value={body.raw}
            onChange={(v) => onChange({ ...body, raw: v ?? "" })}
            options={{
              fontSize: isMobile ? 12 : 13,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              padding: { top: 12 },
              wordWrap: isMobile ? "on" : "off",
            }}
          />
        </div>
      )}

      {body.mode === "raw" && (
        <textarea
          value={body.raw}
          onChange={(e) => onChange({ ...body, raw: e.target.value })}
          className="flex-1 resize-none rounded-md border border-border bg-panel p-3 font-mono text-sm text-text-primary outline-none focus:border-primary"
          placeholder="Raw request body…"
        />
      )}

      {body.mode === "form-data" && (
        <KeyValueTable
          rows={body.formData ?? []}
          onChange={(rows) => onChange({ ...body, formData: rows })}
          isMobile={isMobile}
        />
      )}

      {body.mode === "urlencoded" && (
        <KeyValueTable
          rows={body.urlEncoded ?? []}
          onChange={(rows) => onChange({ ...body, urlEncoded: rows })}
          isMobile={isMobile}
        />
      )}

      {body.mode === "multipart" && (
        <div className="flex-1">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-center hover:border-primary/60 ${
              isMobile ? "py-6" : "py-10"
            }`}
          >
            <Upload size={20} className="text-text-secondary" />
            <p className="text-sm text-text-secondary">
              {isMobile
                ? "Tap to browse files"
                : "Drag and drop files, or click to browse"}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          {!!body.files?.length && (
            <div className="mt-3 flex flex-col gap-1.5">
              {body.files.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-2 rounded-md border border-border bg-panel px-3 py-2 text-sm"
                >
                  <FileIcon size={14} className="text-text-secondary" />
                  <span className="truncate text-text-primary">{f.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-text-muted">
                    {formatBytes(f.sizeBytes)}
                  </span>
                  <button
                    onClick={() =>
                      onChange({
                        ...body,
                        files: body.files?.filter((x) => x.id !== f.id),
                      })
                    }
                    aria-label={`Remove ${f.name}`}
                    className="text-text-muted hover:text-error"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
