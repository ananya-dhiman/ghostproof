# Ghostproof

A bug-bounty tool that **helps a company assess a submitted bug** and guarantees the hacker a
small automatic base payment, while any larger reward stays the company's choice.

A hacker submits an attack as a runnable test. Our checker replays it on a **copy of the chain**
(a fork) and measures the money moved — no AI decides this. If the attack breaks a rule the
company **wrote in advance**, the contract pays a capped base from a locked pool automatically.
An AI then writes a plain-language **evidence report** to help the company decide any bonus.
Public outcomes go on a shared record (Arkiv). Hackers and reviewers are checked as real,
unique humans with World ID.

Built at ETHGlobal Mumbai (Classic track). **Test tokens have no monetary value.**

## Repo layout
- `contracts/` — Solidity (Foundry): the demo vault, the bounty pool, the rules. (Person A)
- `backend/` — Node/TS checker + API: fork runner, AI report, payout, Arkiv. (Person B)
- `frontend/` — Next.js: company / hacker / public-record screens + World ID. (Person C)
- `shared/` — `config.ts` (chain + addresses) and `types.ts` (the JSON contract between services).
- `PLAN.md` — the build plan, work split, interfaces, and demo script.

## Security (CROPS)
Security is the reason this project exists: it closes the gap where a company could see a bug and
quietly decline to pay. The automatic base is enforced by a contract, triggered by a rule the
company committed to **before** seeing the bug — not by anyone's after-the-fact opinion, and not by
an AI.
- **Secure:** payouts are measured from a deterministic fork replay; submitted exploit code runs
  with `ffi` and file-system cheatcodes off (see `contracts/foundry.toml`).
- **Private:** a report's details are shared only with the company; the public record carries the
  outcome, not the exploit.
- **Open source:** MIT-licensed.
- **Censorship-resistant / trade-off:** the on-chain pool and public record can't be edited away
  by the company; the live demo's checker runs on one server standing in for a sealed computer —
  a stated trade-off, not the production design.

No third-party trackers in the client.
