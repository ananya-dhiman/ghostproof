import type { SeverityName } from "@shared/types";
import { STATUS_LABEL, type AnyStatus } from "@/lib/format";

export function SeverityTag({ severity }: { severity: SeverityName | null | undefined }) {
  if (!severity) return <span className="tag">No severity</span>;
  return <span className={`tag sev-${severity}`}>{severity}</span>;
}

export function StatusTag({ status }: { status: AnyStatus }) {
  const label = STATUS_LABEL[status] ?? status;
  if (status === "rejected" || status === "error" || status === "duplicate")
    return (
      <span className="tag hazard">
        <span>{label}</span>
      </span>
    );
  const cls = status === "bonus-added" || status === "base-paid" ? "accent" : "flat";
  return <span className={`tag ${cls}`}>{label}</span>;
}

export function DemoFlag({ show, error }: { show: boolean; error?: string }) {
  if (!show) return null;
  return (
    <span className="demo-flag" title={error ? `Backend unreachable: ${error}` : undefined}>
      👻 Demo data · backend offline
    </span>
  );
}

export function Stat({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value} {unit && <small>{unit}</small>}
      </div>
    </div>
  );
}

export function SealedNote() {
  return (
    <div className="callout hazard">
      <div>
        <strong>Honest note:</strong> in production the checker runs on a sealed computer (a TEE) so nobody,
        not even us, can tamper with it. In this demo, one ordinary server stands in for it.
      </div>
    </div>
  );
}
