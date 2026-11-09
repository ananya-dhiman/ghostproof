# Deploying Ghostproof

Three pieces, three places:

| Piece | Where | How |
|-------|-------|-----|
| Contracts (MockUSDC, VulnerableVault, BountyPool) | **Ethereum Sepolia** | already deployed — addresses are in `shared/config.ts`, nothing to do |
| Checker backend (`/backend`) | **Render**, as a Docker web service | the blueprint `render.yaml` at the repo root |
| Web app (`/frontend`) | **Vercel** | a normal Next.js project with its root directory set to `frontend` |

The backend has to be a **Docker** service, not a plain Node one: its whole job is
running `forge test` against a fork of Sepolia, so the image carries the Foundry
toolchain. That is why `backend/Dockerfile` exists.

Test networks only. The USDC in this demo is a mock token with no real value.

---

## Order matters

The two services need each other's URLs, so one pass is not enough:

1. Merge the deploy config into `main` (Render and Vercel both build `main`).
2. Deploy the **backend** → you learn its URL.
3. Deploy the **frontend** with that URL → you learn its URL.
4. Go back and put the frontend URL in the backend's `CORS_ORIGINS`, then redeploy.

Skipping step 4 means the browser silently gets blocked by CORS on every call.

---

## 1. Get the deploy config onto `main`

The config lives on `b-backend`. Per the team rule, `main` only changes through a
pull request:

```bash
git push origin b-backend
# then open the PR and merge it:
# https://github.com/ananya-dhiman/ghostproof/compare/main...b-backend
```

## 2. Backend → Render

1. Push/merge first: Render reads `render.yaml` from `main`.
2. In Render: **New → Blueprint**, pick the `ghostproof` repo, let it read
   `render.yaml`. It proposes one service, `ghostproof-backend`.
3. Render prompts for every value marked `sync: false`. Fill them from
   `backend/.env` on your laptop (never commit them):

   | Key | Value |
   |-----|-------|
   | `SEPOLIA_RPC_URL` | your Alchemy/Infura Sepolia endpoint |
   | `BACKEND_PRIVATE_KEY` | the settler/owner wallet key (funded with Sepolia ETH) |
   | `OPENROUTER_API_KEY` | from <https://openrouter.ai/keys> |
   | `ARKIV_PRIVATE_KEY` | funded rabdi testnet key |
   | `ARKIV_ACCESS_KEY` | from <https://hub.arkiv.network/access-keys> (optional, relieves rate limits) |
   | `WORLD_APP_ID` | `app_…` from the World Developer Portal |
   | `WORLD_RP_ID` | `rp_…` from the same portal |
   | `WORLD_RP_SIGNING_KEY` | the portal signing key — backend only, never in the browser |
   | `CORS_ORIGINS` | put `http://localhost:3000` for now; fix it in step 4 |

   Everything else (`MOCK_PIPELINE=false`, `USE_ANVIL=false`,
   `FORGE_TIMEOUT_MS`, `FORGE_BIN`, `WORLD_ACTION_ID`, `WORLD_ENVIRONMENT`,
   `OPENROUTER_MODEL`, `ARKIV_EXPIRES_IN`) is already set in `render.yaml`.
4. Deploy. The first build takes roughly 8–12 minutes: it installs Foundry and
   compiles the sandbox contracts once so the first real submission does not pay
   for a solc download.
5. Check it:

   ```bash
   curl https://<your-service>.onrender.com/health
   curl https://<your-service>.onrender.com/pool
   ```

   `/health` should report `mode: "live"` and `foundry: true`. Any subsystem
   showing `false` means its key did not make it into the dashboard.

## 3. Frontend → Vercel

1. **New Project** → the same repo.
2. **Root Directory: `frontend`**.
3. In that same Root Directory panel, switch ON **"Include source files outside
   of the Root Directory in the Build Step"**. The app imports `@shared/types`
   and `@shared/config` from `../shared`, so without this the build fails with
   module-not-found. (`frontend/next.config.ts` already sets the matching
   `externalDir` and `outputFileTracingRoot`.)
4. Framework preset: Next.js. Leave the build and install commands alone.
5. Environment variables:

   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_BACKEND_URL` | the Render URL from step 2, no trailing slash |
   | `NEXT_PUBLIC_WLD_APP_ID` | the same `app_…` the backend uses |
   | `NEXT_PUBLIC_WLD_ACTION` | `verify-human` |
   | `NEXT_PUBLIC_SEPOLIA_RPC_URL` | optional; defaults to a public node |

   These are `NEXT_PUBLIC_*`, so they are **baked in at build time** — changing
   one later needs a redeploy, not just a save.
6. Deploy, then open the site. The pool numbers come straight from Sepolia, so
   they work even if the backend is still waking up.

## 4. Close the loop on CORS

In Render → the service → **Environment**, set:

```
CORS_ORIGINS=https://<your-project>.vercel.app
```

Add any other origin you will demo from, comma-separated (for example a Vercel
preview URL, or `http://localhost:3000`). Save; Render redeploys. Then reload the
frontend and submit the demo exploit.

---

## Verifying the whole path

From the deployed frontend:

1. Connect a wallet (Sepolia).
2. Pass the World ID check — real widget if `WORLD_APP_ID`/`WORLD_RP_ID`/
   `WORLD_RP_SIGNING_KEY` are all set on the backend, otherwise a clearly
   labelled simulated check.
3. Submit `backend/fixtures/Exploit.sol`.
4. Watch the status walk `checking → verified → base-paid`: the checker forks
   Sepolia, measures 1000 USDC moved, pays 50 USDC base on-chain, writes the
   public record to Arkiv, and the AI writes the plain-language report.

A submitted exploit that is a duplicate of an earlier one is rejected by hash —
submitting the same fixture twice shows the duplicate path, not a second payout.

---

## Things that will bite you

- **Free Render instances sleep after 15 minutes idle** and take ~1 minute to
  wake. Hit `/health` a few minutes before demoing.
- **Reports are stored in memory.** A sleep, restart or redeploy wipes the
  report list and the duplicate-detection history. The on-chain payouts and the
  Arkiv records survive — the server's own list does not.
- **Free = 0.1 CPU / 512 MB, and a forked `forge test` is heavy.** If the first
  real submission times out or the instance is OOM-killed, change `plan: free`
  to `plan: starter` in `render.yaml` ($7/mo, 0.5 CPU) and redeploy. This is the
  single most likely thing to need changing.
- **`FORGE_TIMEOUT_MS` is 240000 in the blueprint** (vs 90000 locally) because a
  shared-CPU instance compiles and forks far more slowly than a laptop.
- **Only one submission runs at a time** by design. A second submission waits.
- **The private keys in the dashboard are test-network keys.** Keep them that
  way; nothing here should ever hold real value.

## Running the image locally

Same container Render runs, useful for debugging a build failure without waiting
on a deploy. Build context is the **repo root**, not `backend/`:

```bash
docker build -f backend/Dockerfile -t ghostproof-backend:local .
docker run --rm -p 8787:8787 --env-file backend/.env \
  -e MOCK_PIPELINE=false -e USE_ANVIL=false \
  -e FORGE_BIN=/home/app/.foundry/bin/forge \
  ghostproof-backend:local
curl http://localhost:8787/health
```
