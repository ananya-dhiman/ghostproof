# Ghostproof — Backend (Person B) progress

**Living status of the `b-backend` branch.** Person A's and Person C's Claude:
read this first when you pull or reference this branch — it tells you what the
backend already provides, what it still needs from you, and the exact shapes you
integrate against. It is updated on every push to `b-backend`.

- **Last updated:** merged A's Sepolia deploy; **B4 payout VERIFIED LIVE on Sepolia** (50 USDC paid on-chain). See changelog.
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
- **B5 AI report — OpenRouter (free models)** via the OpenAI-compatible API
  (direct fetch, no SDK), JSON structured output validated against a Zod schema;
  the measured result is the ground truth, the model only describes it. Generated
  in the background (never delays payout) and aborts cleanly on timeout. Always
  falls back to a canned report on no-key/parse-fail/error/timeout, flagged
  `fallback:true`. Set `OPENROUTER_API_KEY` (free: openrouter.ai/keys) and
  optionally `OPENROUTER_MODEL` (default `deepseek/deepseek-chat-v3-0324:free`).
  `npm run ai-smoke` tests it standalone. Health field `anthropic`→`ai`.
  (Provider history: Claude → Gemini → OpenRouter; one-file swap.)
- **B6 Arkiv — VERIFIED LIVE.** `npm run arkiv-smoke` wrote a real record to
  rabdi (entityKey `0x2276c5c5…`, tx `0xad76…`). Access key optional; funded
  `ARKIV_PRIVATE_KEY` is enough.
- **B4 payout — VERIFIED LIVE on Sepolia.** On a broken rule,
  `settleReport(keccak256(id), hacker, severityUint8, "0x")` on A's `BountyPool`
  via viem, records the paid amount + tx. Confirmed end-to-end: demo exploit →
  checker → 50 USDC paid pool→hacker on-chain (tx
  `0x2c490ab3…a4312`, block 12077643; hacker 0→50, pool 2000→1950,
  openReports=1). `GET /pool` reads the real deploy (2000 / limit 50 / tiers
  50·200·500). Settler = the deployer wallet, which is `BACKEND_PRIVATE_KEY`
  (no `setSettler` needed). Degrades cleanly when the chain isn't wired.
- **B6 Arkiv (code-complete)** — writes the public record to rabdi via
  `@arkiv-network/sdk` with an expiry (= response deadline), after a real payout;
  local mirror is the fallback for `/records`. **Needs `ARKIV_ACCESS_KEY` +
  funded key to verify; `npm run arkiv-smoke` tests it standalone.**
- **B3 real Sepolia fork — VERIFIED LIVE.** When A's contracts are deployed and
  an RPC is set, the checker forks Sepolia at the current block and runs the
  exploit against the **real deployed vault** (so `forkBlock` is a real block and
  the measurement is on live state), falling back to the self-contained local run
  otherwise. Confirmed: demo exploit → `forkBlock 12077778`, `valueMovedUsdc 1000`
  measured against the deployed vault.
- **reportId unique across restarts** — `rep_<run-seed>_<n>`, so the on-chain id
  `keccak256(reportId)` never collides after a server restart.
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
| **B6 wiring** | actually write to Arkiv | rabdi faucet funds + `ARKIV_ACCESS_KEY` + `ARKIV_PRIVATE_KEY` in `.env` (operator's `.env` still has the old `ARKIV_RPC_URL`, not `ARKIV_ACCESS_KEY`) |
| **B5 live AI** | real report instead of fallback | add `OPENROUTER_API_KEY` to `.env` (free: openrouter.ai/keys). Optionally pick another free model via `OPENROUTER_MODEL` |
| **B7 happy path** | a real `verified:true` | needs a real Simulator proof via C's widget; the gate itself is verified live (blocks unverified submits). **C:** drop your Next verify route, POST the proof to `/verify-human` |
| **B8** remaining docs | consolidate all four `/arkiv/*.md` onto the submission branch, World debrief, root `AI_USAGE.md`, 3-min video | team |

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

- **openrouter** — swapped the report provider to OpenRouter (free models, OpenAI-compatible); removed @google/genai.
- **e2e** — full live money path verified on Sepolia (checker fork block 12078095 → 1000 USDC theft → 50 USDC paid on-chain → public record); B6 Arkiv verified live; payout now checks receipt status; Gemini model → gemini-3.8-flash; added `ai-smoke`.
- **gemini** — swapped the evidence-report provider from Anthropic to Gemini (free tier); Arkiv access key now optional; health `anthropic`→`ai`.
- **B3** — checker forks live Sepolia against the deployed vault (verified: real forkBlock, 1000 USDC measured); reportId now unique across restarts.
- **live** — merged A's Sepolia deploy; verified B4 payout on-chain (50 USDC paid); fixed stale `run()` doc in types.ts.
- **B7** — backend-owned World ID: `/verify-human` real cloud verify (direct v2 API, no SDK).
- **B6** — Arkiv public-record writer (`@arkiv-network/sdk`), expiry = deadline, mirror fallback, `arkiv-smoke`.
- **B4** — payout via `BountyPool.settleReport` + `GET /pool`; graceful skip when chain not wired.
- **merge** — pulled `main` (A's contracts + `shared/abis/`) into `b-backend`.
- **`5c25c8b`** — B5: live AI evidence report (`claude-haiku-5-5`) + canned fallback.
- **`ad443a9`** — B1/B2: real checker (Foundry sandbox runner + rules + severity).
- **`f508e8f`** — toolchain: Foundry 1.9.0, portable Node 22.
- **`d0adbc8`** — B0: scaffold, mock pipeline, safety guard, HTTP contract.
