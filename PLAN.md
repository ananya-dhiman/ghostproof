# Ghostproof — build plan (3 people, demo-first)

**Deadline:** Sat 2026-11-07, 9:00 AM IST. It is Fri ~6 PM now, so ~15 hours minus sleep. **A working demo beats a perfect system.** When in doubt, cut depth, keep the demo path working.

## What we are building (one paragraph)
A bug-bounty tool that **helps a company assess a submitted bug** and pays the hacker a **guaranteed small base** automatically, while any larger reward stays the company's choice. A hacker submits an attack as a runnable test. Our checker runs it on a **copy of the chain** (a fork) and measures the money moved — no AI decides this. If the attack breaks a rule the company **wrote in advance**, the contract pays the base from a locked pool, up to a limit the company set. An AI then writes a **plain-language evidence report** to help the company decide any bonus. Everything public goes on a shared record (Arkiv). Humans and accounts are checked as real with World ID.

## The one firm rule that makes it fair
The thing that triggers automatic pay is a **rule the company wrote before seeing the bug** (a test tagged with a severity), not the company's opinion afterwards and not the AI. Every company must keep one default rule: *a fresh account with no permissions must never end up holding other people's money.*

---

## Demo-first: what we deliberately cut
- **No real sealed computer (TEE).** Our checker runs on one server. We **say so on screen**: "In production this runs on a sealed computer; here it stands in for one."
- **One company, one vault, pre-loaded.** No company sign-up flow. Rules live in a config file, not a UI builder — the UI only *shows* them.
- **Backend holds the pool owner key** and calls the payout. No fancy signed-oracle handoff. (If time: sign the result with EIP-712. If not: owner-only call. Note it as a known shortcut.)
- **Duplicate check = compare a hash.** No clever bug-signature matching.
- **World ID via the Simulator**, one action (`verify-human`). No real phones needed.
- **No dispute flow, no reviewer.** Dropped earlier; do not build.
- **Pre-write a canned report** as a fallback in case the live AI call is slow/down during judging.

---

## Shared interfaces — agree these FIRST, do not change without telling the other two
These are the only places the three parts touch. Lock them at the start.

### 1. Submission = a Solidity test file + metadata
- File `Exploit.t.sol` with a contract exposing `function runExploit() external` (the attack), run from a fresh attacker account.
- Metadata JSON sent with it:
```json
{ "bountyId": "vault-01", "hackerAddress": "0x...", "worldIdNullifier": "0x..." }
```

### 2. Checker result (backend → contract + frontend)
```json
{
  "verified": true,
  "ruleBroken": "no-theft",
  "severity": "critical",          // "critical" | "high" | "medium" | null
  "valueMovedUsdc": 1000.0,
  "forkBlock": 1234567,
  "exploitHash": "0x...",
  "reportId": "rep_001"
}
```
`verified:false` ⇒ stop, company never sees it.

### 3. Evidence report (AI → frontend, stored on Arkiv)
```json
{
  "summary": "string, 1-2 sentences",
  "steps": ["string", "..."],
  "rootCause": "string",
  "suggestedSeverity": "critical|high|medium",
  "suggestedFixSummary": "string"
}
```

### 4. Contract ABI (Person A owns, B + C consume)
```
fundPool(uint256 amount)                         // company deposits USDC
autoPayout(address hacker, uint8 severity, bytes sig)  // pays base up to limit
addBonus(bytes32 reportId, address hacker, uint256 amount)
getConfig() view returns (limitUsdc, monthlyCapUsdc, tiers[])
```

### 5. Arkiv entity shape (B writes, C reads)
```json
{ "bountyId":"vault-01","reportId":"rep_001","exploitHash":"0x...",
  "severity":"critical","valueMovedUsdc":1000,"status":"base-paid|bonus-added|rejected",
  "paidUsdc":50,"bonusUsdc":0,"createdAt":1699999999 }
```
Store an **expiry** (`expiresIn` in seconds) so an open report auto-expires if the company goes silent — that is our "deadline" and a natural fit for Arkiv.

### Fixed config (everyone uses the same values)
- **Chain:** Ethereum Sepolia. **Token:** Circle test USDC (put the address in `config.ts`, shared).
- **Arkiv testnet "rabdi":** chain ID 7794095, RPC `https://rpc.rabdi.db-chain.testnet.arkiv.network`, SDK `@arkiv-network/sdk` (v0.6.x, needs Node 22+).
- **Demo numbers:** pool 2000 USDC, auto-pay limit 50 USDC, Medium=50, High=50 (capped), Critical tier suggests 500 bonus.

---

## Avoiding merge conflicts
The layer split already helps: the three parts talk over **HTTP + the contract ABI**, so they barely share in-process code. The conflicts come from a few files everyone reaches for. Fix with **one owner per folder** and **one owner per shared file**.

