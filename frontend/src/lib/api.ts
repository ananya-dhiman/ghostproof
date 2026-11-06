// Talks to Person B's backend (backend/src/routes/*). Shapes come from shared/types.ts.
// If the backend can't be reached, reads fall back to clearly flagged demo data so the
// screens still work on stage; the UI always says when that happens.
import type {
  ArkivReportRecord,
  HealthResponse,
  ReportEnvelope,
  SubmitRequest,
  SubmitResponse,
  WorldIdProofRequest,
  WorldIdVerifyResponse,
} from "@shared/types";
import { demoRecords, demoReport, demoReports, demoSubmit } from "./mock";

export const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8787").replace(/\/$/, "");

export interface Fetched<T> {
  data: T;
  demo: boolean;
  error?: string;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    cache: "no-store",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body?.error || `${path} returned HTTP ${res.status}`, res.status, body);
  return body as T;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public body?: unknown) {
    super(message);
  }
}

/** True if the error means "backend unreachable" (vs. the backend saying no). */
const offline = (e: unknown) => !(e instanceof ApiError);

export async function fetchHealth(): Promise<HealthResponse | null> {
  try {
    return await call<HealthResponse>("/health");
  } catch {
    return null;
  }
}

export async function fetchReports(): Promise<Fetched<ReportEnvelope[]>> {
  try {
    return { data: await call<ReportEnvelope[]>("/reports"), demo: false };
  } catch (e) {
    return { data: demoReports(), demo: true, error: (e as Error).message };
  }
}

export async function fetchReport(reportId: string): Promise<Fetched<ReportEnvelope | null>> {
  const local = demoReport(reportId);
  if (local) return { data: local, demo: true }; // a report we simulated offline
  try {
    return { data: await call<ReportEnvelope>(`/report/${encodeURIComponent(reportId)}`), demo: false };
  } catch (e) {
    if (!offline(e)) return { data: null, demo: false, error: (e as Error).message };
    return { data: null, demo: true, error: (e as Error).message };
  }
}

export async function fetchRecords(): Promise<Fetched<{ source: string; records: ArkivReportRecord[] }>> {
  try {
    const raw = await call<{ source: string; records: ArkivReportRecord[] }>("/records");
    return { data: { source: raw.source, records: raw.records ?? [] }, demo: false };
  } catch (e) {
    return { data: { source: "demo", records: demoRecords() }, demo: true, error: (e as Error).message };
  }
}

/** POST /submit. If the backend is unreachable, runs a flagged offline simulation instead. */
export async function submitExploit(body: SubmitRequest): Promise<SubmitResponse & { demo: boolean }> {
  try {
    const r = await call<SubmitResponse>("/submit", { method: "POST", body: JSON.stringify(body) });
    return { ...r, demo: false };
  } catch (e) {
    if (!offline(e)) throw e; // the backend said no (bad source, already submitted, ...): show it
    return { ...demoSubmit(body), demo: true };
  }
}

/** POST /verify-human. The backend checks the proof; the browser never decides. */
export async function verifyHuman(proof: WorldIdProofRequest): Promise<WorldIdVerifyResponse> {
  try {
    return await call<WorldIdVerifyResponse>("/verify-human", { method: "POST", body: JSON.stringify(proof) });
  } catch (e) {
    if (e instanceof ApiError && e.body && typeof e.body === "object" && "nullifierHash" in e.body) {
      return e.body as WorldIdVerifyResponse; // 401 with a reason
    }
    throw e;
  }
}
