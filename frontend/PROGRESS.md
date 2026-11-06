# Frontend progress — Person C (`c-frontend`)

> **For teammates and their Claude:** this file is the source of truth for what the frontend has
> done and what it expects from you. It is updated on **every push** to `c-frontend`.
> Read "Needs from Person A / B" before changing anything the frontend depends on.

**Last updated:** 2026-11-06 · **Latest pushed commit before this update:** `dd50a86` (dark theme)
**PR into main:** not opened yet

---

## Done ✅

### App + setup
- [x] Next.js 15 (App Router, TypeScript, Turbopack) in `/frontend`, own `package.json`
- [x] Imports `../shared/types.ts` and `../shared/config.ts` via the `@shared/*` alias (read-only, never edited)
- [x] `.env.example`. **Every env var is optional**: with none set, the app runs on demo data
- [x] Build with `npm run build` (Turbopack). ⚠ Plain `next build` (webpack) fails on a wallet-library dependency; always use the npm script

### Theme
- [x] Neo-brutalist: black page, yellow text/borders/hard shadows, Archivo Black + Space Grotesk + Space Mono
- [x] Colours named by role in `src/app/globals.css`: `--ink` (foreground, yellow) and `--base` (page, black). Swap them to flip the theme
- [x] Classes: `.card` / `.card.accent` (yellow block) / `.card.flat`; `.btn` / `.btn.accent` / `.btn.raised`; `.tag` + `.sev-critical|high|medium`
- [x] Ghost stickers, all original SVGs (`src/components/Ghost.tsx`): `classic`, `shades`, `shield`, `bag`, `detective`, `sleepy`, `spooked`, plus `<Boo>` speech bubble
- [x] Every screen passes a WCAG 4.5:1 contrast scan; no sideways scroll at phone width

### Screens
- [x] `/`: pitch, "how it works", sample report card
- [x] `/hacker`: connect wallet → World ID → paste/upload exploit (with "Load demo exploit") → live status tracker (replay → rule check → base paid → evidence report)
- [x] `/company`: pool balance, auto-pay limit, monthly cap, paid total, rules (from `src/lib/rules.ts`, mirrors `Rules.sol`), incoming reports with the checker's numbers next to the AI evidence report, **Add bonus** button
- [x] `/record`: public track record table + totals, reloads every 10 s
- [x] Every screen shows a "Demo data" flag when it's not using the real backend

### Server routes (inside the frontend app)
- [x] `POST /api/verify`: checks the World ID proof on the server with `verifyCloudProof`. If `NEXT_PUBLIC_WLD_APP_ID` is unset, it hands out a clearly labelled simulated ID
- [x] `POST /api/submit`: rejects people who haven't verified and blocks a **second submission from the same nullifier**, then forwards to backend `POST /submit` (or simulates the checker when there's no backend)

### Verified
- [x] Hacker flow tested end to end in the browser (stand-in wallet + simulated World ID + demo backend)
- [x] `/api/verify` and `/api/submit` tested over HTTP (unverified rejected, second submission rejected)
- [x] Type-check, lint and build all pass

---

## Needs from Person A / B ⏳

| Who | What the frontend assumes | Where |
| --- | --- | --- |
| **B** | `POST /submit` takes **multipart**: file `exploit` (`Exploit.t.sol`) + field `metadata` (JSON `Submission`). Returns `CheckerResult` or `{ result }` | `src/app/api/submit/route.ts` |
| **B** | `GET /report/:id` returns `{ result, report, record }` **or** a flat `CheckerResult` | `src/lib/api.ts` → `normalizeReport` |
| **B** | `GET /records` returns `ArkivReportRecord[]` **or** `{ records: [...] }` | `src/lib/api.ts` → `fetchRecords` |
| **B** | On-chain report id = `keccak256(reportId)` (used for `addBonus`) | `src/lib/chain.ts` → `reportIdToBytes32` |
| **B** | Backend allows CORS from the frontend origin (browser calls `/report/:id` and `/records` directly) | — |
| **A** | Real addresses in `shared/config.ts`. Until then, the pool shows demo numbers and "Add bonus" doesn't send a transaction | `src/lib/chain.ts` → `CONTRACTS_DEPLOYED` |
| **A** | ABI used: `getConfig() → (limit, cap, medium, high, critical)`, `addBonus(bytes32 id, uint256 amount)` (onlyOwner) | `src/lib/chain.ts` → `bountyPoolAbi` |

Note: the real contract uses `settleReport`, not `autoPayout` as in PLAN.md. The frontend never calls either one; only the backend does.

---

## Not done yet / next 🔜
- [ ] Open the PR `c-frontend` → `main`
- [ ] Wire to B's real backend once it's up (set `NEXT_PUBLIC_BACKEND_URL`) and remove any shape guesses that turn out wrong
- [ ] Real World ID app id from the Developer Portal + test with the Simulator
- [ ] Test a real `addBonus` transaction on Sepolia with MetaMask (needs A's addresses + owner wallet)
- [ ] Optional: read Arkiv directly from the browser instead of via backend `/records`
- [ ] "One submission per human" is stored in server memory and resets on restart. Move it to the backend if time allows
- [ ] `AI_USAGE.md` entry for the frontend (Claude Code built the scaffold, theme, screens and routes)

---

## How to run
```bash
cd frontend
npm install
cp .env.example .env.local   # optional
npm run dev                  # http://localhost:3000
```

## Changelog (newest first)
- **2026-11-06** · `dd50a86`: flipped to dark theme (black page, yellow ink), role-based colour tokens, fixed sticker overlaps
- **2026-11-06** · `09e6498`: first frontend: theme, ghost stickers, 3 screens + landing, World ID + submit routes, demo-data fallback
