# Project status — living checklist

**Update this file with every push.** It is the one place to see what is finished, what is
blocked, and what each person can start right now.

> **This file lives on the `a-contracts` branch only — it is deliberately not on `main`.**
> Do not merge `a-contracts` into `main` without Person A's explicit go-ahead.

- **Last updated:** 2026-11-06 ~20:45 IST, by Person A
- **Submissions close:** Sat 2026-11-07, 09:00 IST (partner judging 09:30–12:30)

---

## Deployed addresses — Ethereum Sepolia (live)

| What | Address |
|---|---|
| MockUSDC (6 decimals) | `0xbbE04C8bE88dE0aa2229356986E6fB44f59ABeB9` |
| VulnerableVault | `0x8ec3c18f93490eAdb94d08a2C46d864a37B5A979` |
| BountyPool | `0x5Dc887D6Ee53a809fcEB66Fd5799F3C18f8A3488` |
| Owner (company) + settler | `0xBCB67d6902e584f703473fC3297d2a9970BA3B20` |

Verified on-chain: vault holds **1000 USDC**, pool holds **2000 USDC**, auto-pay limit **50**,
tiers **50 / 200 / 500**. Addresses are in `shared/config.ts` — **read them from there, never
hardcode.**

**Working RPC:** `https://ethereum-sepolia-rpc.publicnode.com`
(`rpc.sepolia.org` and `1rpc.io/sepolia` were dead; `sepolia.drpc.org` is now paid-only.)

---

## Done

- [x] Repo scaffold, folder ownership, branch-per-person rules (`CLAUDE.md`)
- [x] `PLAN.md` — work split, interfaces, demo script
- [x] `shared/types.ts` — the JSON shapes between backend and frontend (**frozen**)
- [x] Contracts: `VulnerableVault`, `BountyPool`, `Rules`, `MockUSDC`
- [x] **Tests: 5/5 passing** (forge 1.9.0 — see "Verified" below)
- [x] `shared/abis/*.json` — compiled ABIs committed, so **B and C do not need Foundry**
- [x] **Deployed and seeded on Sepolia**, addresses filled into `shared/config.ts`

## Blocked / in progress

- [ ] **Settler must be repointed to Person B's backend address** once B has one —
      Person A runs `pool.setSettler(<B's address>)`. Until then only the deployer wallet can
      call `settleReport`. (Simplest alternative for the demo: B uses the same throwaway key.)
- [ ] Backend (`backend/`) — *Person B, not started*
- [ ] Frontend (`frontend/`) — *Person C, not started*
- [ ] Judge docs: `/arkiv/*.md`, World integration debrief, `AI_USAGE.md`, 3-min video

---

## What Person B can start NOW

Nothing is blocking you. Branch: `git checkout main && git pull && git checkout -b b-backend`

1. **Fork runner** — `anvil --fork-url https://ethereum-sepolia-rpc.publicnode.com`, run the
   submitted exploit from a fresh account, read USDC balances before/after. Working reference:
   `contracts/test/Exploit.t.sol` does exactly this shape (snapshot balance → run exploit →
   evaluate rule).
2. **Produce `CheckerResult`** (`shared/types.ts`) — `verified:false` means stop, the company
   never sees it.
3. **Evidence report** — one Claude call, `messages.parse()` + a Zod schema. Model
   `claude-haiku-5-5`; see `PLAN.md` → "The AI call" for working code.
4. **Payout** — use `shared/abis/BountyPool.json`. Call sequence:
   - `settleReport(bytes32 id, address hacker, uint8 severity, bytes sig)` — **you must be the
     `settler`** (see the blocked item above); pays the capped base, locks the pool. Returns the
     amount paid. Pass `"0x"` for `sig` (reserved for a future signature check).
   - `closeReport(bytes32 id)` — when resolved, unlocks the pool.
   - Read config with `getConfig()` → `(autoPayLimit, monthlyCap, medium, high, critical)`.
5. **Severity is a uint8:** `1 = Medium, 2 = High, 3 = Critical`. Automatic base =
   `min(tierAmount[severity], autoPayLimit)`.
6. **Arkiv** — write `ArkivReportRecord` (`shared/types.ts`). Set an `expiresIn` so an unanswered
   report expires; that is our response deadline.

**You need Foundry** (for `anvil`). `foundryup` works but is very slow on the venue wifi — it took
~45 min. Faster: download the release binary directly:
```bash
gh release download stable --repo foundry-rs/foundry --pattern 'foundry_stable_win32_amd64.zip' --dir ~/fdl
cd ~/fdl && unzip -o foundry_stable_win32_amd64.zip && mkdir -p ~/.foundry/bin && cp *.exe ~/.foundry/bin/
export PATH="$HOME/.foundry/bin:$PATH" && forge --version
```
Get your **own** free Alchemy/Infura Sepolia key — your fork runner will rate-limit a public RPC.

## What Person C can start NOW

Nothing is blocking you. Branch: `git checkout main && git pull && git checkout -b c-frontend`

- ABIs are in `shared/abis/` — import them directly, **no Foundry needed**.
- Real deployed addresses are in `shared/config.ts` (note: that file is updated on
  `a-contracts`; ask Person A for the values until it reaches `main`).
- Three screens per `PLAN.md` → "Person C": company, hacker, public record.
- Company screen calls `addBonus(bytes32 id, uint256 amount)` (owner only) and reads
  `getConfig()` / `reports(id)`.
- World ID: widget on the client, `verifyCloudProof` on a **backend** route — never trust the
  browser. Block a second submission from the same `nullifier`.
- Need demo USDC in a wallet? MockUSDC has an open `mint(address,uint256)` — anyone can call it.

---

## Verified (so nobody re-checks)

Run from `contracts/`: `forge build && forge test -vv` (forge 1.9.0)

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
- `contracts/lib/`, `contracts/out/`, `contracts/cache/`, `contracts/broadcast/` and `.env` are
  gitignored. Note `cache/` holds the deploy key — never force-add it.
