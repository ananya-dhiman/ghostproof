# Ghostproof backend (Person B) — rules for Claude Code

**This folder is Person B: the checker + backend.** Node/TypeScript, branch
`b-backend`. The build order is `backend/PLAN.md`; team-wide rules are in the
root `CLAUDE.md`; shared interfaces are in `new_PLAN.md`.

## What we own vs consume

- **We own:** interfaces #2 (checker result), #3 (evidence report), #5 (Arkiv
  record) and the HTTP contract. We also own `/shared/types.ts` — draft it in
  hour 1, then it is FROZEN; announce any change to A and C first.
- **We consume:** A's ABIs (`/shared/abis/`) and addresses (`/shared/config.ts`).
  Read them, never edit them.

## Backend-specific rules

- **Everything lives under `/backend`.** Own `package.json`, own `tsconfig.json`,
  own `node_modules`. There is no root package.json — do not create one.
- **Node 22+** (the Arkiv SDK v0.6.x requires it). TypeScript, ESM.
- **Unblock Person C first.** The HTTP endpoints return correctly-shaped data
  (mock is fine) before anything else, so the frontend can build against them.
  Real logic replaces the mocks behind the same shapes.
- **Never block the HTTP request on a fork run.** `POST /submit` returns a
  `reportId` immediately; the check runs in the background; C polls
  `GET /report/:id`.
- **Treat every submission as hostile code.** Before running anything, the guard
  (`src/checker/guard.ts`) rejects sources containing `vm.ffi`, `vm.env*`,
  `vm.readFile/writeFile`, `vm.rpc`, non-local `vm.createFork`, or absolute-path
  imports. Spawn `forge`/`anvil` with a scrubbed environment — no
  `ANTHROPIC_API_KEY`, no `BACKEND_PRIVATE_KEY`, no RPC URL beyond the local
  anvil endpoint. Hard-kill the child on timeout. One submission at a time.
- **No secrets in git.** Keys live in `/backend/.env` (gitignored);
  `/backend/.env.example` holds the names only.
- **AI model:** `claude-haiku-5-5` for the evidence report via
  `client.messages.parse()` with a Zod schema. If the write-up reads thin, switch
  to `claude-opus-5-5` with `effort: "low"`. Always keep the canned fallback
  (`src/ai/fallback.ts`) working; the live demo must never hang on an API call.
- **The AI never decides pay.** Severity-for-pay comes from which of the
  company's pre-written rule tests failed on the fork. The AI only describes.
- **Every external call needs a timeout and a fallback:** Anthropic, Arkiv, the
  Sepolia RPC, World ID. A dead dependency degrades to a visible status, never a
  hung request.
