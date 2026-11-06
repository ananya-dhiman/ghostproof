import type { ArkivReportRecord, SeverityName } from "@shared/types";
import { STATUS_LABEL } from "@/lib/format";

export function SeverityTag({ severity }: { severity: SeverityName | null | undefined }) {
  if (!severity) return <span className="tag">No severity</span>;
  return <span className={`tag sev-${severity}`}>{severity}</span>;
}

export function StatusTag({ status }: { status: ArkivReportRecord["status"] }) {
  if (status === "rejected")
    return (
      <span className="tag hazard">
        <span>{STATUS_LABEL[status]}</span>
      </span>
    );
  return <span className={`tag ${status === "bonus-added" ? "accent" : "flat"}`}>{STATUS_LABEL[status]}</span>;
}

export function DemoFlag({ show, error }: { show: boolean; error?: string }) {
  if (!show) return null;
  return (
    <span className="demo-flag" title={error ? `Backend unreachable: ${error}` : "Backend not configured"}>
      👻 Demo data{error ? " (backend offline)" : ""}
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
