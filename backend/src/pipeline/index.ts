/**
 * Pipeline dispatcher.
 *
 * One submission at a time: a fork run spawns anvil and a forge compile, both
 * of which are hungry, and two concurrent runs on a laptop during a live demo
 * is how you get a timeout on stage. Submissions queue instead.
 */
import { runChecker } from "../checker/index.js";
import { generateReport } from "../ai/report.js";
import { env } from "../env.js";
import * as store from "../store.js";
import type { ArkivRecord, SubmissionMetadata } from "../types.js";
import { runMockPipeline } from "./mock.js";

let queue: Promise<void> = Promise.resolve();

/**
 * Hands the submission to the pipeline and returns immediately. The HTTP
 * request must never wait on this — the frontend polls GET /report/:id.
 */
export function enqueue(
  reportId: string,
  meta: SubmissionMetadata,
  exploitSource: string,
  exploitHash: `0x${string}`,
): void {
  queue = queue
    .then(() => run(reportId, meta, exploitSource, exploitHash))
    .catch((err: unknown) => {
      // A failure in one submission must never stall the queue for the next.
      console.error(`[pipeline] ${reportId} failed:`, err);
      store.setStatus(
        reportId,
        "error",
        "The checker hit an internal problem. This is on us, not on the submission.",
      );
    });
}

async function run(
  reportId: string,
  meta: SubmissionMetadata,
  exploitSource: string,
  exploitHash: `0x${string}`,
): Promise<void> {
  if (env.mockPipeline) {
    console.log(`[pipeline] ${reportId} running in MOCK mode`);
    await runMockPipeline(reportId, meta, exploitHash);
    return;
  }

  // Step 1-9: run the exploit on the sandbox, measure it, apply the rules.
  console.log(`[pipeline] ${reportId} running checker`);
  const outcome = await runChecker(reportId, exploitSource, exploitHash);

  if (!outcome.checker.verified) {
    // Did not compile / run / timed out — the company never sees it.
    store.setStatus(reportId, "rejected", outcome.error ?? undefined);
    return;
  }

  store.setChecker(reportId, outcome.checker);
  store.setStatus(reportId, "verified");

  // Step 10: evidence report — one grounded Claude call (claude-haiku-5-5),
  // falling back to the canned report on any failure or timeout so the pipeline
  // never hangs on a model.
  store.setEvidence(reportId, await generateReport(outcome.checker, exploitSource));

  // Step 11: payout. B4 calls the BountyPool settler here when a rule broke.
  // TODO(B4): settleReport(hacker, severity) on A's BountyPool, wait for receipt.

  // Step 12: public record. B6 writes this to Arkiv; for now mirror it locally
  // so GET /records works end to end.
  if (outcome.checker.ruleBroken) {
    const record: ArkivRecord = {
      bountyId: meta.bountyId,
      reportId,
      exploitHash,
      severity: outcome.checker.severity,
      valueMovedUsdc: outcome.checker.valueMovedUsdc,
      status: "base-paid", // becomes real once B4 pays; placeholder for now
      paidUsdc: 0, // TODO(B4): the actual base paid
      bonusUsdc: 0,
      createdAt: Math.floor(Date.now() / 1000),
    };
    store.mirrorArkivRecord(record);
  }
}
