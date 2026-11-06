/**
 * The checker: run a submitted exploit safely, measure it, apply the company's
 * pre-written rules, and produce interface #2 (CheckerResult).
 *
 * No AI anywhere in here. The number that can trigger a payout comes only from
 * what the exploit moved on-chain and which rule the company wrote in advance.
 */
import type { CheckerResult, SeverityName } from "../types.js";
import { findExploitContract } from "./guard.js";
import { runForge } from "./forge.js";
import { parseForgeOutput, type ParsedRun } from "./parse.js";
import { buildSandbox } from "./sandbox.js";

export interface CheckerOutcome {
  checker: CheckerResult;
  /** set when verified is false: why we could not confirm a finding */
  error: string | null;
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

  const sandbox = await buildSandbox(exploitSource, contractName);
  let parsed: ParsedRun;
  try {
    const run = await runForge(sandbox.dir);
    if (run.timedOut) {
      return {
        checker: blankResult(reportId, exploitHash),
        error: "the exploit took too long to run and was stopped",
      };
    }
    parsed = parseForgeOutput(run.stdout, run.stderr);
  } finally {
    await sandbox.cleanup();
  }

  if (!parsed.compiled || !parsed.ran) {
    return {
      checker: blankResult(reportId, exploitHash),
      error: parsed.error ?? "the exploit did not compile or run",
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
      forkBlock: 0, // local run (B1/B2); becomes the real fork block at B3
      exploitHash,
      reportId,
    },
    error: null,
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
