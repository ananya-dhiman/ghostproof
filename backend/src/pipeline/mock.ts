/**
 * Simulated pipeline.
 *
 * Purpose: let Person C build the frontend against realistic timing and the
 * real JSON shapes before Foundry, the Sepolia deploy, the Anthropic key or
 * Arkiv exist. Every stage lands in the store exactly where the real pipeline
 * will put it, so swapping MOCK_PIPELINE to false changes nothing C can see
 * except that the numbers become true.
 *
 * It is also the demo's parachute: if the live checker breaks at 3 a.m., we can
 * still show the whole story end to end and say plainly that it is simulated.
 */
import { cannedReport } from "../ai/fallback.js";
import * as store from "../store.js";
import type { ArkivRecord, CheckerResult, SubmissionMetadata } from "../types.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Demo numbers from new_PLAN.md: base pay 50 USDC, auto-pay limit 50 USDC. */
const BASE_PAY_USDC = 50;

export async function runMockPipeline(
  reportId: string,
  meta: SubmissionMetadata,
  exploitHash: `0x${string}`,
): Promise<void> {
  // Stage 1: the fork run. The real one takes 10-60s; 3s keeps the demo brisk.
  await sleep(3000);

  const checker: CheckerResult = {
    verified: true,
    ruleBroken: "no-theft",
    severity: "critical",
    valueMovedUsdc: 1000,
    forkBlock: 7_200_000,
    exploitHash,
    reportId,
  };
  store.setChecker(reportId, checker);
  store.setStatus(reportId, "verified");

  // Stage 2: the evidence report.
  await sleep(2000);
  store.setEvidence(reportId, cannedReport(checker));

  // Stage 3: the automatic base payout.
  await sleep(2000);
  store.setPayout(reportId, {
    txHash: `0x${"ab".repeat(32)}`,
    paidUsdc: BASE_PAY_USDC,
  });
  store.setStatus(reportId, "base-paid");

  // Stage 4: the public record.
  await sleep(1000);
  const record: ArkivRecord = {
    bountyId: meta.bountyId,
    reportId,
    exploitHash,
    severity: checker.severity,
    valueMovedUsdc: checker.valueMovedUsdc,
    status: "base-paid",
    paidUsdc: BASE_PAY_USDC,
    bonusUsdc: 0,
    createdAt: Math.floor(Date.now() / 1000),
  };
  store.mirrorArkivRecord(record);
  store.setArkiv(reportId, {
    entityKey: `0x${"cd".repeat(32)}`,
    url: null,
  });
}
