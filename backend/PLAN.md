# Ghostproof backend (Person B) — implementation plan

Scope: **run the attack safely, measure it, write the report, pay out, record it.**
Reference: `../new_PLAN.md`. Branch `b-backend`. Folder `/backend` only.

---

## 0. Blockers to clear first (do these before writing code)

| # | Blocker | Why it matters | Fix |
|---|---------|----------------|-----|
| 0.1 | **Node is v20.19.5** | `@arkiv-network/sdk` v0.6.x needs **Node 22+** | Install Node 22 LTS (nvm-windows: `nvm install 22 && nvm use 22`). Everything else runs on 20, so Arkiv is the forcing function. |
| 0.2 | **Foundry not installed** (`forge`, `anvil`, `cast` all missing) | The whole checker is `anvil` + `forge test --json` | Git Bash: `curl -L https://foundry.paradigm.xyz | bash` then `foundryup`. If that fails on Windows, download `foundry_nightly_win32_amd64.zip` from the Foundry releases page and put the three exes on PATH. **Verify `forge --version` and `anvil --version` before step 1.** |
| 0.3 | **Sepolia RPC key** | forking, reading USDC balances, sending the payout tx | Alchemy or Infura free tier → `.env` as `SEPOLIA_RPC_URL`. |
| 0.4 | **Arkiv testnet funds** | writing records to rabdi costs gas | Hit the rabdi faucet early. Faucets are slow and this is the thing most likely to bite at hour 12. |
| 0.5 | **Anthropic API key** | evidence report | `.env` as `ANTHROPIC_API_KEY`. |
| 0.6 | **A's contracts do not exist yet** | the fork runner needs a target | Do NOT wait. Write a throwaway re-entrancy vault in `backend/fixtures/` and build the runner against a **local** anvil. Swap to A's Sepolia address when it lands — one config change. |

---

## 1. Decisions I am making (tell A and C)

Judgement calls the team plan left open. Each is the simplest thing that works.

**1.1 — How the exploit file reaches us.** `POST /submit` takes **JSON**, not multipart:

```json
{ "bountyId": "vault-01", "hackerAddress": "0x...",
  "worldIdNullifier": "0x...", "exploitSource": "// SPDX...\ncontract Exploit { ... }" }
```

The source is a string field. A file picker on C's side just reads the file to text.
Simpler than multipart, works from curl, and the source is what we hash anyway.

**1.2 — `/submit` is async.** A fork run takes 10–60s; we never hold the HTTP request open.

- `POST /submit` → `202 { "reportId": "rep_001", "status": "checking" }`
- `GET /report/:id` → the envelope below; C polls every 2s to drive Checking → Base paid.

```json
{
  "reportId": "rep_001",
  "status": "checking|verified|rejected|duplicate|base-paid|bonus-added|error",
  "submission": { "bountyId": "vault-01", "hackerAddress": "0x...", "submittedAt": 1699999999 },
  "checker": null,
  "report": null,
  "payout": { "txHash": "0x...", "paidUsdc": 50 },
  "arkiv": { "entityKey": "0x...", "url": "..." },
  "error": null
}
```

`checker` is interface #2 (null while checking). `report` is interface #3 (null until the
AI call returns).

**1.3 — Rule severity comes from a JSON registry, not code comments.** Person A writes
`/contracts/rules/rules.json`; we read it. Parsing severity out of Solidity comments is
fragile, and A can edit JSON in ten seconds:

```json
[
  { "file": "NoTheft.t.sol",       "contract": "NoTheft",       "ruleId": "no-theft",       "severity": "critical", "mandatory": true },
  { "file": "FeeAccounting.t.sol", "contract": "FeeAccounting", "ruleId": "fee-accounting", "severity": "medium",   "mandatory": false }
]
```

Order in the file = check order. **First failing rule wins** → `ruleBroken` + `severity`.

**1.4 — Rule tests re-run the exploit in `setUp()`.** This is the important one.
`forge test` does not persist state back to anvil, and each test function starts from a
clean fork — so "run the rules against the post-exploit state" only works if the exploit is
part of each rule's setup. A's rule tests extend a base we generate:

```solidity
abstract contract RuleBase is Test {
    // attaches to the vault, creates a fresh attacker with zero permissions,
    // deploys the submitted Exploit, calls runExploit()
    function setUp() public virtual { /* generated */ }
}

contract NoTheft is RuleBase {                 // <- A writes only this part
    function test_noTheft() public {
        assertEq(usdc.balanceOf(attacker), 0, "no-theft");
    }
}
```

Deterministic, order-independent, no cross-test state leakage. **A needs this before
writing the rule files.**

**1.5 — `/shared/types.ts` is ours to draft** (we own interfaces #2, #3, #5 and the HTTP
contract). Write it in hour 1, announce it, then it is frozen.

**1.6 — Payout is owner-only.** The documented cut. The backend holds the pool owner key
and calls `autoPayout(hacker, severity, "0x")`. The `bytes sig` argument stays in the ABI
so A does not have to change the contract if we get time for EIP-712. We say "in
production this is a signed attestation from a sealed machine" on screen.

