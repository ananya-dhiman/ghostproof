// Shared types — the contract between backend (B) and frontend (C). Freeze after hour 1.
// OWNER: Person B. Changes must be announced to the other two before committing.
//
// Base shapes (SeverityName, Submission, CheckerResult, EvidenceReport,
// ArkivReportRecord) were seeded by Person A in the scaffold and are kept as-is.
// Person B added the HTTP-contract types below them. Two deliberate changes from
// the scaffold, both announced to A and C:
//   1. Submission carries `exploitSource` as a string (not a separate file
//      upload) — the frontend reads the picked file to text, and the source
//      string is what the checker hashes for duplicates anyway.
//   2. ArkivReportRecord.severity is nullable — a rejected record may have no
//      severity.

export type SeverityName = "critical" | "high" | "medium";
// Note: `Severity` is deliberately NOT aliased here — shared/config.ts exports a
// numeric on-chain `Severity` (MEDIUM=1, HIGH=2, CRITICAL=3). Use `SeverityName`
// for the string form to keep the two unambiguous.

/** What the hacker screen sends to the backend (POST /submit body). */
export interface Submission {
  bountyId: string;
  hackerAddress: string;
  worldIdNullifier: string;
  /** Full text of the exploit .sol. Must expose a contract with
   *  `function run(VulnerableVault vault) external` (matches A's ExploitDrain). */
  exploitSource: string;
}

/** Just the metadata of a submission, without the source. */
export type SubmissionMetadata = Pick<
  Submission,
  "bountyId" | "hackerAddress" | "worldIdNullifier"
>;

/** Alias: the full POST /submit body. */
export type SubmitRequest = Submission;

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
  /** true when the live model call failed and we served the canned report. */
  fallback?: boolean;
}

/** Public record row stored on Arkiv. */
export interface ArkivReportRecord {
  bountyId: string;
  reportId: string;
  exploitHash: string;
  severity: SeverityName | null;
  valueMovedUsdc: number;
  status: "base-paid" | "bonus-added" | "rejected";
  paidUsdc: number;
  bonusUsdc: number;
  createdAt: number; // unix seconds
}

/** Alias kept for backend code that refers to the type as `ArkivRecord`. */
export type ArkivRecord = ArkivReportRecord;

/* ------------------------------------------------------------------------- *
 * HTTP contract between backend (B) and frontend (C). Added by Person B.    *
 * ------------------------------------------------------------------------- */

/** The immediate reply to POST /submit. The real work runs in the background. */
export interface SubmitResponse {
  reportId: string;
  status: ReportStatus;
}

/** Lifecycle of a submission, as the frontend sees it. */
export type ReportStatus =
  | "checking" // fork run in progress
  | "verified" // ran and measured, but broke no pre-written rule -> no auto pay
  | "rejected" // failed the safety guard, or the exploit did not run
  | "duplicate" // this exact exploit was submitted before
  | "base-paid" // a rule broke and the guaranteed base was paid on-chain
  | "bonus-added" // the company chose to add more on top
  | "error"; // something on our side broke; the hacker is not at fault

export interface PayoutInfo {
  txHash: string;
  paidUsdc: number;
}

export interface ArkivInfo {
  entityKey: string;
  url: string | null;
}

/**
 * The shape returned by GET /report/:id. The frontend polls this every ~2s.
 * Fields fill in as the pipeline advances; nulls mean "not yet".
 */
export interface ReportEnvelope {
  reportId: string;
  status: ReportStatus;
  submission: {
    bountyId: string;
    hackerAddress: string;
    submittedAt: number;
  };
  checker: CheckerResult | null;
  report: EvidenceReport | null;
  payout: PayoutInfo | null;
  arkiv: ArkivInfo | null;
  /** Human-readable reason for `rejected` / `error`. Safe to show the hacker. */
  error: string | null;
}

/** POST /verify-human — the payload IDKit hands the frontend, forwarded to us. */
export interface WorldIdProofRequest {
  proof: string;
  merkle_root: string;
  nullifier_hash: string;
  verification_level: string;
}

export interface WorldIdVerifyResponse {
  verified: boolean;
  nullifierHash: string;
  /** true if this nullifier already submitted once — block a second attempt. */
  alreadyUsed: boolean;
  error?: string;
}

/** GET /health — which parts are actually wired up right now. */
export interface HealthResponse {
  ok: boolean;
  mode: "mock" | "live";
  subsystems: {
    foundry: boolean;
    sepoliaRpc: boolean;
    ai: boolean;
    arkiv: boolean;
    worldId: boolean;
    payoutWallet: boolean;
  };
}
