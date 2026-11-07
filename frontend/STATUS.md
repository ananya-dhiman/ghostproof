# Frontend status — Person C (`c-frontend`)

> **For teammates and their Claude:** this file is the source of truth for what the frontend has
> done and what it expects from you. It is updated on **every push** to `c-frontend`.
> Read it with: `git show origin/c-frontend:frontend/STATUS.md`

**Last updated:** 2026-11-07 · integrated with B's backend (on `main`) and A's Sepolia deploy
**PR into main:** not opened yet. `c-frontend` already contains all of `main` (merged), so it
should merge cleanly.

---

## Done ✅

### Integration (this push)
- [x] **Merged `main`** into `c-frontend`: B's backend, A's deployed addresses, `shared/abis/`, B's HTTP types in `shared/types.ts`
- [x] **Submit:** `POST /submit` as JSON `{ bountyId, hackerAddress, worldIdNullifier, exploitSource }` → `202 { reportId }`, then polls `GET /report/:id` every 2 s
- [x] **All 7 report statuses** handled. `verified` is treated as "checker done, payment pending" (the backend passes through it on the way to `base-paid`), not as final. A finding whose payout never arrives is shown as "rule broke, payment pending"
- [x] **Duplicate / rejected / error** show the backend's reason (tested: duplicate exploit → "already submitted as rep_…")
- [x] **Company inbox** = `GET /reports`, filtered to reports where a rule broke
- [x] **Public record** = `GET /records`, labelled by `source` ("mirror" = the checker's copy of what it wrote to Arkiv)
- [x] **World ID is backend-owned** (B's decision): the widget posts `{ proof, merkle_root, nullifier_hash, verification_level }` to `POST /verify-human`, **no signal** (matches `backend/src/worldid/verify.ts`). Uses `GET /health` → `subsystems.worldId` to decide real widget vs. labelled simulated check
- [x] **Removed** the frontend's own `/api/verify` and `/api/submit` routes (B asked for this)
- [x] **Live chain reads** (Sepolia via publicnode): pool balance, `getConfig()`, `paidThisMonth()`, and per report `reports(keccak256(reportId))` for base + bonus. Verified against B's two real payouts (status BasePaid, severity 3, base 50)
- [x] **Add bonus:** `addBonus(keccak256(reportId), amount)`, only enabled for the company wallet `DEPLOYER` (0xBCB6…3B20) and only if the report exists on-chain. Suggested bonus = tier − base (critical: 500 − 50 = **450**)
- [x] Demo exploit = `backend/fixtures/Exploit.sol` (`run(VulnerableVault vault)`, imports `target/VulnerableVault.sol`)
- [x] Rule ids match the backend: `no-theft` (critical), `fee-accounting` (medium)
- [x] **Offline fallback:** if the backend is down, screens show flagged demo data; pool numbers stay live from the chain

### Earlier
- [x] Next.js 15 app in `/frontend`; imports `@shared/*`
- [x] Neo-brutalist theme, black page / yellow ink, role-based colour tokens (`--ink`, `--base`)
- [x] Ghost stickers (7 variants + speech bubble), all original SVG
- [x] Screens: `/`, `/hacker`, `/company`, `/record`; all pass a WCAG 4.5:1 contrast scan; no sideways scroll on phones

### Verified this push
- [x] Full hacker flow in the browser against **B's real backend** (mock mode): connect → simulated World ID → demo exploit → checking → No theft / critical → 50 USDC paid → evidence report
- [x] Duplicate submission → shown as duplicate with B's reason
- [x] Company screen: live pool from Sepolia (1,900 USDC, 100 paid this month), inbox from `/reports`, evidence report, bonus box
- [x] Record page from `/records`
- [x] Backend stopped → demo fallback + "checker is offline" notice
- [x] Type-check, lint, `npm run build` all pass; no console errors

---

## Needs from Person A / B ⏳

| Who | What | Why |
| --- | --- | --- |
| **B** | Set `WORLD_APP_ID` in `backend/.env`; give C the same app id for `NEXT_PUBLIC_WLD_APP_ID` | The real World ID widget only shows when both are set |
| **B** | `/records` reads Arkiv itself (currently always the local mirror, `TODO(B6)`) | So the public page truly reads Arkiv |
| **B** | Optional: update the Arkiv record / report status after a company bonus | `bonus-added` never appears today; the frontend reads the bonus from the chain instead |
| **A/B** | Live run with `MOCK_PIPELINE=false` on one machine, then a real bonus from the company wallet | Not yet tested end to end with real money flow from the UI |

---

## Not done yet / next 🔜
- [ ] Open the PR `c-frontend` → `main`
- [ ] Test the real World ID widget with the Simulator (needs app id)
- [ ] Test a real `addBonus` from MetaMask with the company wallet
- [ ] World ID integration debrief (World prize requirement)
- [ ] Root `AI_USAGE.md` entry for the frontend

---

## How to run
```bash
cd backend && npm install && npm run start    # :8787 (mock mode, no keys)
cd frontend && npm install && npm run dev     # :3000
```

## Changelog (newest first)
- **2026-11-07**: integrated with B's backend + A's Sepolia deploy (see "Integration" above); removed frontend API routes; fixed `verified` status handling
- **2026-11-06**: renamed PROGRESS.md → STATUS.md
- **2026-11-06** · `7305f41`: added this checklist
- **2026-11-06** · `dd50a86`: dark theme (black page, yellow ink)
- **2026-11-06** · `09e6498`: first frontend: theme, ghost stickers, screens, demo fallback
