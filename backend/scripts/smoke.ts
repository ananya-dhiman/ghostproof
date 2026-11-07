/**
 * End-to-end smoke test against a running server.
 *
 * Starts nothing itself — run `npm run dev` in one terminal, then
 * `npm run smoke` in another. Walks the exact path the frontend will:
 * submit, poll until base-paid, then read the public records.
 *
 * Two notes before you run it:
 *  - It submits the real demo exploit (`fixtures/Exploit.sol`), because the
 *    guard requires a `run(VulnerableVault vault)` entry point. A hand-written
 *    stub is rejected before the pipeline starts.
 *  - If `WORLD_APP_ID` is set, `/submit` demands a World ID proof this server
 *    has verified, which a script cannot produce. Start the server with
 *    `WORLD_APP_ID= npm run dev` for a scripted run, or test in the browser.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:8787";

const here = path.dirname(fileURLToPath(import.meta.url));
const exploitSource = readFileSync(
  path.join(here, "..", "fixtures", "Exploit.sol"),
  "utf8",
);

async function main() {
  const health = (await (await fetch(`${BASE}/health`)).json()) as {
    subsystems: { worldId: boolean };
  };
  console.log("health:", JSON.stringify(health));
  if (health.subsystems.worldId) {
    console.log(
      "\nNOTE: World ID is on, so /submit needs a verified proof and this\n" +
        "script cannot make one. Restart the server with `WORLD_APP_ID= npm run dev`\n" +
        "to smoke-test the pipeline, or do the run in the browser instead.",
    );
  }

  const submit = await fetch(`${BASE}/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      bountyId: "vault-01",
      hackerAddress: "0x" + "11".repeat(20),
      worldIdNullifier: "0xsmoke",
      exploitSource,
    }),
  });
  const submitBody = await submit.json();
  console.log(`submit: ${submit.status}`, JSON.stringify(submitBody));
  if (submit.status !== 202) throw new Error("submit did not return 202");

  const { reportId } = submitBody as { reportId: string };

  let last = "";
  let settled = false;
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const env = (await (await fetch(`${BASE}/report/${reportId}`)).json()) as {
      status: string;
      checker: unknown;
      report: unknown;
      payout: unknown;
      error: string | null;
    };
    if (env.status !== last) {
      console.log(`  [${i}s] status=${env.status}`);
      last = env.status;
    }
    if (env.status === "base-paid") {
      console.log("checker:", JSON.stringify(env.checker));
      console.log("payout: ", JSON.stringify(env.payout));
      console.log("report: ", JSON.stringify(env.report));
      settled = true;
      break;
    }
    if (env.status === "error" || env.status === "rejected") {
      throw new Error(`unexpected terminal status: ${env.status} — ${env.error}`);
    }
  }
  if (!settled) throw new Error(`never reached base-paid (last status: ${last})`);

  const records = await (await fetch(`${BASE}/records`)).json();
  console.log("records:", JSON.stringify(records));

  // The duplicate guard: the same source again must come back as a duplicate.
  const dup = await fetch(`${BASE}/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      bountyId: "vault-01",
      hackerAddress: "0x" + "11".repeat(20),
      worldIdNullifier: "0xsmoke2",
      exploitSource,
    }),
  });
  const dupBody = (await dup.json()) as { status: string };
  console.log("duplicate resubmit:", dupBody.status);
  if (dupBody.status !== "duplicate") {
    throw new Error(`duplicate guard did not fire: ${JSON.stringify(dupBody)}`);
  }

  console.log("\nSMOKE OK");
}

main().catch((err) => {
  console.error("\nSMOKE FAILED:", err);
  process.exit(1);
});