---

## 2. Layout

```
/backend
  package.json            # ESM, own deps — there is no root package.json, do not create one
  tsconfig.json
  .env.example            # names only, never values
  .gitignore              # .env, node_modules, runs/
  PLAN.md                 # this file
  src/
    index.ts              # express app, CORS for localhost:3000, route mounting
    env.ts                # load + validate env (fail loudly at boot, not at hour 13)
    types.ts              # re-exports /shared/types.ts
    store.ts              # in-memory Map of reports + seen exploit hashes (demo-grade)
    routes/
      submit.ts           # POST /submit        -> 202 { reportId }
      report.ts           # GET  /report/:id    -> envelope (1.2)
      records.ts          # GET  /records       -> Arkiv list, mirrored from store
      worldid.ts          # POST /verify-human  -> verifyCloudProof
      health.ts           # GET  /health        -> which subsystems are live
    checker/
      guard.ts            # hostile-source scan + size cap (first, it is cheap)
      sandbox.ts          # per-run temp dir from sandbox-template/, write Exploit.t.sol
      anvil.ts            # spawn anvil --fork-url, free port, wait-for-ready, kill
      forge.ts            # spawn forge test --json, scrubbed env, hard timeout
      parse.ts            # forge JSON -> per-test pass/fail + decoded logs
      rules.ts            # read rules.json, first failure -> ruleBroken + severity
      measure.ts          # USDC delta for the attacker -> valueMovedUsdc
      index.ts            # orchestrates the above -> interface #2
    ai/
      schema.ts           # Zod schema for interface #3
      report.ts           # messages.parse (claude-haiku-5-5), 20s timeout
      fallback.ts         # the canned report — must always work
    chain/
      clients.ts          # viem public + wallet client (Sepolia)
      payout.ts           # autoPayout(), waits for the receipt
      reads.ts            # pool balance, getConfig()
    arkiv/
      client.ts           # @arkiv-network/sdk, write record #5 with expiresIn
  sandbox-template/
    foundry.toml          # ffi = false, fs_permissions = [], pinned solc
    src/                  # vault + interfaces (local copy, later A's)
    test/RuleBase.sol     # generated base from 1.4
  fixtures/
    VulnerableVault.sol   # throwaway target until A deploys
    Exploit.t.sol         # the demo exploit, also our own smoke test
    rules.json            # stand-in until A ships theirs
```

Deps: `express`, `cors`, `viem`, `zod`, `@anthropic-ai/sdk`, `@worldcoin/idkit-core`
(for `verifyCloudProof`), `@arkiv-network/sdk`, `dotenv`; dev: `tsx`, `typescript`,
`@types/*`.

---

## 3. The pipeline, step by step

`POST /submit` → enqueue → run these in order, writing status into the store as we go.

1. **Guard** (ms). Size cap 64 KB. Reject on `vm.ffi`, `vm.env`, `vm.readFile`,
   `vm.writeFile`, `vm.rpc`, `vm.createFork(` with a non-local URL, absolute-path imports.
   Rejected → `status: "rejected"` with a reason; the company never sees it.
2. **Dedupe** (ms). `exploitHash = keccak256(source with whitespace + comments normalized)`.
   Seen before → `status: "duplicate"`, stop.
3. **Pin the fork block.** `publicClient.getBlockNumber()` → `forkBlock`.
4. **Start anvil** on a free port: `anvil --fork-url $SEPOLIA_RPC_URL --fork-block-number N
   --port P --silent`. Poll `eth_blockNumber` until ready (max 20s).
5. **Build the sandbox.** Copy `sandbox-template/` to a temp dir, drop in `Exploit.t.sol`,
   generate `RuleBase.sol` with the vault + USDC addresses, copy A's rule tests in.
6. **Measure + exploit.** `forge test --match-contract Measure --fork-url
   http://127.0.0.1:P --json`. The Measure harness records attacker USDC before, calls
   `runExploit()`, records after, and `console2.log`s the raw delta. Parse `decoded_logs` →
   `valueMovedUsdc = delta / 1e6`. Reverted or failed to compile → `verified: false`, stop,
   return the compiler error to the hacker.
7. **Rules.** `forge test --fork-url http://127.0.0.1:P --json` over the rule contracts in
   registry order. First failing contract → `ruleBroken`, `severity`. Nothing fails →
   `verified: true, ruleBroken: null, severity: null` — the exploit ran but broke no rule
   the company wrote in advance, so **no automatic pay**. Say that plainly in the UI.
8. **Kill anvil, delete the temp dir.** Always, in a `finally`.
9. Interface #2 is now complete. Store it; C's poll shows the scorecard.
10. **Evidence report.** One `messages.parse` call with interface #2 + the exploit source.
    20s timeout → canned fallback, flagged `"fallback": true` so we stay honest on stage.
11. **Payout.** A rule broke, the severity is in the tiers, base ≤ limit, monthly cap not
    hit → `autoPayout(hacker, severityEnum, "0x")`. Wait for the receipt, store the hash,
    `status: "base-paid"`.
