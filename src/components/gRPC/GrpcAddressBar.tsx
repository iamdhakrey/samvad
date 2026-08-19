
import { Lock, LockOpen, RefreshCw, Play, XCircle, Loader2 } from "lucide-react";
import { useVartaStore } from "../../store/vartaStore";

interface GrpcAddressBarProps {
  isMobile?: boolean;
}

export default function GrpcAddressBar({ isMobile = false }: GrpcAddressBarProps) {
  const serverAddress = useVartaStore((s) => s.grpcServerAddress);
  const setServerAddress = useVartaStore((s) => s.setGrpcServerAddress);
  const tlsEnabled = useVartaStore((s) => s.grpcTlsEnabled);
  const setTlsEnabled = useVartaStore((s) => s.setGrpcTlsEnabled);
  const callStatus = useVartaStore((s) => s.grpcCallStatus);
  const reflectionLoading = useVartaStore((s) => s.grpcReflectionLoading);
  const loadReflection = useVartaStore((s) => s.loadGrpcReflection);
  const invokeGrpc = useVartaStore((s) => s.invokeGrpc);
  const cancelGrpcCall = useVartaStore((s) => s.cancelGrpcCall);

  const isActive = callStatus === "invoking" || callStatus === "streaming";
  const canInvoke = serverAddress.trim() && !isActive;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && canInvoke) {
      invokeGrpc();
    }
  };

  if (isMobile) {
    return (
      <div className="flex flex-col gap-2 px-3 py-2.5">
        {/* Row 1: TLS + Reflect + Invoke */}
        <div className="flex items-center gap-2">
          {/* gRPC badge */}
          <span className="input-shell flex items-center gap-1.5 font-semibold text-method-grpc px-3 py-1.5 text-sm cursor-default select-none">
            <span className="inline-block h-2 w-2 rounded-full bg-method-grpc/70" />
            gRPC
          </span>

          <TlsToggle enabled={tlsEnabled} onChange={setTlsEnabled} />

          <div className="ml-auto flex items-center gap-2">
            <ReflectButton
              loading={reflectionLoading}
              disabled={!serverAddress.trim()}
              onClick={loadReflection}
            />
            {isActive ? (
              <CancelButton onClick={cancelGrpcCall} />
            ) : (
              <InvokeButton disabled={!canInvoke} onClick={invokeGrpc} />
            )}
          </div>
        </div>

        {/* Row 2: Address input */}
        <input
          value={serverAddress}
          onChange={(e) => setServerAddress(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="localhost:50051"
          className="input-shell w-full font-mono text-sm"
          spellCheck={false}
        />
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="flex items-center gap-2 px-4 py-3">
      {/* gRPC badge */}
      <span className="input-shell flex items-center gap-1.5 font-semibold text-method-grpc px-3 py-1.5 text-sm cursor-default select-none">
        <span className="inline-block h-2 w-2 rounded-full bg-method-grpc/70" />
        gRPC
      </span>

      {/* Server address */}
      <div className="relative flex-1">
        <input
          value={serverAddress}
          onChange={(e) => setServerAddress(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="localhost:50051"
          className="input-shell w-full font-mono text-sm"
          spellCheck={false}
        />
      </div>

      {/* TLS toggle */}
      <TlsToggle enabled={tlsEnabled} onChange={setTlsEnabled} />

      {/* Reflect button */}
      <ReflectButton
        loading={reflectionLoading}
        disabled={!serverAddress.trim()}
        onClick={loadReflection}
      />

      {/* Invoke / Cancel */}
      {isActive ? (
        <CancelButton onClick={cancelGrpcCall} />
      ) : (
        <InvokeButton disabled={!canInvoke} onClick={invokeGrpc} />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function TlsToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all ${
        enabled
          ? "border-success/40 bg-success/10 text-success shadow-[0_0_8px_rgba(16,185,129,0.15)]"
          : "border-border bg-panel text-text-muted hover:text-text-secondary hover:border-border"
      }`}
      title={enabled ? "TLS enabled — click to disable" : "TLS disabled — click to enable"}
    >
      {enabled ? <Lock size={13} /> : <LockOpen size={13} />}
      TLS
    </button>
  );
}

function ReflectButton({
  loading,
  disabled,
  onClick,
}: {
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-panel-raised hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      title="Discover services via server reflection"
    >
      {loading ? (
        <Loader2 size={13} className="animate-spin" />
      ) : (
        <RefreshCw size={13} />
      )}
      {loading ? "Reflecting…" : "Reflect"}
    </button>
  );
}

function InvokeButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-md bg-brand-gradient px-5 py-1.5 text-sm font-medium text-white shadow-panel hover:opacity-90 disabled:opacity-60 transition-opacity"
    >
      <Play size={13} fill="currentColor" />
      Invoke
    </button>
  );
}

function CancelButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md bg-error/90 px-5 py-1.5 text-sm font-medium text-white shadow-panel hover:bg-error transition-colors"
    >
      <XCircle size={13} />
      Cancel
    </button>
  );
}