**Repo layout — each person lives in their own folder:**
```
/contracts   → Person A only
/backend     → Person B only
/frontend    → Person C only
/shared      → types, config, ABIs (rules below)
```

**The real hotspots and the rule for each:**
- **`package.json`:** give each folder its **own** `package.json` (three sub-projects, not one root). A single shared one that all three add dependencies to is the #1 conflict source — avoid it.
- **`/shared/config.ts`** (addresses, token, RPCs): **Person A owns it.** B and C only *read* it. A fills in the real Sepolia addresses once deployed; nobody else edits.
- **`/shared/abis/`:** **Person A writes**, B and C import. Only A changes these.
- **`/shared/types.ts`** (the JSON shapes in "Shared interfaces"): write once in hour 1, then **frozen**. Any change is announced to the other two before committing.

**Branches — one per person, firm rule (this is the main collaboration rule):**
- **Person A → `a-contracts`, Person B → `b-backend`, Person C → `c-frontend`.** Each person commits only to their own branch.
- **Nobody commits straight to `main`.** `main` only ever changes through a merged Pull Request.
- Start of the hackathon, each person runs: `git checkout main && git pull && git checkout -b <your-branch>`.
- **Pull `main` into your branch every couple of hours** (`git checkout main && git pull`, then `git checkout <your-branch> && git merge main`). Small, frequent merges never conflict; one big merge at hour 14 will.
- When a part works, open a **PR into `main`**; one person reviews and merges, resolving any conflict in the PR.
- If two people must touch the same file, one does it and tells the other — don't both edit in parallel.

This way the only cross-person edits are in `/shared`, and each `/shared` file has a single owner — so there is nothing left to conflict on.

## Ground rules — EVERY teammate pastes this into their repo as `CLAUDE.md`
```
# Ghostproof — rules for Claude Code

- Classic track: write NO code copied from before the hackathon start. Public
  libraries and starter kits only (OpenZeppelin, Foundry, Next.js, wagmi, viem,
  World IDKit, Arkiv SDK, Anthropic SDK are all fine).
- Commit small and often with clear messages. One giant final commit can get us
  disqualified. Keep an AI_USAGE.md noting that Claude Code helped and how.
- Do NOT change any shared interface (JSON shapes, ABI, config values) without
  telling the other two. These are in PLAN.md.
- Work only inside YOUR folder (/contracts, /backend, or /frontend). Files in
  /shared have a single owner each — don't edit one you don't own.
- BRANCHES (firm rule for all three):
  - Person A works ONLY on branch `a-contracts`.
  - Person B works ONLY on branch `b-backend`.
  - Person C works ONLY on branch `c-frontend`.
  - NEVER commit directly to `main`. First thing, run:
      git checkout main && git pull && git checkout -b <your-branch>
  - Commit to your own branch often. To get others' work, run
    `git checkout main && git pull` then `git checkout <your-branch> && git merge main`
    every couple of hours — do NOT let your branch drift for hours.
  - When a part is ready, open a Pull Request into `main`; one person reviews and
    merges. Resolve any conflict in the PR, never by force-pushing main.
- Network is Ethereum Sepolia, token is Circle test USDC. Never mainnet.
- Verify World ID proofs on the BACKEND only (verifyCloudProof), never trust the
  browser.
- Sandbox safety when running submitted test code: no internet except the fork
  RPC, no private keys in the environment, and Foundry FFI OFF (ffi = false in
  foundry.toml, and set fs_permissions to none). Treat every submission as hostile.
- Demo-first. If something is taking too long, build the simplest version that
  makes the demo work and leave a // TODO. Flag it to the team.
- Plain names in UI and docs — no bare jargon. We are explaining to beginners.
- Test tokens have no real value. Say so in the README.
```

---

## Division of work

### Person A — Contracts + chain (Solidity / Foundry)
**Goal:** the money logic and the thing being attacked, live on Sepolia.
Build:
1. `VulnerableVault.sol` — a deliberately buggy vault (a classic re-entrancy withdraw is the clearest for a demo). This is the target.
2. `BountyPool.sol` — holds USDC, stores the company's limit + tiers, exposes `fundPool`, `autoPayout`, `addBonus`, `getConfig`. Pool can't be withdrawn while a report is open.
3. The company's **rules as tests**: `rules/NoTheft.t.sol` (the mandatory one) and one more (e.g. a fee-accounting rule), each tagged with a severity in a comment/registry the backend reads.
4. Deploy all to Sepolia, verify on the explorer, hand B the addresses + ABIs.
**You own:** interface #4 and the vault. **You consume:** nothing.
**Cut if short:** make `autoPayout` owner-only (backend calls it) instead of signature-checked.
**Done =** on Sepolia, calling `autoPayout(hacker, critical)` moves 50 USDC to the hacker, and the pool rejects withdrawal while a report is open.

