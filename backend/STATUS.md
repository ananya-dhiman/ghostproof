# Ghostproof — Backend (Person B) progress

**Living status of the `b-backend` branch.** Person A's and Person C's Claude:
read this first when you pull or reference this branch — it tells you what the
backend already provides, what it still needs from you, and the exact shapes you
integrate against. It is updated on every push to `b-backend`.

- **Last updated:** commit `5c25c8b` + this doc — B5 (AI report) complete
- **Owner:** Person B (checker + backend), Node/TypeScript, folder `/backend`
- **Run it:** `cd backend && npm run dev` (needs Node 22 on PATH only for B6/Arkiv;
  Node 20 runs everything else). `MOCK_PIPELINE=true` (default) serves realistic
  fake data so the frontend can build without keys; `MOCK_PIPELINE=false` runs the
  real checker (needs Foundry installed).

---

## ⚠️ Shared-interface facts you depend on

1. **Exploit arrives as a JSON string**, not a file upload. `POST /submit` body:
   `{ bountyId, hackerAddress, worldIdNullifier, exploitSource }` where
   `exploitSource` is the full text of the submitted `.sol`.
2. **Exploit entry point is `run(VulnerableVault vault)`** (matches A's
   `ExploitDrain`), superseding the plan's `runExploit()`. The guard enforces a
   `run(` function.
3. **`shared/types.ts`** keeps A's seeded names (`CheckerResult`,
   `EvidenceReport`, `ArkivReportRecord`, `SeverityName`) and adds the
   HTTP-contract types + `exploitSource` on `Submission`;
   `ArkivReportRecord.severity` is nullable. `SeverityName` is the string form;
   A's `config.ts` `Severity` is the numeric on-chain enum (MEDIUM=1, HIGH=2,
   CRITICAL=3) — different things, don't conflate.

---

## ✅ Done (on the branch now)

- **HTTP API** — base `http://localhost:8787`, CORS open to `localhost:3000`:
  | Method | Path | Returns |
  |--------|------|---------|
  | POST | `/submit` | `202 { reportId, status }` — async, never blocks on the fork run |
  | GET | `/report/:id` | the report envelope (poll ~2s) |
  | GET | `/reports` | all reports, newest first (company inbox) |
  | GET | `/records` | `{ source, records: ArkivReportRecord[] }` (public track record) |
  | POST | `/verify-human` | `{ verified, nullifierHash, alreadyUsed, error? }` (stub until B7) |
  | GET | `/health` | which subsystems are live |
- **Report envelope** (`GET /report/:id`): `{ reportId, status, submission{bountyId,
  hackerAddress, submittedAt}, checker|null, report|null, payout|null, arkiv|null,
  error|null }`. `status` walks `checking → verified → base-paid`, or
  `rejected` / `duplicate` / `error`. Fields fill in stages: `checker`, then
  `report`, then `payout`/`arkiv`.
- **B0** scaffold, env validation, in-memory store, duplicate detection
  (normalized exploit hash), mock pipeline.
- **Safety guard** — bans `vm.ffi`/`vm.env*`/fs cheatcodes/`vm.rpc`/non-local
  `createFork`/absolute imports before any compile; sandbox `ffi=false` +
  `fs_permissions=[]`; `forge` child runs with a scrubbed env (no secrets, no RPC)
  and a hard kill-timeout; one submission at a time; per-run temp dir cleaned up.
- **B1/B2 checker** — compiles the submission against A's contracts in a throwaway
  Foundry project, runs it from a fresh account, measures USDC moved, applies A's
  `Rules` (first broken wins → severity), produces `CheckerResult`. No AI, no live
  chain. Verified: demo exploit → `verified, ruleBroken:"no-theft",
  severity:"critical", valueMovedUsdc:1000`; non-compiling → `rejected` + compiler
  error; harmless exploit → `verified, ruleBroken:null`.
- **B5 AI report** — `claude-haiku-5-5` via structured output; the measured result
  is the ground truth, the model only describes it. Always falls back to a canned
  report on no-key/parse-fail/error/20s-timeout, flagged `fallback:true`.
  (Live call not yet verified — no API key in B's env; fallback path verified.)

## ⬜ Not done — and who unblocks each

| Step | What it adds | Blocked on |
|------|--------------|-----------|
| **B3** real Sepolia fork | checker measures against A's *deployed* vault, not a fresh local one | **A:** addresses in `shared/config.ts`. **Operator:** `SEPOLIA_RPC_URL` in `.env` |
| **B4** payout | call A's `BountyPool.settleReport(...)` after a rule breaks | **A:** deployed `BountyPool` address, backend wallet set as `settler`, exact `settleReport` signature + severity→tier mapping, ABI in `/shared/abis/`. **Operator:** `BACKEND_PRIVATE_KEY` + Sepolia gas |
| **B6** Arkiv records | write `ArkivReportRecord` to rabdi with an expiry; `/records` reads it | rabdi faucet funds + `ARKIV_PRIVATE_KEY`. No code dependency on A/C |
| **B7** World ID | real `verifyCloudProof` in `/verify-human` | **C:** IDKit widget → POST `{ proof, merkle_root, nullifier_hash, verification_level }`. **Operator:** `WORLD_APP_ID` |
| **B8** docs | `AI_USAGE.md`, Arkiv docs | after feature freeze |

## 📋 Person A — action items

- Your contracts are **vendored** into `backend/sandbox-template/src/` so the
  checker can compile submissions. **Tell B whenever you change any of them**
  (vault, MockUSDC, IERC20, Rules) so B re-syncs; otherwise the checker compiles
  against stale copies.
- For **B4**: deploy `BountyPool`, set the backend wallet as `settler`, and share
  the exact `settleReport` signature + how severity maps to the paid tier, plus
  the ABI in `/shared/abis/` and addresses in `shared/config.ts`.

## 📋 Person C — action items

- `/submit` is **async**: get `reportId`, then poll `GET /report/:id` every ~2s.
  Read the picked `.sol` file to a string for `exploitSource`.
- Company inbox = `GET /reports`; public track record = `GET /records`.
- **World ID:** you build the IDKit widget; POST its output to `/verify-human` as
  `{ proof, merkle_root, nullifier_hash, verification_level }`. Backend verifies
  (never the browser) and blocks a second submission from the same nullifier.
  Stubbed until B7 — returns `verified:false` with a reason but records the
  nullifier, so the flow is testable now.
- Build the whole UI now against `MOCK_PIPELINE=true` (realistic data, no keys).

---

## Changelog

- **`5c25c8b`** — B5: live AI evidence report (`claude-haiku-5-5`) + canned fallback.
- **`ad443a9`** — B1/B2: real checker (Foundry sandbox runner + rules + severity).
- **`f508e8f`** — toolchain: Foundry 1.9.0, portable Node 22.
- **`d0adbc8`** — B0: scaffold, mock pipeline, safety guard, HTTP contract.
