// Shared types — the contract between backend (B) and frontend (C). Freeze after hour 1.
// Changes must be announced to the other two before committing.

export type SeverityName = "critical" | "high" | "medium";

/** What the hacker screen sends to the backend. */
export interface Submission {
  bountyId: string;
  hackerAddress: string;
  worldIdNullifier: string;
  // the exploit source is uploaded alongside this as a file
}

/** Backend checker output. verified:false => stop, the company never sees it. */
export interface CheckerResult {
  verified: boolean;
  ruleBroken: string | null;
  severity: SeverityName | null;
  valueMovedUsdc: number;
  forkBlock: number;
  exploitHash: string;
  reportId: string;
}

/** AI-written, human-readable evidence report (JSON-guaranteed via structured output). */
export interface EvidenceReport {
  summary: string;
  steps: string[];
  rootCause: string;
  suggestedSeverity: SeverityName;
  suggestedFixSummary: string;
}

/** Public record row stored on Arkiv. */
export interface ArkivReportRecord {
  bountyId: string;
  reportId: string;
  exploitHash: string;
  severity: SeverityName;
  valueMovedUsdc: number;
  status: "base-paid" | "bonus-added" | "rejected";
  paidUsdc: number;
  bonusUsdc: number;
  createdAt: number; // unix seconds
}
