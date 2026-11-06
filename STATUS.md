# Project status — living checklist

**Update this file with every push.** It is the one place to see what is finished, what is
blocked, and what each person can start right now.

> **This file lives on the `a-contracts` branch only — it is deliberately not on `main`.**
> Do not merge `a-contracts` into `main` without Person A's explicit go-ahead.

- **Last updated:** 2026-11-06 ~20:20 IST, by Person A
- **Submissions close:** Sat 2026-11-07, 09:00 IST (partner judging 09:30–12:30)

---

## Done and on `main`

- [x] Repo scaffold, folder ownership, branch-per-person rules (`CLAUDE.md`)
- [x] `PLAN.md` — work split, interfaces, demo script
- [x] `shared/types.ts` — the JSON shapes between backend and frontend (**frozen**)
- [x] `shared/config.ts` — chain + contract addresses (**addresses are still placeholders**)
- [x] Contracts: `VulnerableVault`, `BountyPool`, `Rules`, `MockUSDC`
- [x] Deploy script `contracts/script/Deploy.s.sol`
- [x] **Tests: 5/5 passing** (`forge test` — see "Verified" below)
- [x] `shared/abis/*.json` — compiled ABIs committed, so **B and C do not need Foundry**

## Blocked / in progress

- [ ] **Sepolia deploy** → fills `ADDRESSES` in `shared/config.ts` — *Person A, waiting on faucet
      test ETH.* Until then B and C should code against the placeholder addresses and read them
      from `shared/config.ts` (never hardcode).
- [ ] Backend (`backend/`) — *Person B, not started*
- [ ] Frontend (`frontend/`) — *Person C, not started*
- [ ] Judge docs: `/arkiv/*.md`, World integration debrief, `AI_USAGE.md`, 3-min video

---

## What Person B can start NOW

Nothing is blocking you. Branch: `git checkout main && git pull && git checkout -b b-backend`

1. **Fork runner** — `anvil --fork-url $SEPOLIA_RPC_URL`, run the submitted exploit from a fresh
   account, read USDC balances before/after. Working reference: `contracts/test/Exploit.t.sol`
   does exactly this shape (snapshot balance → run exploit → evaluate rule).
2. **Produce `CheckerResult`** (`shared/types.ts`) — `verified:false` means stop, the company
   never sees it.
3. **Evidence report** — one Claude call, `messages.parse()` + a Zod schema. Model
   `claude-haiku-5-5`; see `PLAN.md` → "The AI call" for working code.
4. **Payout** — use `shared/abis/BountyPool.json`. Call sequence:
   - `settleReport(bytes32 id, address hacker, uint8 severity, bytes sig)` — **you must be the
     `settler`**; pays the capped base, locks the pool. Returns the amount paid. Pass `"0x"` for
     `sig` (reserved for a future signature check).
   - `closeReport(bytes32 id)` — when resolved, unlocks the pool.
   - Read config with `getConfig()` → `(autoPayLimit, monthlyCap, medium, high, critical)`.
5. **Severity is a uint8:** `1 = Medium, 2 = High, 3 = Critical`. Automatic base =
   `min(tierAmount[severity], autoPayLimit)`.
6. **Arkiv** — write `ArkivReportRecord` (`shared/types.ts`). Set an `expiresIn` so an unanswered
   report expires; that is our response deadline.

**You need Foundry** (for `anvil`). `foundryup` hung on the venue wifi — if it does for you too,
download the release binary directly instead:
```bash
gh release download stable --repo foundry-rs/foundry --pattern 'foundry_stable_win32_amd64.zip' --dir ~/fdl
cd ~/fdl && unzip -o foundry_stable_win32_amd64.zip && mkdir -p ~/.foundry/bin && cp *.exe ~/.foundry/bin/
export PATH="$HOME/.foundry/bin:$PATH" && forge --version
```
Get your **own** free Alchemy/Infura Sepolia key — your fork runner will rate-limit a public RPC.

## What Person C can start NOW

Nothing is blocking you. Branch: `git checkout main && git pull && git checkout -b c-frontend`

- ABIs are in `shared/abis/` — import them directly, **no Foundry needed**.
- Addresses + chain come from `shared/config.ts` (placeholders until A deploys; they will fill in
  without any code change on your side).
- Three screens per `PLAN.md` → "Person C": company, hacker, public record.
- Company screen calls `addBonus(bytes32 id, uint256 amount)` (owner only) and reads
  `getConfig()` / `reports(id)`.
- World ID: widget on the client, `verifyCloudProof` on a **backend** route — never trust the
  browser. Block a second submission from the same `nullifier`.
- Build against mock data from `shared/types.ts` first; swap to B's endpoints when they land.

---

## Verified (so nobody re-checks)

Run from `contracts/`: `forge build && forge test -vv`

```
test_drainBreaksNoTheft         PASS  exploit drains 1000 USDC, no-theft rule fires Critical
test_autoPaysBaseCappedAtLimit  PASS  Critical tier 500 capped to the 50 auto-limit
test_companyAddsBonusOnTop      PASS  company tops the hacker up to 500 total
test_poolLockedWhileReportOpen  PASS  withdraw reverts while open, succeeds after close
test_onlySettlerCanSettle       PASS  only the checker backend can settle
5 passed; 0 failed
```
Also compiles clean under solc 0.8.28 — 0 errors, 0 warnings. Remaining `forge build` output is
style lint only (immutable naming, modifier wrapping) — cosmetic, not bugs.

## Demo numbers (keep these consistent everywhere)

| Thing | Value |
|---|---|
| Chain | Ethereum Sepolia (chain ID 11155111) |
| Token | MockUSDC, 6 decimals, we mint it — **no USDC faucet needed** |
| Pool funded | 2000 USDC |
| Auto-pay limit | 50 USDC per report |
| Tiers | Medium 50, High 200, Critical 500 |
| Vault seeded | 1000 USDC victim deposit |
| Critical demo | drain 1000 → 50 paid automatically → company adds 450 bonus |

## Known shortcuts (state these in the README/demo, don't hide them)

- The checker runs on one server, standing in for a sealed computer (TEE).
- `settleReport` trusts the authorised `settler` address; the `sig` argument is reserved for a
  real signature check in production.
- `contracts/lib/` and `contracts/out/` are gitignored — run `forge install foundry-rs/forge-std`
  on a fresh clone if you need to build the contracts.
