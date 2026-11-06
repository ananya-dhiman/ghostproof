// Talks to Person B's backend. Every call falls back to demo data if the backend is not
// configured or unreachable, and says so (demo: true) so the UI can show it honestly.
import type { ArkivReportRecord, CheckerResult, EvidenceReport } from "@shared/types";
import { MOCK_RECORDS, mockReportView } from "./mock";

export const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");
export const BACKEND_CONFIGURED = BACKEND_URL.length > 0;

export interface ReportView {
  result: CheckerResult;
  report: EvidenceReport | null; // null while the AI is still writing it
  record?: ArkivReportRecord;
}

export interface Fetched<T> {
  data: T;
  demo: boolean;
  error?: string;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} returned HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function fetchRecords(): Promise<Fetched<ArkivReportRecord[]>> {
  if (!BACKEND_CONFIGURED) return { data: MOCK_RECORDS, demo: true };
  try {
    const raw = await getJson<ArkivReportRecord[] | { records: ArkivReportRecord[] }>("/records");
    const data = Array.isArray(raw) ? raw : raw.records ?? [];
    return { data: [...data].sort((a, b) => b.createdAt - a.createdAt), demo: false };
  } catch (e) {
    return { data: MOCK_RECORDS, demo: true, error: (e as Error).message };
  }
}

/** Accepts {result, report, record} or a flat CheckerResult, so B has some freedom. */
function normalizeReport(raw: unknown, reportId: string): ReportView {
  const r = raw as Record<string, unknown> | null;
  if (r && typeof r === "object" && "result" in r) {
    return {
      result: r.result as CheckerResult,
      report: (r.report ?? r.evidence ?? null) as EvidenceReport | null,
      record: r.record as ArkivReportRecord | undefined,
    };
  }
  if (r && typeof r === "object" && "verified" in r) {
    return { result: r as unknown as CheckerResult, report: (r.report ?? null) as EvidenceReport | null };
  }
  throw new Error(`Unexpected report shape for ${reportId}`);
}

export async function fetchReport(reportId: string): Promise<Fetched<ReportView>> {
  if (!BACKEND_CONFIGURED) return { data: mockReportView(reportId), demo: true };
  try {
    const raw = await getJson<unknown>(`/report/${encodeURIComponent(reportId)}`);
    return { data: normalizeReport(raw, reportId), demo: false };
  } catch (e) {
    return { data: mockReportView(reportId), demo: true, error: (e as Error).message };
  }
}

/** Goes through our own Next route so the World ID check + one-submission rule run on the server. */
export async function submitExploit(input: {
  source: string;
  hackerAddress: string;
  worldIdNullifier: string;
}): Promise<{ result: CheckerResult; demo: boolean }> {
  const res = await fetch("/api/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Submit failed (HTTP ${res.status})`);
  return body;
}

export async function verifyWorldId(payload: unknown): Promise<{ nullifier: string }> {
  const res = await fetch("/api/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || "World ID check failed");
  return body;
}
