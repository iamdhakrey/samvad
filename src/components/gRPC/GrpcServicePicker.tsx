
import { ChevronDown, Network } from "lucide-react";
import { useVartaStore } from "../../store/vartaStore";
import { GrpcService, GrpcMethod, GrpcStreamType } from "../../types";

interface GrpcServicePickerProps {
  isMobile?: boolean;
}

const STREAM_TYPE_STYLES: Record<GrpcStreamType, { label: string; className: string }> = {
  unary: {
    label: "Unary",
    className: "bg-success/15 text-success border-success/30",
  },
  server_stream: {
    label: "Server Stream",
    className: "bg-secondary/15 text-secondary border-secondary/30",
  },
  client_stream: {
    label: "Client Stream",
    className: "bg-warning/15 text-warning border-warning/30",
  },
  bidi_stream: {
    label: "Bidi Stream",
    className: "bg-primary/15 text-primary border-primary/30",
  },
};

export default function GrpcServicePicker({ isMobile = false }: GrpcServicePickerProps) {
  const services = useVartaStore((s) => s.grpcServices);
  const selectedService = useVartaStore((s) => s.grpcSelectedService);
  const selectedMethod = useVartaStore((s) => s.grpcSelectedMethod);
  const setSelectedService = useVartaStore((s) => s.setGrpcSelectedService);
  const setSelectedMethod = useVartaStore((s) => s.setGrpcSelectedMethod);
  const reflectionLoading = useVartaStore((s) => s.grpcReflectionLoading);

  const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const service = services.find((s) => s.fullName === e.target.value) ?? null;
    setSelectedService(service);
  };

  const handleMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!selectedService) return;
    const method =
      selectedService.methods.find((m) => m.fullName === e.target.value) ?? null;
    setSelectedMethod(method);
  };

  // No services loaded yet — show hint
  if (services.length === 0 && !reflectionLoading) {
    return (
      <div className={`flex items-center gap-2 border-b border-border ${isMobile ? "px-3 py-2.5" : "px-4 py-2.5"}`}>
        <Network size={14} className="text-text-muted" />
        <span className="text-xs text-text-muted italic">
          Enter a server address and click <strong className="text-text-secondary">Reflect</strong> to discover services
        </span>
      </div>
    );
  }

  // Loading state
  if (reflectionLoading) {
    return (
      <div className={`flex items-center gap-2 border-b border-border ${isMobile ? "px-3 py-2.5" : "px-4 py-2.5"}`}>
        <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="text-xs text-text-secondary">
          Discovering services…
        </span>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="flex flex-col gap-2 border-b border-border px-3 py-2.5">
        {/* Service selector */}
        <ServiceSelect
          services={services}
          selected={selectedService}
          onChange={handleServiceChange}
        />

        {/* Method selector + badge row */}
        <div className="flex items-center gap-2">
          <MethodSelect
            methods={selectedService?.methods ?? []}
            selected={selectedMethod}
            onChange={handleMethodChange}
            disabled={!selectedService}
          />
          {selectedMethod && (
            <StreamBadge streamType={selectedMethod.streamType} />
          )}
        </div>

        {/* Type info */}
        {selectedMethod && (
          <TypeInfo method={selectedMethod} />
        )}
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
      {/* Service selector */}
      <ServiceSelect
        services={services}
        selected={selectedService}
        onChange={handleServiceChange}
      />

      <span className="text-text-muted text-xs">/</span>

      {/* Method selector */}
      <MethodSelect
        methods={selectedService?.methods ?? []}
        selected={selectedMethod}
        onChange={handleMethodChange}
        disabled={!selectedService}
      />

      {/* Stream type badge */}
      {selectedMethod && (
        <StreamBadge streamType={selectedMethod.streamType} />
      )}

      {/* Request / Response types */}
      {selectedMethod && (
        <div className="ml-auto">
          <TypeInfo method={selectedMethod} />
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function ServiceSelect({
  services,
  selected,
  onChange,
}: {
  services: GrpcService[];
  selected: GrpcService | null;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <div className="relative">
      <select
        value={selected?.fullName ?? ""}
        onChange={onChange}
        className="input-shell appearance-none pr-7 text-sm font-medium text-text-primary min-w-[180px]"
      >
        <option value="" disabled className="bg-panel text-text-muted">
          Select service…
        </option>
        {services.map((s) => (
          <option key={s.fullName} value={s.fullName} className="bg-panel text-text-primary">
            {s.name}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary"
      />
    </div>
  );
}

function MethodSelect({
  methods,
  selected,
  onChange,
  disabled,
}: {
  methods: GrpcMethod[];
  selected: GrpcMethod | null;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={selected?.fullName ?? ""}
        onChange={onChange}
        disabled={disabled}
        className="input-shell appearance-none pr-7 text-sm font-medium text-text-primary min-w-[180px] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="" disabled className="bg-panel text-text-muted">
          Select method…
        </option>
        {methods.map((m) => (
          <option key={m.fullName} value={m.fullName} className="bg-panel text-text-primary">
            {m.name}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary"
      />
    </div>
  );
}

function StreamBadge({ streamType }: { streamType: GrpcStreamType }) {
  const style = STREAM_TYPE_STYLES[streamType];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${style.className}`}
    >
      {style.label}
    </span>
  );
}

function TypeInfo({ method }: { method: GrpcMethod }) {
  return (
    <div className="flex items-center gap-3 text-[10px] font-mono text-text-muted">
      <span>
        <span className="text-text-secondary">req:</span>{" "}
        <span className="text-method-grpc/80">{method.requestType}</span>
      </span>
      <span className="text-border">→</span>
      <span>
        <span className="text-text-secondary">res:</span>{" "}
        <span className="text-method-grpc/80">{method.responseType}</span>
      </span>
    </div>
  );
}
