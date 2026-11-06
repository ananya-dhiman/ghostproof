# Ghostproof — ground rules

- Classic track: write NO code copied from before the hackathon start. Public libraries and
  starter kits only (OpenZeppelin, Foundry, Next.js, wagmi, viem, World IDKit, Arkiv SDK,
  Anthropic SDK are all fine).
- Commit small and often with clear messages. One giant final commit can get us disqualified.
  Keep an AI_USAGE.md noting how AI tooling helped.
- Do NOT change any shared interface (JSON shapes in shared/types.ts, the contract ABI, config
  values in shared/config.ts) without telling the other two. These are the source of truth.
- Network is Ethereum Sepolia, token is USDC. Never mainnet.
- Verify World ID proofs on the BACKEND only (verifyCloudProof), never trust the browser.
- Sandbox safety when running submitted test code: no internet except the fork RPC, no private
  keys in the environment, and Foundry FFI off (ffi = false, fs_permissions = [] in
  foundry.toml). Treat every submission as hostile.
- Demo-first. If something is slow, build the simplest version that makes the demo work and
  leave a // TODO. Flag it to the team.
- Plain names in UI and docs — no bare jargon. We are explaining to beginners.
- Test tokens have no real value. Say so in the README.

## Branches — one per person, firm rule
- Person A -> `a-contracts`, Person B -> `b-backend`, Person C -> `c-frontend`.
- Nobody commits straight to `main`; `main` only changes through a merged Pull Request.
- Start with: `git checkout main && git pull && git checkout -b <your-branch>`.
- Pull `main` into your branch every couple of hours
  (`git checkout main && git pull`, then `git checkout <your-branch> && git merge main`).
- Work only inside YOUR folder. Files in `shared/` have a single owner each (Person A) — don't
  edit one you don't own.
