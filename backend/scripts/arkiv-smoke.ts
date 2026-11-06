/**
 * Standalone Arkiv write test — run once you have ARKIV_ACCESS_KEY + a funded
 * rabdi account in .env, to confirm B6 works without needing the whole chain:
 *
 *   PATH="/c/Users/Admin/tools/node-v22.23.4-win-x64:$PATH" npm run arkiv-smoke
 *
 * Writes one sample ArkivReportRecord and prints the entity key + tx hash.
 */
import { arkivReady, writeArkivRecord } from "../src/arkiv/client.js";
import type { ArkivRecord } from "../src/types.js";

async function main() {
  if (!arkivReady()) {
    console.error(
      "Arkiv not configured: set ARKIV_ACCESS_KEY and ARKIV_PRIVATE_KEY in backend/.env",
    );
    process.exit(1);
  }

  const sample: ArkivRecord = {
    bountyId: "vault-01",
    reportId: `rep_smoke_${Date.now()}`,
    exploitHash: `0x${"ab".repeat(32)}`,
    severity: "critical",
    valueMovedUsdc: 1000,
    status: "base-paid",
    paidUsdc: 50,
    bonusUsdc: 0,
    createdAt: Math.floor(Date.now() / 1000),
  };

  console.log("Writing sample record to Arkiv (rabdi)...");
  const result = await writeArkivRecord(sample);
  if (!result) {
    console.error("Write returned null — see the logged error above.");
    process.exit(1);
  }
  console.log("entityKey:", result.entityKey);
  console.log("txHash:   ", result.txHash);
  console.log("\nARKIV SMOKE OK");
}

main().catch((err) => {
  console.error("ARKIV SMOKE FAILED:", err);
  process.exit(1);
});
