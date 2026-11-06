/**
 * The canned evidence report.
 *
 * This exists so the demo never hangs on a model call. If the model request is
 * slow, rate-limited or the key is missing, we serve this instead and mark it
 * `fallback: true` — the UI shows that honestly rather than passing a template
 * off as a live write-up.
 *
 * It describes the demo target's real bug: VulnerableVault.emergencyWithdraw is
 * missing its owner-only check, so any fresh account drains the whole vault.
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
      "That account called the vault's emergencyWithdraw function.",
      "emergencyWithdraw was meant to be callable only by the vault owner, but the permission check was never added.",
      "With no check to stop it, the function sent the vault's entire token balance to whoever called it.",
      `The attacker walked away with ${value} test USDC that belonged to the vault's depositors.`,
    ],
    rootCause:
      "The vault's emergency withdrawal function is missing its owner-only " +
      "permission check, so any account at all can call it and drain every " +
      "deposit in a single transaction.",
    suggestedSeverity: severity,
    suggestedFixSummary:
      "Restrict emergencyWithdraw to the owner (an onlyOwner / access-control " +
      "check), so a fresh account can never call it. Review every other " +
      "privileged function for the same missing check.",
    fallback: true,
  };
}
