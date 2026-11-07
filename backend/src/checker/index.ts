/**
 * The checker: run a submitted exploit safely, measure it, apply the company's
 * pre-written rules, and produce interface #2 (CheckerResult).
 *
 * No AI anywhere in here. The number that can trigger a payout comes only from
 * what the exploit moved on-chain and which rule the company wrote in advance.
 */
import type { CheckerResult, RunEvidence, SeverityName } from "../types.js";
import { addresses, addressesDeployed, publicClient } from "../chain/clients.js";
import { env } from "../env.js";
import { findExploitContract } from "./guard.js";
import { runForge, type ForgeOptions } from "./forge.js";
import { parseForgeOutput, type ParsedRun } from "./parse.js";
import { buildSandbox, type SandboxOptions } from "./sandbox.js";
import { buildReplay } from "./replay.js";

export interface CheckerOutcome {
  checker: CheckerResult;
  /** set when verified is false: why we could not confirm a finding */
  error: string | null;
  /**
   * The re-runnable proof: the generated test, the submission, and forge's own
   * output. Present whenever we got as far as running forge — including a
   * compile failure, where the compiler error is itself the evidence.
   */
  runEvidence?: RunEvidence | null;
}

const FORGE_LOG_LIMIT = 24_000;

function truncate(stdout: string, stderr: string): string {
  const combined = [stdout, stderr].filter(Boolean).join("\n");
  if (combined.length <= FORGE_LOG_LIMIT) return combined;
  return `${combined.slice(0, FORGE_LOG_LIMIT)}\n… truncated (${combined.length} chars total)`;
}

/** A's Rules: 1 = Medium, 2 = High, 3 = Critical. */
function severityName(n: number): SeverityName {
  if (n >= 3) return "critical";
  if (n === 2) return "high";
  return "medium";
}

/**
 * The company's rule registry, in check order. The harness evaluates each via
 * A's Rules library and logs the outcome; the first one broken decides the
 * severity for pay. no-theft is the mandatory default rule.
 */
const RULE_ORDER: { key: keyof ParsedRun["rules"]; ruleId: string }[] = [
  { key: "noTheft", ruleId: "no-theft" },
  { key: "accounting", ruleId: "fee-accounting" },
];

export async function runChecker(
  reportId: string,
  exploitSource: string,
  exploitHash: string,
): Promise<CheckerOutcome> {
  const contractName = findExploitContract(exploitSource);
  if (!contractName) {
    return {
      checker: blankResult(reportId, exploitHash),
      error: "could not find a contract with a run() function in the submission",
    };
  }

  // When A's contracts are deployed and we have an RPC, fork the live chain and
  // run against the real deployed vault (real forkBlock). Otherwise run the
  // self-contained harness that deploys a fresh vault locally (forkBlock 0).
  let sandboxOpts: SandboxOptions = {};
  let forgeOpts: ForgeOptions = {};
  let forkBlock = 0;
  if (addressesDeployed() && env.sepoliaRpcUrl) {
    try {
      const block = await publicClient().getBlockNumber();
      forkBlock = Number(block);
      sandboxOpts = { fork: { usdc: addresses.usdc, vault: addresses.vault } };
      forgeOpts = { forkUrl: env.sepoliaRpcUrl, forkBlock: block };
    } catch (err) {
      // RPC hiccup — fall back to the self-contained run rather than fail.
      console.error(`[checker] ${reportId} fork setup failed, using local run:`, err);
    }
  }

  const sandbox = await buildSandbox(exploitSource, contractName, sandboxOpts);
  let parsed: ParsedRun;
  let runEvidence: RunEvidence | null = null;
  try {
    const run = await runForge(sandbox.dir, forgeOpts);
    const forgeLog = truncate(run.stdout, run.stderr);
    // Evidence exists even if the run failed: the compiler error is evidence too.
    runEvidence = { forkBlock, replay: [], forgeLog };
    if (run.timedOut) {
      return {
        checker: blankResult(reportId, exploitHash),
        error: "the exploit took too long to run and was stopped",
        runEvidence,
      };
    }
    parsed = parseForgeOutput(run.stdout, run.stderr);
    // Decode what the EVM actually emitted into an ordered replay.
    runEvidence = {
      forkBlock: parsed.forkBlockNumber || forkBlock,
      replay: buildReplay({
        rawLogs: parsed.rawLogs,
        decodedLogs: parsed.decodedLogs,
        forkBlock: parsed.forkBlockNumber || forkBlock,
        known: { usdc: addresses.usdc, vault: addresses.vault },
      }),
      forgeLog,
    };
  } finally {
    await sandbox.cleanup();
  }

  if (!parsed.compiled || !parsed.ran) {
    return {
      checker: blankResult(reportId, exploitHash),
      error: parsed.error ?? "the exploit did not compile or run",
      runEvidence,
    };
  }

  // First broken rule in registry order decides the severity for pay.
  let ruleBroken: string | null = null;
  let severity: SeverityName | null = null;
  for (const { key, ruleId } of RULE_ORDER) {
    const r = parsed.rules[key];
    if (r.broken) {
      ruleBroken = ruleId;
      severity = severityName(r.severity);
      break;
    }
  }

  const valueMovedUsdc = Number(parsed.movedRaw) / 1e6;

  return {
    checker: {
      verified: true,
      ruleBroken,
      severity,
      valueMovedUsdc,
      forkBlock, // real Sepolia block when forking; 0 for a self-contained run
      exploitHash,
      reportId,
    },
    error: null,
    runEvidence,
  };
}

function blankResult(reportId: string, exploitHash: string): CheckerResult {
  return {
    verified: false,
    ruleBroken: null,
    severity: null,
    valueMovedUsdc: 0,
    forkBlock: 0,
    exploitHash,
    reportId,
  };
}
