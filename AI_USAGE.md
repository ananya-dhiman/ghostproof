# AI usage

ETHGlobal's Classic track asks teams to document how they used AI. This is the project-wide
record. Person B keeps a more detailed per-area log in [`backend/AI_USAGE.md`](backend/AI_USAGE.md).

**Tool used:** Claude Code (Anthropic) by all three of us, each in our own folder and on our own
branch. No other AI coding tool was used.

**Timing:** the repository's first commit is after the hackathon start. No project-specific code,
design or assets existed before it — see the git history, which is incremental rather than one
large drop.

---

## Two different things, and the difference matters

People read "AI" in this project two ways, so we separate them explicitly:

### 1. AI inside the product (runtime)
Ghostproof calls a language model **once per report** to turn the checker's measured numbers into
a readable evidence report (`backend/src/ai/`). That is all it does.

**The model never decides whether anyone gets paid.** The payout amount comes from which of the
company's pre-written rule tests failed when the attack was replayed on a fork — a deterministic
measurement the company can re-run itself. The report is labelled in the UI as *"describes only"*
and the suggested severity is labelled *"advice only; the pay used the rule's severity."*

This was a deliberate design decision, taken after mentors told us that companies will not release
money on an AI's assessment. The model's output is also untrusted input: a hacker could hide
instructions inside a submission, so the model's text has no authority over the money path. There
is always a canned fallback report so a dead API never hangs the demo.

### 2. AI used to build the project (development)
All three of us wrote code with Claude Code. Roughly:

| Area | What AI helped with |
|---|---|
| **Contracts** (`contracts/`) | Scaffolding the Foundry project; drafting `VulnerableVault`, `BountyPool`, `Rules`, `MockUSDC`; the Foundry tests; the deploy script; running `forge test` and the Sepolia deploy; reading the deployed state back on-chain to verify it |
| **Backend** (`backend/`) | See `backend/AI_USAGE.md` (Person B's own record) |
| **Frontend** (`frontend/`) | Scaffolding, UI and the wiring to the backend and contracts — noted in `frontend/README.md` |
| **Docs** | Drafting `/arkiv/*.md`, the README CROPS section, `PLAN.md`, and the status files |

---

## What the humans decided, not the AI

This matters more than the code, so it is spelled out:

- **The idea** is a team member's, not AI-generated. It came out of our own discussion about
  hackers being ignored after reporting bugs.
- **The pivot that defines the product.** An earlier version had the system judging severity
  itself. Mentors — citing DevCon talks on not trusting AI agents for final reports — told us
  companies would never release funds that way. The team changed the model to *"machines measure,
  humans decide, and the automatic part is capped by a limit the company sets in advance."* That
  decision was ours.
- **The guarantee design.** Capping the automatic payout at a company-set limit, with any larger
  reward left to the company's discretion, was a team choice about what companies would actually
  agree to.
- **The mandatory default rule** (a fresh account must never end up holding other people's money)
  was added by us to stop a company writing deliberately weak rules.
- **Scope cuts.** We dropped a neutral-reviewer flow, a dispute process, and an Arc integration
  ourselves, for time and for prize fit.
- **What to disclose.** The honest trade-offs listed below and in the README were our call.

## How we checked the AI's output

We did not take generated code on trust:

- **Contracts:** 5/5 Foundry tests pass, and they also compile clean under `solc 0.8.28` with no
  warnings. After deploying, we read the contract state back from Sepolia to confirm the vault and
  pool held what we expected, rather than trusting the deploy log.
- **The payout:** verified independently by fetching the transaction receipt (`status 1`) and the
  hacker's token balance on-chain, not by believing the backend's own response.
- **A live end-to-end run** found four real bugs that code review had not: a missing `forge-std`
  in the checker sandbox (which breaks the checker on any fresh clone), a dedupe entry written for
  a submission that failed on *our* infrastructure, no caller for `closeReport`, and the public
  record page reading a local mirror instead of Arkiv. Running it was the only way these surfaced.
- **Documentation claims:** where something is written but unverified, the docs say so — see the
  note in `/arkiv/friction.md` and `/arkiv/reach.md` about the Arkiv write path.

## Specs and prompts

We worked from written specs rather than ad-hoc prompting, and those files are in the repo:

- `PLAN.md` — the build plan, the work split, and the frozen interfaces between the three parts
- `CLAUDE.md` (root, and `backend/CLAUDE.md`) — the standing rules each of us gave our AI tool:
  branch discipline, never edit another person's shared file, treat every submission as hostile,
  demo-first, no secrets in git
- `backend/STATUS.md` and the per-branch status files — the living hand-off notes we used to
  coordinate across three people working in parallel

## Honest limitations

- The checker runs on one ordinary server standing in for a sealed, publicly-inspectable machine.
  Today a company trusts our server's signed result.
- The World ID check runs in simulated mode in the demo build; the server-side verification is
  implemented, but our app's action was not registered in time. The UI labels it as simulated.
- The public record page currently reads a local mirror of what we wrote to Arkiv rather than
  querying Arkiv directly.
- Test tokens on Sepolia have no monetary value.
