# Ghostproof — Backend (Person B) progress

**Living status of the `b-backend` branch.** Person A's and Person C's Claude:
read this first when you pull or reference this branch — it tells you what the
backend already provides, what it still needs from you, and the exact shapes you
integrate against. It is updated on every push to `b-backend`.

- **Last updated:** merged `main`; B4 (payout) + B6 (Arkiv) code-complete; judge docs written. See changelog.
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
   CRITICAL=3) — different things, don't conflate. (These changes are on
   `b-backend`; `main` still has A's original `types.ts` until b-backend merges.)
4. **On-chain report id = `keccak256(reportId)`** (UTF-8 bytes). Backend uses it
   for `settleReport`; the frontend must use the same for `addBonus`/`reports`.

---

## ✅ Done (on the branch now)

- **HTTP API** — base `http://localhost:8787`, CORS open to `localhost:3000`:
  | Method | Path | Returns |
  |--------|------|---------|
  | POST | `/submit` | `202 { reportId, status }` — async, never blocks on the fork run |
  | GET | `/report/:id` | the report envelope (poll ~2s) |
  | GET | `/reports` | all reports, newest first (company inbox) |
  | GET | `/records` | `{ source, records: ArkivReportRecord[] }` (public track record) |
  | GET | `/pool` | `{ deployed, poolUsdc, autoPayLimitUsdc, monthlyCapUsdc, tiers }` — `deployed:false` until A deploys |
  | POST | `/verify-human` | `{ verified, nullifierHash, alreadyUsed, error? }` — real World ID cloud verify when `WORLD_APP_ID` is set; honest stub otherwise |
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
- **B4 payout (code-complete)** — on a broken rule, `settleReport(keccak256(id),
  hacker, severityUint8, "0x")` on A's `BountyPool` via viem, then records the
  paid amount + tx. Degrades cleanly: if the chain isn't wired the report stays
  `verified` with payout pending (no premature record). `GET /pool` reads config
  + balance. **Verified pre-deploy (graceful skip); on-chain settle needs A's
  deploy + key + settler auth.**
- **B6 Arkiv (code-complete)** — writes the public record to rabdi via
  `@arkiv-network/sdk` with an expiry (= response deadline), after a real payout;
  local mirror is the fallback for `/records`. **Needs `ARKIV_ACCESS_KEY` +
  funded key to verify; `npm run arkiv-smoke` tests it standalone.**
- **B7 World ID (backend-owned)** — `/verify-human` verifies the proof against
  World ID's v2 cloud endpoint directly (no SDK), records the nullifier on a real
  pass, and `/submit` blocks a second submission from the same nullifier. Honest
  stub when `WORLD_APP_ID` is unset. Verified against the live endpoint (dummy app
  → clean 401 with reason; real pass needs a real App ID + Simulator proof).
- **B8 docs (partial)** — `backend/AI_USAGE.md`, `/arkiv/why-arkiv.md`,
  `/arkiv/how-you-use-arkiv.md` written.
- **Merged `main`** → the branch now has A's contracts + ABIs (`shared/abis/`).

## ⬜ Not done — and who unblocks each

| Step | What it adds | Blocked on |
|------|--------------|-----------|
| **B3** real Sepolia fork | checker measures against A's *deployed* vault, not a fresh local one | **A:** addresses in `shared/config.ts`. **Operator:** `SEPOLIA_RPC_URL`. (Optional for the demo — the self-contained checker already produces correct numbers) |
| **B4 wiring** | actually send a payout tx | **A:** deploy + set backend wallet as `settler`. **Operator:** `BACKEND_PRIVATE_KEY` + Sepolia gas |
| **B6 wiring** | actually write to Arkiv | rabdi faucet funds + `ARKIV_ACCESS_KEY` + `ARKIV_PRIVATE_KEY` |
| **B7 wiring** | go live | **Operator:** `WORLD_APP_ID` + `WORLD_ACTION_ID=verify-human` in `.env`. **Team decision made:** backend owns World ID verification — **C should remove its own Next verify route** and instead POST the IDKit proof `{ proof, merkle_root, nullifier_hash, verification_level }` to backend `/verify-human` |
| **B8** remaining docs | `/arkiv/friction.md`, `/arkiv/reach.md`, World debrief, consolidated root `AI_USAGE.md`, 3-min video | team |

## 📋 Person A — action items

- Your contracts are **vendored** into `backend/sandbox-template/src/` so the
  checker can compile submissions. **Tell B whenever you change any of them**
  (vault, MockUSDC, IERC20, Rules) so B re-syncs; otherwise the checker compiles
  against stale copies. (Re-synced from `main` at the merge.)
- ABIs received — B4 is built against `shared/abis/BountyPool.json`. **Remaining
  from you for payout to work:** deploy to Sepolia, fill `ADDRESSES` in
  `shared/config.ts`, and **call `setSettler(<backend wallet address>)`** so the
  backend can call `settleReport`. Tell B the backend address to authorize.

## 📋 Person C — action items

- `/submit` is **async**: get `reportId`, then poll `GET /report/:id` every ~2s.
  Read the picked `.sol` file to a string for `exploitSource`.
- Company inbox = `GET /reports`; public track record = `GET /records`.
- **World ID (decision: backend owns it):** keep your IDKit **widget**, but
  **remove your own `/api/verify` Next route** — POST the proof
  `{ proof, merkle_root, nullifier_hash, verification_level }` to backend
  `/verify-human` instead. The backend runs the real cloud verify and owns the
  "one submission per human" block. It's a real check now; it just needs
  `WORLD_APP_ID` in the backend `.env` to go live (honest stub until then).
- Build the whole UI now against `MOCK_PIPELINE=true` (realistic data, no keys).

---

## Changelog

- **B7** — backend-owned World ID: `/verify-human` real cloud verify (direct v2 API, no SDK).
- **B6** — Arkiv public-record writer (`@arkiv-network/sdk`), expiry = deadline, mirror fallback, `arkiv-smoke`.
- **B4** — payout via `BountyPool.settleReport` + `GET /pool`; graceful skip when chain not wired.
- **merge** — pulled `main` (A's contracts + `shared/abis/`) into `b-backend`.
- **`5c25c8b`** — B5: live AI evidence report (`claude-haiku-5-5`) + canned fallback.
- **`ad443a9`** — B1/B2: real checker (Foundry sandbox runner + rules + severity).
- **`f508e8f`** — toolchain: Foundry 1.9.0, portable Node 22.
- **`d0adbc8`** — B0: scaffold, mock pipeline, safety guard, HTTP contract.
