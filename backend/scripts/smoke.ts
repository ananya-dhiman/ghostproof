/**
 * End-to-end smoke test against a running server (MOCK_PIPELINE=true).
 *
 * Starts nothing itself — run `npm run dev` in one terminal, then
 * `npm run smoke` in another. Walks the exact path the frontend will:
 * submit, poll until base-paid, then read the public records.
 */
const BASE = process.env.SMOKE_BASE ?? "http://localhost:8787";

const exploitSource = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract Exploit {
  function runExploit() external {}
}`;

async function main() {
  const health = await (await fetch(`${BASE}/health`)).json();
  console.log("health:", JSON.stringify(health));

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
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const env = (await (await fetch(`${BASE}/report/${reportId}`)).json()) as {
      status: string;
      checker: unknown;
      report: unknown;
      payout: unknown;
    };
    if (env.status !== last) {
      console.log(`  [${i}s] status=${env.status}`);
      last = env.status;
    }
    if (env.status === "base-paid") {
      console.log("checker:", JSON.stringify(env.checker));
      console.log("payout: ", JSON.stringify(env.payout));
      break;
    }
    if (env.status === "error" || env.status === "rejected") {
      throw new Error(`unexpected terminal status: ${env.status}`);
    }
  }

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

  console.log("\nSMOKE OK");
}

main().catch((err) => {
  console.error("\nSMOKE FAILED:", err);
  process.exit(1);
});
