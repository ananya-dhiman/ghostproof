# Ghostproof — Contracts (Person A) progress

**Living status of the `a-contracts` branch.** Person B's and Person C's Claude: read this when
you pull or reference this branch — it tells you what the contracts provide, what is deployed, and
what is still needed from you. Updated on every push to `a-contracts`.

Read it with: `git show origin/a-contracts:STATUS.md`

> This file lives on `a-contracts` only — deliberately not on `main`.
> Do not merge `a-contracts` into `main` without Person A's explicit go-ahead.

- **Last updated:** 2026-11-06 ~21:40 IST — Arkiv friction.md + reach.md written
- **Owner:** Person A (contracts), Solidity/Foundry, folder `/contracts`
- **Submissions close:** Sat 2026-11-07, 09:00 IST (partner judging 09:30–12:30)

---

## Deployed addresses — Ethereum Sepolia (LIVE)

| What | Address |
|---|---|
| MockUSDC (6 decimals) | `0xbbE04C8bE88dE0aa2229356986E6fB44f59ABeB9` |
| VulnerableVault | `0x8ec3c18f93490eAdb94d08a2C46d864a37B5A979` |
| BountyPool | `0x5Dc887D6Ee53a809fcEB66Fd5799F3C18f8A3488` |
| Owner (company) **and settler** | `0xBCB67d6902e584f703473fC3297d2a9970BA3B20` |

Verified by reading the chain: vault holds **1000 USDC**, pool holds **2000 USDC**, auto-pay limit
**50**, tiers **50 / 200 / 500**.

**These are on `main` now** (only `shared/config.ts` was copied over) — `git pull` and read them
from `shared/config.ts`. Never hardcode.

**Working RPC:** `https://ethereum-sepolia-rpc.publicnode.com`
`rpc.sepolia.org` and `1rpc.io/sepolia` are dead; `sepolia.drpc.org` is paid-only. publicnode is
load-balanced and occasionally returns a transient "block not found" — just retry.

---

## ✅ Answers to Person B's action items

1. **`setSettler` is NOT needed — decision made.** Person B's backend uses the **same throwaway
   wallet** that owns the pool (`0xBCB6…3B20`), which is already the settler. Person A sends B the
   `PRIVATE_KEY` + `SEPOLIA_RPC_URL` directly (out of band, never in the repo). Safe only because
   it is a disposable testnet wallet holding worthless test coins.
   *If there is spare time later we can switch to `pool.setSettler(<B's own wallet>)`, which reads
   better to a judge — one transaction, ~10 seconds. Tell A the address and it's done.*
2. **Deploy + addresses: done** (table above), and `shared/config.ts` on `main` has them.
3. **Vendored contracts: verified IN SYNC** as of this push. I diffed `main:contracts/src/*`
   against `b-backend:backend/sandbox-template/src/*` — `VulnerableVault.sol`, `IERC20.sol`,
   `MockUSDC.sol`, `Rules.sol` all match byte-for-byte. **No contract has changed since the PR #1
   merge, and A will tell B before changing one.**

## ⚠️ One inconsistency found in `b-backend` — Person B please fix

`shared/types.ts` on `b-backend` documents `exploitSource` as:
> *"Full text of Exploit.t.sol. Must expose `function runExploit() external`."*

but `backend/STATUS.md` says the entry point is **`run(VulnerableVault vault)`** and the guard
enforces `run(`. The code and A's `ExploitDrain` both use **`run(VulnerableVault)`** — so the doc
comment is stale. It matters because Person C will show submitters what to write. **The correct
signature is `function run(VulnerableVault vault) external`.**

---

## ✅ Done (Person A)

- [x] Repo scaffold, folder ownership, branch-per-person rules (`CLAUDE.md`)
- [x] `PLAN.md` — work split, interfaces, demo script
- [x] Contracts: `VulnerableVault`, `BountyPool`, `Rules`, `MockUSDC`, `IERC20`
- [x] **Tests: 5/5 passing** (forge 1.9.0 — see "Verified" below)
- [x] `shared/abis/*.json` — compiled ABIs committed, so **B and C need no Foundry**
- [x] **Deployed and seeded on Sepolia**; addresses in `shared/config.ts` on `main`
- [x] **Settler decided** — B reuses the deployer wallet; no on-chain change needed
- [x] Cross-checked `b-backend`: vendored contracts in sync, types diff reviewed
- [x] **Judge docs:** `/arkiv/friction.md` + `/arkiv/reach.md` written (B wrote the other two)

## 🔴 Submission risk — the four Arkiv docs are split across branches

Arkiv scores **25% each** on four files. Right now:

| Branch | Has |
|---|---|
| `main` | **none** |
| `a-contracts` | `friction.md`, `reach.md` |
| `b-backend` | `why-arkiv.md`, `how-you-use-arkiv.md` |

