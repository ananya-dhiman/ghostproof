# Ghostproof frontend (Person C)

> **Status checklist:** see [STATUS.md](STATUS.md). It lists what's done, what the frontend
> expects from Person A / B, and what's next, and it's updated on every push.

Next.js 15 + React 19, wagmi/viem for Sepolia, World IDKit for proof-of-human. Neo-brutalist
black/yellow theme with hand-drawn SVG ghost stickers (`src/components/Ghost.tsx`).

## Run it (with the real backend)

```bash
# terminal 1: the checker backend (Person B). Mock mode by default, no keys needed.
cd backend && npm install && npm run start      # http://localhost:8787

# terminal 2: this app
cd frontend && npm install && npm run dev        # http://localhost:3000
```

Always build with `npm run build` (Turbopack). Plain `next build` (webpack) fails on a wallet
library dependency.

## How it connects

| Screen | Talks to |
| --- | --- |
| `/hacker` | backend `GET /health`, `POST /verify-human`, `POST /submit`, then polls `GET /report/:id` every 2 s |
| `/company` | backend `GET /reports` (inbox); **Sepolia directly** for pool balance, `getConfig()`, `paidThisMonth()` and each report's `reports(keccak256(id))`; `addBonus` from the company wallet |
| `/record` | backend `GET /records` (the public record written to Arkiv) |

- Addresses come from `shared/config.ts`; types from `shared/types.ts`. Nothing is hard-coded.
- World ID: the widget runs here, but the **backend** verifies the proof and blocks a second
  submission from the same person. If the backend has no `WORLD_APP_ID`, the hacker screen says so
  and uses a clearly labelled simulated check.
- If the backend is unreachable, screens fall back to demo data and show **"Demo data · backend
  offline"**. Pool numbers still come live from the chain.

Test USDC on Sepolia has no real value. Built with help from Claude Code (scaffolding, UI, wiring).
