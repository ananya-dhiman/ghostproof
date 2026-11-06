/**
 * Pipeline dispatcher.
 *
 * One submission at a time: a fork run spawns anvil and a forge compile, both
 * of which are hungry, and two concurrent runs on a laptop during a live demo
 * is how you get a timeout on stage. Submissions queue instead.
 */
import { runChecker } from "../checker/index.js";
import { generateReport } from "../ai/report.js";
import { chainReady } from "../chain/clients.js";
import { settlePayout } from "../chain/payout.js";
import { writeArkivRecord } from "../arkiv/client.js";
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

  // Step 10: evidence report — one grounded OpenRouter call, generated in the
  // BACKGROUND so a slow model never delays the payout. It fills into the
  // envelope whenever it returns; the frontend polls and shows it then.
  // generateReport never throws (it falls back to the canned report), but we
  // guard anyway.
  void generateReport(outcome.checker, exploitSource)
    .then((report) => store.setEvidence(reportId, report))
    .catch((err: unknown) => console.error(`[pipeline] ${reportId} report error:`, err));

  // Step 11: automatic base payout. Only when a rule the company wrote in
  // advance was broken, and only if the chain is actually wired up. If the
  // contracts aren't deployed yet (or no key), we leave the report "verified"
  // with payout pending rather than failing — a visible, honest state.
  let paidUsdc = 0;
  if (outcome.checker.ruleBroken && outcome.checker.severity) {
    const ready = chainReady();
    if (!ready.ok) {
      console.log(`[pipeline] ${reportId} payout skipped: ${ready.reason}`);
    } else {
      try {
        const payout = await settlePayout(
          reportId,
          meta.hackerAddress as `0x${string}`,
          outcome.checker.severity,
        );
        paidUsdc = payout.paidUsdc;
        store.setPayout(reportId, { txHash: payout.txHash, paidUsdc });
        store.setStatus(reportId, "base-paid");
        console.log(`[pipeline] ${reportId} paid ${paidUsdc} USDC (${payout.txHash})`);
      } catch (err) {
        // A payout failure must not lose the verified finding.
        console.error(`[pipeline] ${reportId} payout failed:`, err);
      }
    }
  }

  // Step 12: public record — written once the base has actually been paid, so
  // the public track record only ever shows real outcomes. A verified finding
  // that hasn't been paid yet (chain not wired) stays "verified" with no record.
  // B6 writes this to Arkiv; the local mirror is the fallback so GET /records
  // always works.
  if (outcome.checker.ruleBroken && paidUsdc > 0) {
    const record: ArkivRecord = {
      bountyId: meta.bountyId,
      reportId,
      exploitHash,
      severity: outcome.checker.severity,
      valueMovedUsdc: outcome.checker.valueMovedUsdc,
      status: "base-paid",
      paidUsdc,
      bonusUsdc: 0,
      createdAt: Math.floor(Date.now() / 1000),
    };
    store.mirrorArkivRecord(record);

    // Write it to Arkiv too. The mirror above already makes /records work, so an
    // Arkiv failure is logged and ignored, never fatal.
    const written = await writeArkivRecord(record);
    if (written) {
      store.setArkiv(reportId, { entityKey: written.entityKey, url: null });
      console.log(`[pipeline] ${reportId} on Arkiv: ${written.entityKey}`);
    }
  }
}