### Person B — Checker + backend (Node / TypeScript)
**Goal:** run the attack safely, measure it, write the report, push to chain + Arkiv.
Build:
1. **Fork runner:** given a submission, start a fork at the current block (`anvil --fork-url <sepolia>`), deploy/point to the vault, run the submitted `runExploit()` from a fresh account, and read USDC balances before/after. Use `forge test --json` and parse the result → produce interface #2.
2. **Rule check:** run the company's rule tests from Person A against the post-exploit state; the first one that fails gives `ruleBroken` + `severity`.
3. **Evidence report:** one Claude API call turning interface #2 + the exploit source into interface #3 (see "AI call" below). Keep a canned fallback report.
4. **Payout:** if a rule broke and severity ≤ limit, call `autoPayout`. Then write the Arkiv record (#5).
5. Expose simple HTTP endpoints for C: `POST /submit`, `GET /report/:id`, `GET /records`.
**You own:** interfaces #2, #3, #5. **You consume:** A's ABI/addresses.
**Cut if short:** skip EIP-712 signing (owner-only payout); hardcode the one vault; parse only pass/fail + the logged "value moved" number.
**Done =** `POST /submit` with the demo exploit returns a verified Critical result, 50 USDC lands on-chain, a readable report comes back, and a record appears on Arkiv.

### Person C — Frontend (Next.js / React)
**Goal:** three clear screens that tell the story to a judge in 3 minutes.
Build:
1. **Company screen:** shows the pool balance, the limit, the rules (read from config), and incoming reports with their scorecard + evidence report; an "Add bonus" button calling `addBonus`.
2. **Hacker screen:** connect wallet, verify once with World ID (IDKitWidget), submit the exploit, watch status go Checking → Base paid.
3. **Public record page:** reads Arkiv (#5) and lists each report's outcome (base paid / bonus added / rejected) — the "track record".
4. Wire World ID: widget on the client, `verifyCloudProof` on a backend route; block a second submission from the same `nullifier`.
**You own:** the screens + World ID wiring. **You consume:** B's HTTP endpoints, A's addresses for reads.
**Cut if short:** three tabs on one page, minimal styling, no wallet-network auto-switch (tell the judge to be on Sepolia).
**Done =** a judge can, on screen: verify as human, submit, see the base auto-pay, read the evidence report, and see it on the public record.

---

## Milestones (keep each other unblocked)
1. **+1h:** interfaces locked (this file), repos created, `CLAUDE.md` in each, A publishes vault + pool **stub ABIs** so B and C can start against fakes.
2. **+5h:** A deployed to Sepolia; B's fork runner measures value moved; C has the three screens with mock data.
3. **+9h:** end-to-end on testnet without the AI/World (hardcoded report, no World gate).
4. **+12h:** AI report + World ID in; Arkiv records writing.
5. **+14h:** freeze. Record the 3-min video, write the README + judge docs. **No new features after freeze.**

## Judge docs (do not forget — they are graded)
- `README.md` with a **CROPS section** (why security is the point; privacy/censorship-resistance trade-offs stated), OSS license, no third-party trackers in the client.
- `/arkiv/friction.md`, `reach.md`, `why-arkiv.md`, `how-you-use-arkiv.md`.
- World **integration debrief** (time to first success, friction, one improvement).
- `AI_USAGE.md`.
- Video **3 minutes or less** (EF requires it).

---

## The AI call (answers your model + JSON questions)
**Model:** this call turns measured numbers + code into a short, structured report — it is grounded, not open-ended.
- **For the demo, use `claude-haiku-5-5`** (fastest + cheapest; the report is semi-templated and the facts come from the fork, so quality risk is low). It keeps the live demo snappy.
- **If the write-up reads thin, switch to `claude-opus-5-5`** at `effort: "low"`. One line change. Decide by looking at output, not guessing.

**Guaranteed JSON:** use `client.messages.parse()` with a Zod schema (`zodOutputFormat`) — the SDK validates the response against the schema, so you never hand-parse model text.
```ts
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const Report = z.object({
  summary: z.string(),
  steps: z.array(z.string()),
  rootCause: z.string(),
  suggestedSeverity: z.enum(["critical", "high", "medium"]),
  suggestedFixSummary: z.string(),
});

const client = new Anthropic(); // reads ANTHROPIC_API_KEY
const res = await client.messages.parse({
  model: "claude-haiku-5-5",
  max_tokens: 2000,
  messages: [{
    role: "user",
    content: `Write an evidence report for a company. Checker result:\n${JSON.stringify(result)}\n\nExploit source:\n${exploitSrc}`,
  }],
  output_config: { format: zodOutputFormat(Report) },
});
const report = res.parsed_output; // typed; null if parsing failed — guard it
```
The AI only *describes*; it never decides severity-for-pay or moves money. The number that triggers pay comes from the fork + the company's rule.
