import React, { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { sendNativeRequest } from "../services/rest";
import {
  ApiResponse,
  HttpMethod,
  RequestItem,
  UploadedFile,
} from "@samvad-internal/models";

export const HttpClient: React.FC = () => {
  const [url, setUrl] = useState<string>("https://httpbin.org/post");
  const [method, setMethod] = useState<string>("POST");
  const [selectedFiles, setSelectedFiles] = useState<UploadedFile[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Uses Tauri's native OS file selector to get the absolute system path
  const handleFilePick = async () => {
    try {
      const selected = await open({
        multiple: true,
        directory: false,
      });

      if (selected && Array.isArray(selected)) {
        const mappedFiles: UploadedFile[] = selected.map((filePath) => {
          // Extract file name from absolute path
          const name = filePath.split(/[/\\]/).pop() || "file";
          return {
            name,
            path: filePath,
            sizeBytes: BigInt(0),
            id: "file_" + Date.now(),
          };
        });
        setSelectedFiles(mappedFiles);
      } else if (selected) {
        // Single file selected (if multiple: false)
        const name = (selected as string).split(/[/\\]/).pop() || "file";
        setSelectedFiles([
          {
            name,
            path: selected as string,
            sizeBytes: BigInt(0),
            id: "file_" + Date.now(),
          },
        ]);
      }
    } catch (err) {
      console.error("Failed to open file dialog:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResponse(null);

    const payload: RequestItem = {
      id: "req_" + Date.now(),
      name: "My API Request",
      method: method as HttpMethod,
      type: "http",
      url: url,
      params: [],
      headers: [
        { id: "h1", key: "Accept", value: "application/json", enabled: true },
      ],
      cookies: [],
      auth: { type: "none", basic: null, bearer: null, apiKey: null },
      body: {
        mode: null,
        files: selectedFiles.length > 0 ? selectedFiles : undefined,
        raw: undefined,
        // json: undefined,
      },
      collectionId: "",
      folderId: null,
    };

    try {
      const res = await sendNativeRequest(payload);
      console.log(res);
      setResponse(res);
    } catch (err) {
      console.error(err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: "20px",
        fontFamily: "sans-serif",
        maxWidth: "800px",
        margin: "0 auto",
      }}
    >
      <h2>Tauri Core HTTP Client</h2>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "15px" }}
      >
        <div style={{ display: "flex", gap: "10px" }}>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            style={{ padding: "8px" }}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>

          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{ flex: 1, padding: "8px" }}
            placeholder="https://api.example.com"
            required
          />
        </div>

        <div>
          <button
            type="button"
            onClick={handleFilePick}
            style={{ padding: "8px 12px" }}
          >
            📎 Attach Files via Native Dialog
          </button>

          <div style={{ marginTop: "8px", fontSize: "14px", color: "#666" }}>
            {selectedFiles.length === 0 ? (
              <span>No files attached</span>
            ) : (
              <ul>
                {selectedFiles.map((file, i) => (
                  <li key={i}>
                    <strong>{file.name}</strong> <small>({file.path})</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px",
            background: "#007acc",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          {loading ? "Sending Request via Rust..." : "Send Request"}
        </button>
      </form>

      <hr
        style={{ margin: "30px 0", border: "0", borderTop: "1px solid #ccc" }}
      />

      {/* Error Output */}
      {error && (
        <div
          style={{
            padding: "10px",
            background: "#fce4e4",
            border: "1px solid #fcc",
            color: "#cc0000",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Response Display */}
      {response && (
        <div>
          <h3>
            Response:
            <span
              style={{
                marginLeft: "10px",
                color:
                  response.status >= 200 && response.status < 300
                    ? "green"
                    : "red",
              }}
            >
              {response.status} {response.statusText}
            </span>
          </h3>

          <p style={{ fontSize: "14px", color: "#555" }}>
            ⏱️ {response.timeMs} ms | 📦 {response.sizeBytes} bytes
          </p>

          <h4>Headers</h4>
          <pre
            style={{
              background: "#f4f4f4",
              padding: "10px",
              overflowX: "auto",
              fontSize: "12px",
            }}
          >
            {JSON.stringify(response.headers, null, 2)}
          </pre>

          <h4>Body</h4>
          <pre
            style={{
              background: "#f4f4f4",
              padding: "10px",
              overflowX: "auto",
              maxHeight: "300px",
            }}
          >
            {response.body}
          </pre>
        </div>
      )}
    </div>
  );
};