12. **Arkiv.** Write record #5 with `expiresIn` so an unanswered report auto-expires.
    Mirror it into the store so `/records` still works if Arkiv is down.

Failure anywhere after step 6 degrades gracefully: keep the verified checker result and
mark which later stage failed. A dead Anthropic or Arkiv must never lose a valid finding.

---

## 4. Build order

**B0 — Unblock C (first 45 min).** Scaffold, express on :8787, all five routes returning
hardcoded but correctly-shaped data from `fixtures/`. Draft `/shared/types.ts` and announce
it. **Tell C the base URL and the envelope the moment this is up** — C is blocked until
then and nothing else we do is more urgent.

**B1 — Fork runner, local target (2–3h).** The hard part, start it early. anvil spawn/kill,
sandbox dir, forge spawn with scrubbed env + timeout, JSON parse, value-moved from logs,
against our own `fixtures/VulnerableVault.sol`. No Sepolia, no dependency on A.
*Done = `POST /submit` with the demo exploit returns a real `valueMovedUsdc`.*

**B2 — Rules + severity.** `rules.json`, generated `RuleBase.sol`, first-failure logic.
*Done = the demo exploit returns `ruleBroken: "no-theft", severity: "critical"`.*

**B3 — Point at A's Sepolia deploy.** Swap the local target for A's address from
`/shared/config.ts`, fork Sepolia for real. *Done = same result, on a Sepolia fork.*

**B4 — Payout.** viem wallet client, `autoPayout`, receipt. *Done = 50 USDC lands on the
hacker address on Sepolia and the tx hash shows in `/report/:id`.*

**B5 — AI report.** Zod schema, `messages.parse` with `claude-haiku-5-5`, canned fallback,
timeout. *Done = a readable report comes back — and still comes back with the API key
removed.*

**B6 — Arkiv.** Write record #5 with `expiresIn`; `GET /records` reads it back.
*Done = a record appears on Arkiv and `/records` lists it.*

**B7 — World ID route.** `POST /verify-human` with `verifyCloudProof`, action
`verify-human`, via the Simulator. Store the nullifier; block a second submission from the
same one. Coordinate with C, who builds the widget.

**B8 — Harden + docs.** Re-check the guard list, confirm the scrubbed env really is
scrubbed, add `/health`. Write `AI_USAGE.md` and the Arkiv docs we own (`why-arkiv.md`,
`how-you-use-arkiv.md`) — they are graded.

Against the team milestones: B0–B2 by +5h, B3–B4 by +9h, B5–B7 by +12h, B8 before the
+14h freeze.

---

## 5. Cuts, in the order we take them

1. EIP-712 signing → owner-only payout. *(already assumed)*
2. A registry of rules → just `no-theft`, hardcoded severity `critical`.
3. Value-moved from parsed `decoded_logs` → one `console2.log` line matched by regex.
4. anvil fork → `forge test --fork-url <sepolia>` directly. One less moving part; we lose
   the "sealed local network" story but the numbers are identical. Keep it behind
   `USE_ANVIL=false` as live insurance.
5. Arkiv write → still write it, but let the public page read from our `/records` mirror if
   the SDK fights us.
6. Live AI call → the canned report, said out loud on stage.

**Never cut:** the guard (step 1), the scrubbed env, the hard timeout. Running hostile
Solidity is the one place where a shortcut turns into a real incident.

---

## 6. Coordination checklist

**Ask Person A, now:**
- [ ] Rule tests extend `RuleBase` and assert only (1.4) — agreed?
- [ ] `rules.json` registry format (1.3) — agreed, and who writes the file?
- [ ] `autoPayout` keeps `bytes sig` in the ABI but is owner-only for the demo — agreed?
- [ ] What is the on-chain `severity` enum encoding? (`0=medium, 1=high, 2=critical`?)
- [ ] Vault + pool + USDC addresses into `/shared/config.ts` as soon as deployed, ABIs into
      `/shared/abis/`.
- [ ] The backend's address must be the pool owner, or whitelisted to call `autoPayout`.

**Tell Person C, now:**
- [ ] Base URL `http://localhost:8787`, CORS open to `localhost:3000`.
- [ ] `POST /submit` is JSON with `exploitSource` as a string (1.1).
- [ ] `/submit` is async — poll `GET /report/:id` every 2s (1.2); here is the envelope.
- [ ] World ID: the widget is yours, `POST /verify-human` is ours. Send us
      `{ proof, merkle_root, nullifier_hash, verification_level }`.
- [ ] `/records` returns an array of interface #5 objects.

**Env (`.env.example`):** `PORT`, `SEPOLIA_RPC_URL`, `BACKEND_PRIVATE_KEY`,
`ANTHROPIC_API_KEY`, `WORLD_APP_ID`, `WORLD_ACTION_ID`, `ARKIV_RPC_URL`,
`ARKIV_PRIVATE_KEY`, `USE_ANVIL`, `FORGE_TIMEOUT_MS`.
