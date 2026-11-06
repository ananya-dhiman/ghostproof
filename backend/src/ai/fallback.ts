/**
 * The canned evidence report.
 *
 * This exists so the demo never hangs on a model call. If the Anthropic request
 * is slow, rate-limited or the key is missing, we serve this instead and mark
 * it `fallback: true` — the UI shows that honestly rather than passing a
 * template off as a live write-up.
 *
 * Note what it does NOT do: it never invents a severity for payment. The
 * severity that triggers money comes from which of the company's pre-written
 * rule tests failed on the fork, and it is passed in here.
 */
import type { CheckerResult, EvidenceReport, SeverityName } from "../types.js";

export function cannedReport(checker: CheckerResult): EvidenceReport {
  const severity: SeverityName = checker.severity ?? "medium";
  const value = checker.valueMovedUsdc;
  const where =
    checker.forkBlock > 0
      ? `a copy of the chain at block ${checker.forkBlock}`
      : "a sandbox copy of the chain";

  return {
    summary:
      `An attacker starting from a fresh account with no permissions ended up ` +
      `holding ${value} test USDC that belonged to other depositors. The attack ` +
      `was reproduced on ${where}.`,
    steps: [
      "A brand new account was created with no deposits and no special permissions.",
      "The account called the vault's withdraw path.",
      "Before the vault finished updating its own records, it sent funds back to the attacker's contract.",
      "The attacker's contract used that moment to call withdraw again, repeating the payout against a balance the vault had not yet reduced.",
      `The loop ended with ${value} test USDC moved out of the vault to the attacker.`,
    ],
    rootCause:
      "The vault sends money out before it writes down that the money is gone. " +
      "Anything the vault calls during that gap can call back in and be paid " +
      "twice from the same balance.",
    suggestedSeverity: severity,
    suggestedFixSummary:
      "Update the stored balance before transferring, so the vault's records are " +
      "already correct by the time an outside contract regains control. A " +
      "re-entrancy guard on the withdraw function is a second layer.",
    fallback: true,
  };
}
