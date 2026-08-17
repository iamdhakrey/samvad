import { AuthConfig, AuthType } from "@samvad-internal/models";

const AUTH_TYPES: { id: AuthType; label: string }[] = [
  { id: "none", label: "No auth" },
  { id: "basic", label: "Basic auth" },
  { id: "bearer", label: "Bearer token" },
  { id: "apiKey", label: "API key" },
];

interface Props {
  auth: AuthConfig;
  onChange: (auth: AuthConfig) => void;
  isMobile?: boolean;
}

export default function AuthTab({ auth, onChange, isMobile = false }: Props) {
  return (
    <div
      className={`${
        isMobile ? "flex flex-col gap-4 px-3 py-3" : "flex gap-6 px-4 py-4"
      }`}
    >
      {/* Auth type selector */}
      <div
        className={
          isMobile
            ? "flex gap-1 overflow-x-auto scrollbar-hide"
            : "w-44 shrink-0"
        }
      >
        {AUTH_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange({ ...auth, type: t.id })}
            className={`${
              isMobile
                ? "shrink-0 rounded-md px-3 py-1.5"
                : "block w-full rounded-md px-2.5 py-1.5"
            } text-left text-sm ${
              auth.type === t.id
                ? "bg-panel-raised text-text-primary"
                : "text-text-secondary hover:bg-panel-raised"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Auth form */}
      <div className="flex-1">
        {auth.type === "none" && (
          <p className="text-sm text-text-muted">
            This request does not use authorization.
          </p>
        )}

        {auth.type === "basic" && (
          <div className={`flex flex-col gap-3 ${isMobile ? "" : "max-w-sm"}`}>
            <Field
              label="Username"
              value={auth.basic?.username ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  basic: {
                    ...auth.basic,
                    username: v,
                    password: auth.basic?.password ?? "",
                  },
                })
              }
            />
            <Field
              label="Password"
              type="password"
              value={auth.basic?.password ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  basic: {
                    ...auth.basic,
                    password: v,
                    username: auth.basic?.username ?? "",
                  },
                })
              }
            />
          </div>
        )}

        {auth.type === "bearer" && (
          <div className={isMobile ? "" : "max-w-sm"}>
            <Field
              label="Token"
              value={auth.bearer?.token ?? ""}
              onChange={(v) => onChange({ ...auth, bearer: { token: v } })}
              mono
            />
          </div>
        )}

        {auth.type === "apiKey" && (
          <div className={`flex flex-col gap-3 ${isMobile ? "" : "max-w-sm"}`}>
            <Field
              label="Key"
              value={auth.apiKey?.key ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  apiKey: {
                    key: v,
                    value: auth.apiKey?.value ?? "",
                    addTo: auth.apiKey?.addTo ?? "header",
                  },
                })
              }
            />
            <Field
              label="Value"
              value={auth.apiKey?.value ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  apiKey: {
                    key: auth.apiKey?.key ?? "",
                    value: v,
                    addTo: auth.apiKey?.addTo ?? "header",
                  },
                })
              }
            />
            <label className="text-sm text-text-secondary">
              Add to
              <select
                value={auth.apiKey?.addTo ?? "header"}
                onChange={(e) =>
                  onChange({
                    ...auth,
                    apiKey: {
                      key: auth.apiKey?.key ?? "",
                      value: auth.apiKey?.value ?? "",
                      addTo: e.target.value as "header" | "query",
                    },
                  })
                }
                className="input-shell ml-2 bg-panel"
              >
                <option value="header">Header</option>
                <option value="query">Query params</option>
              </select>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  mono?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-text-secondary">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`input-shell ${mono ? "font-mono" : ""}`}
      />
    </label>
  );
}
