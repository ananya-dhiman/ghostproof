/**
 * In-memory state. Demo-grade on purpose: a restart wipes it, which is fine for
 * a hackathon and keeps us off a database we would have to operate.
 *
 * Holds three things:
 *   - every report envelope, keyed by reportId
 *   - the set of exploit hashes we have already seen (duplicate detection)
 *   - the set of World ID nullifiers that have already submitted once
 */
import type {
  ArkivRecord,
  CheckerResult,
  EvidenceReport,
  PayoutInfo,
  ArkivInfo,
  ReportEnvelope,
  RunEvidence,
  ReportStatus,
  SubmissionMetadata,
} from "./types.js";

const reports = new Map<string, ReportEnvelope>();
const exploitHashToReportId = new Map<string, string>();
const usedNullifiers = new Set<string>();
const verifiedNullifiers = new Set<string>();
const arkivMirror: ArkivRecord[] = [];

let counter = 0;

// A per-process seed (base36 of the start time) prefixes every report id, so ids
// are unique across restarts. The on-chain report id is keccak256(reportId); a
// plain restart-resetting counter would reuse rep_001 and make settleReport
// revert ("report exists"). The seed makes each run's ids distinct forever.
const RUN_SEED = Date.now().toString(36);

function nextReportId(): string {
  counter += 1;
  return `rep_${RUN_SEED}_${counter}`;
}

export function createReport(meta: SubmissionMetadata): ReportEnvelope {
  const envelope: ReportEnvelope = {
    reportId: nextReportId(),
    status: "checking",
    submission: {
      bountyId: meta.bountyId,
      hackerAddress: meta.hackerAddress,
      submittedAt: Math.floor(Date.now() / 1000),
    },
    checker: null,
    report: null,
    payout: null,
    arkiv: null,
    error: null,
  };
  reports.set(envelope.reportId, envelope);
  return envelope;
}

export function getReport(reportId: string): ReportEnvelope | undefined {
  return reports.get(reportId);
}

export function listReports(): ReportEnvelope[] {
  return [...reports.values()].sort(
    (a, b) => b.submission.submittedAt - a.submission.submittedAt,
  );
}

export function setStatus(reportId: string, status: ReportStatus, error?: string): void {
  const r = reports.get(reportId);
  if (!r) return;
  r.status = status;
  if (error !== undefined) r.error = error;
}

export function setRunEvidence(reportId: string, evidence: RunEvidence): void {
  const r = reports.get(reportId);
  if (!r) return;
  r.runEvidence = evidence;
}

export function setChecker(reportId: string, checker: CheckerResult): void {
  const r = reports.get(reportId);
  if (!r) return;
  r.checker = checker;
}

export function setEvidence(reportId: string, report: EvidenceReport): void {
  const r = reports.get(reportId);
  if (!r) return;
  r.report = report;
}

export function setPayout(reportId: string, payout: PayoutInfo): void {
  const r = reports.get(reportId);
  if (!r) return;
  r.payout = payout;
}

export function setArkiv(reportId: string, arkiv: ArkivInfo): void {
  const r = reports.get(reportId);
  if (!r) return;
  r.arkiv = arkiv;
}

/* --- duplicate detection ------------------------------------------------- */

/** Returns the earlier reportId if this exact exploit was submitted before. */
export function findDuplicate(exploitHash: string): string | undefined {
  return exploitHashToReportId.get(exploitHash);
}

export function rememberExploitHash(exploitHash: string, reportId: string): void {
  if (!exploitHashToReportId.has(exploitHash)) {
    exploitHashToReportId.set(exploitHash, reportId);
  }
}

/* --- World ID ------------------------------------------------------------ */

export function markNullifierVerified(nullifier: string): void {
  verifiedNullifiers.add(nullifier);
}

export function isNullifierVerified(nullifier: string): boolean {
  return verifiedNullifiers.has(nullifier);
}

/** One submission per human: a nullifier is spent once it has submitted. */
export function isNullifierSpent(nullifier: string): boolean {
  return usedNullifiers.has(nullifier);
}

export function spendNullifier(nullifier: string): void {
  usedNullifiers.add(nullifier);
}

/* --- Arkiv mirror -------------------------------------------------------- */

/**
 * Every record we write to Arkiv is also kept here, so the public record page
 * still renders if the Arkiv RPC is down during judging.
 */
export function mirrorArkivRecord(record: ArkivRecord): void {
  const existing = arkivMirror.findIndex((r) => r.reportId === record.reportId);
  if (existing >= 0) arkivMirror[existing] = record;
  else arkivMirror.push(record);
}

export function listArkivMirror(): ArkivRecord[] {
  return [...arkivMirror].sort((a, b) => b.createdAt - a.createdAt);
}