**All four must be on the submitted branch before 09:00.** Nothing is scored from a side branch.

Also: both of my docs state the Arkiv write path is *code-complete but not verified live*. If B
gets `ARKIV_ACCESS_KEY` + faucet funds and `npm run arkiv-smoke` passes, those two sentences
(one in each file) should be updated to say it is verified.

## ⬜ Open — Person A

| Item | Blocked on |
|---|---|
| Send B the `PRIVATE_KEY` + `SEPOLIA_RPC_URL` | **Person A** — out-of-band message, not the repo |
| Decide whether B's `shared/types.ts` goes to `main` so C can use it | **Person A** — see below |
| Optional: `setSettler(<B's own wallet>)` | B providing an address |

**Decision pending on `shared/types.ts`:** B extended it on `b-backend` (+112 lines) with the
HTTP-contract types, added `exploitSource: string` to `Submission`, made
`ArkivReportRecord.severity` nullable, and added `fallback?: boolean` to `EvidenceReport`. The
changes are additive and B's code depends on them, and **C needs them to build against B's API** —
but `main` still has A's original. Options: copy just that one file to `main` (the same trick used
for `config.ts`), or leave C to read it from `b-backend`.

---

## What Person C can start NOW

- ABIs in `shared/abis/` — import directly, **no Foundry needed**.
- Live addresses in `shared/config.ts` on `main` — `git pull`.
- Need demo USDC in a wallet? MockUSDC has an **open `mint(address,uint256)`** — anyone can call
  it, no permission. Mint yourself test USDC freely.
- On-chain report id is **`keccak256(reportId)`** (UTF-8 bytes) — use the same for `addBonus` and
  `reports(id)` as B uses for `settleReport`, or you will read the wrong slot.
- Company screen: `addBonus(bytes32 id, uint256 amount)` is **owner-only** — it must be sent from
  `0xBCB6…3B20`. Reads (`getConfig()`, `reports(id)`) are open to anyone.

## Contract surface (quick reference)

| Function | Who can call | Notes |
|---|---|---|
| `settleReport(bytes32 id, address hacker, uint8 severity, bytes sig)` | settler | pays `min(tier, limit)`, locks pool, returns amount. `sig` reserved — pass `"0x"` |
| `addBonus(bytes32 id, uint256 amount)` | owner | the company's optional extra |
| `closeReport(bytes32 id)` | settler | unlocks the pool |
| `getConfig()` | anyone | `(autoPayLimit, monthlyCap, medium, high, critical)` |
| `reports(bytes32 id)` | anyone | `(status, hacker, severity, basePaid, bonus, closed)` |
| `fundPool` / `withdrawPool` | owner | withdraw reverts while a report is open |
| `setSettler` / `setConfig` / `setTier` | owner | |
| `mint(address,uint256)` on MockUSDC | **anyone** | test token, mint freely |

Severity is a **uint8 on-chain**: `1 = Medium, 2 = High, 3 = Critical`.

---

## Verified (so nobody re-checks)

From `contracts/`: `forge build && forge test -vv` (forge 1.9.0)

```
test_drainBreaksNoTheft         PASS  exploit drains 1000 USDC, no-theft rule fires Critical
test_autoPaysBaseCappedAtLimit  PASS  Critical tier 500 capped to the 50 auto-limit
test_companyAddsBonusOnTop      PASS  company tops the hacker up to 500 total
test_poolLockedWhileReportOpen  PASS  withdraw reverts while open, succeeds after close
test_onlySettlerCanSettle       PASS  only the checker backend can settle
5 passed; 0 failed
```
Also clean under solc 0.8.28 — 0 errors, 0 warnings. Remaining `forge build` output is style lint
only (immutable naming, modifier wrapping) — cosmetic.

## Demo numbers (keep consistent everywhere)

| Thing | Value |
|---|---|
| Chain | Ethereum Sepolia (chain ID 11155111) |
| Token | MockUSDC, 6 decimals, open mint — **no USDC faucet needed** |
| Pool funded | 2000 USDC |
| Auto-pay limit | 50 USDC per report |
| Tiers | Medium 50, High 200, Critical 500 |
| Vault seeded | 1000 USDC victim deposit |
| Critical demo | drain 1000 → 50 paid automatically → company adds 450 bonus |

## Known shortcuts (state these in the README/demo, don't hide them)

- The checker runs on one server, standing in for a sealed computer (TEE).
- `settleReport` trusts the authorised `settler` address; `sig` is reserved for a real signature
  check in production.
- Company and settler are the same wallet in the demo (they would be separate in production).
- `contracts/lib/`, `out/`, `cache/`, `broadcast/` and `.env` are gitignored. `cache/` holds the
  deploy key — never force-add it.
