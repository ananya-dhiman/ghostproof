# Ghostproof frontend (Person C)

> **Progress checklist:** see [PROGRESS.md](PROGRESS.md). It lists what's done, what the frontend
> expects from Person A / B, and what's next, and it's updated on every push.

Next.js 15 + React 19, wagmi/viem for Sepolia, World IDKit for proof-of-human. Neo-brutalist
yellow/black theme with hand-drawn SVG ghost stickers (`src/components/Ghost.tsx`).

```bash
cd frontend
npm install
cp .env.example .env.local   # every value is optional
npm run dev                  # http://localhost:3000
```

With **no env set** the whole app runs on demo data, and every screen shows a "Demo data" flag so we
never pass mock numbers off as real.

## Screens
| Route | What it shows |
| --- | --- |
| `/` | Pitch + how it works |
| `/hacker` | Connect wallet → World ID → paste/upload exploit → live status (checking → rule broken → base paid → report) |
| `/company` | Pool balance, auto-pay limit, monthly cap, rules, incoming reports (scorecard + AI evidence report), **Add bonus** |
| `/record` | Public track record from Arkiv (via backend `GET /records`) |

## Server routes (in this app)
- `POST /api/verify`: verifies the World ID proof server-side (`verifyCloudProof`). If
  `NEXT_PUBLIC_WLD_APP_ID` is unset it hands out a clearly labelled simulated nullifier.
- `POST /api/submit`: refuses unverified humans and a **second submission from the same nullifier**,
  then forwards to the backend's `POST /submit`. Without a backend it simulates the checker.
  State is in memory (resets on restart).

## Open questions for the team (search for `TODO(B)`)
- **B:** `/submit` is sent as multipart: file `exploit` (`Exploit.t.sol`) + field `metadata` (JSON
  `Submission`). Response may be a `CheckerResult` or `{ result }`.
- **B:** `GET /report/:id` may return `{ result, report, record }` or a flat `CheckerResult`.
  `GET /records` may return an array or `{ records }`.
- **B:** on-chain report id is assumed to be `keccak256(reportId)` (see `src/lib/chain.ts`).
- **A:** once `shared/config.ts` has real addresses, the company screen reads the live pool balance
  and `getConfig()` and "Add bonus" sends a real `addBonus(bytes32,uint256)` transaction.

Test USDC on Sepolia has no real value. Built with help from Claude Code (scaffolding, UI, wiring).
