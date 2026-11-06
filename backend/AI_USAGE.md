# AI usage — backend (Person B)

Claude Code (Claude Opus) built the backend in this folder, pair-programming with
Person B. What that involved:

- **Scaffolding and architecture:** the Express service, the async submit →
  background pipeline → poll design, the in-memory store, and the split into
  `checker/`, `ai/`, `chain/`, `arkiv/`, and `routes/`.
- **The checker:** the hostile-source guard, the per-run Foundry sandbox, the
  generated harness that measures value moved and applies Person A's rules, and
  the `forge test --json` parsing. Claude also caught that a classic re-entrancy
  demo does not work against a plain ERC-20 and aligned the checker to Person A's
  actual access-control bug and `run(VulnerableVault)` entry point.
- **The AI evidence report:** wired Gemini (free tier) via `@google/genai`
  structured output (`responseSchema`), validated against a Zod schema, with a
  canned fallback so the demo never hangs on a model call. (An earlier version
  used `claude-haiku-5-5`; we switched the runtime provider to Gemini's free
  tier — the report is grounded and semi-templated, so provider choice is not
  quality-critical.)
- **On-chain payout and reads:** the viem clients and the `settleReport` /
  `getConfig` calls against Person A's `BountyPool` ABI.
- **Arkiv:** the record writer against `@arkiv-network/sdk`, after reading the
  SDK's own docs to get the current (v1) API right.
- **Coordination:** keeping `backend/STATUS.md` current and reconciling the shared
  interfaces with Persons A and C.

Everything was reviewed and tested before each commit (typecheck + an HTTP smoke
run of the real pipeline). Where something could only be verified with a key or a
deployed contract we did not have, that is stated plainly in `STATUS.md` rather
than claimed as working.

## Runtime AI (the product itself)

The deployed product makes **one** AI call per report: a single Gemini call
(free tier) that turns the checker's measured numbers into a plain-language
evidence report for the company. The AI only *describes* a result that was
already measured on-chain — it never decides the severity that triggers a
payout. That number comes from the fork plus the company's pre-written rule.
Test tokens have no real value.
