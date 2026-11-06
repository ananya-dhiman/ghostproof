# Reach — who adopts this, and why the record has to be public

Ghostproof pays a hacker a guaranteed base automatically when a bug is **proven by replaying the
attack on a fork**, and leaves any larger reward to the company. Arkiv holds the public record of
what was proven and what was paid.

This document is about adoption: who picks it up first, what makes them stay, and why putting the
record on Arkiv rather than in our database is what lets it spread.

---

## The problem is getting worse, not better

Bug-bounty triage is breaking under AI-generated reports:

- **curl ended its HackerOne bounty programme on 31 January 2026** after a flood of AI-written
  reports. It had paid out over $100,000 since 2019. The maintainers' stated reason was the time
  cost of triaging submissions that turned out to be nothing.
  ([The Register](https://theregister.com/2026/01/21/curl_ends_bug_bounty))
- **Elastic received 1,390+ reports in the first half of 2026 alone** — more than its 2024 and
  2025 totals combined — and now runs an AI triage agent that agrees with its human reviewers
  about **85%** of the time, i.e. disagrees roughly one time in seven.
  ([Elastic Security Labs](https://www.elastic.co/security-labs/blog/ai-vulnerability-triage-bug-bounty-hackerone))
- **HackerOne paused the Internet Bug Bounty** on 27 March 2026.

The industry's answer so far is *more* AI judgement. Ours is the opposite: if the attack does not
actually run and move money on a fork, the report never reaches a human. Nobody's opinion — ours
or a model's — decides whether a payout happens.

## Who adopts first

**1. Small and mid-size protocols that cannot afford a real bounty programme.**
A managed programme means a retainer and a triage team. These teams currently choose between
nothing and a Discord channel. Ghostproof lets them set an auto-pay limit they are comfortable
with — $50, $500, whatever — write their rules once, fund a pool, and get machine-verified
reports with the junk already filtered out. The limit is the ceiling on their automatic exposure,
so adopting is a bounded decision rather than an open-ended liability.

**2. Hackers who have been ghosted.**
The reason good researchers stop submitting is not low payouts, it is doing the work and being
told "not a bug" or hearing nothing. A guaranteed base, enforced by a contract rather than a
promise, changes the expected value of writing up a finding. The hacker does not have to trust the
company — only the replay.

**3. Maintainers in curl's position.**
Projects that shut their programme down did so because of triage cost, not because they stopped
caring about security. A filter that rejects anything that does not execute is addressed exactly
at them.

## What makes it spread: the record is the marketing

A bounty's credibility is its history. "Does this company actually pay?" is the only question a
researcher cares about, and today the answer lives in private dashboards and word of mouth.

On Arkiv, every settled outcome is a public entity: which bounty, what severity, how much moved,
what was paid, whether a bonus followed. That produces a flywheel we do not have to operate:

- a company with a good record **points at it** to attract researchers;
- a company with a bad record cannot hide it, which is pressure to pay well;
- researchers pick targets by checking records, so good payers get more findings;
- more findings make the record richer, which makes it more worth checking.

**This only works because the record is not ours.** If it sat in our database, every claim about
it would reduce to "trust Ghostproof", and a company's incentive would be to lobby us to edit
history. On Arkiv the record is queryable by anyone and editable by no one — including us. The
credibility we are selling is credibility we cannot grant ourselves.

## Reach we get for free from Arkiv

Because the outcomes are public entities with indexed attributes (`bountyId`, `status`,
`exploitHash`, `recorder`), third parties can build on them **without our permission and without
our API**:

- a "which bounties actually pay" leaderboard across every company using the protocol;
- a researcher's own verifiable track record — their paid findings, provable without us
  vouching for them;
- a risk signal for anyone else: a protocol with repeated critical findings is visible.

None of those need us to ship anything, sign a partnership, or keep an API up. That is the
practical difference between publishing data and owning it, and it is the honest answer to "why
Arkiv and not Postgres".

## The adoption path from here

1. **Open the schema.** Publish the `ghostproof-reports` schema name and attribute list so anyone
   can query the record set directly. This is a documentation task, not a build.
2. **One real company on testnet.** Today we demo one vault we wrote ourselves. The next step is a
   protocol writing *its own* rules — that is the step that proves the rules-in-advance model
   works when we are not the author.
3. **Rules libraries.** "No theft" generalises to every protocol holding user funds. A shared
   library of pre-written rules per protocol type is what makes onboarding a ten-minute job
   instead of an engineering project.
4. **Researcher identity.** World ID already gives us one-account-per-human. Attaching the public
   record to that gives researchers a portable, verifiable reputation — a reason to bring their
   next finding here rather than to a private programme.

## What honestly limits reach today

- **Testnet only**, one vault, one company, our own rules — the model is proven mechanically
  (the replay, the rule, the capped payout, the lock), not socially.
- **The checker runs on one server** standing in for a sealed, publicly-inspectable machine. Until
  that is real, a company is trusting our server's signed result. We state this in the demo rather
  than imply otherwise.
- **Bugs that break no written rule** get no automatic payment. Logic bugs that do not move money
  still need a human, and our honest claim is a smaller guaranteed floor, not a replacement for
  judgement.
- **At the time of writing the Arkiv write path is code-complete but not verified live** (see
  `friction.md`) — the access key and faucet funds did not land before the deadline.
