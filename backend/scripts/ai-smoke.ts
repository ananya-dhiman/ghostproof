/**
 * Standalone report test — run with OPENROUTER_API_KEY set to confirm the live
 * evidence report works without running a full payout:
 *
 *   npm run ai-smoke
 *
 * Prints whether the report came from the live model (fallback:false) or the
 * canned fallback, plus the generated summary.
 */
import { generateReport } from "../src/ai/report.js";
import type { CheckerResult } from "../src/types.js";

const sample: CheckerResult = {
  verified: true,
  ruleBroken: "no-theft",
  severity: "critical",
  valueMovedUsdc: 1000,
  forkBlock: 12078095,
  exploitHash: `0x${"ab".repeat(32)}`,
  reportId: "rep_ai_smoke",
};

const exploitSrc = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {VulnerableVault} from "target/VulnerableVault.sol";
contract ExploitDrain {
  function run(VulnerableVault vault) external { vault.emergencyWithdraw(); }
}`;

async function main() {
  console.log("Generating evidence report via OpenRouter...");
  const report = await generateReport(sample, exploitSrc);
  console.log("fallback:", report.fallback === true ? "true (canned)" : "false (LIVE)");
  console.log("\n--- full evidence report ---");
  console.log(JSON.stringify(report, null, 2));
  console.log("----------------------------\n");
  if (report.fallback) {
    console.log("\n(Used the canned fallback — set OPENROUTER_API_KEY, or the live call failed; see logs above.)");
  } else {
    console.log("\nAI SMOKE OK (live)");
  }
}

main().catch((err) => {
  console.error("AI SMOKE FAILED:", err);
  process.exit(1);
});
