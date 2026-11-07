# Friction — honest feedback from building on Arkiv

Written at the end of a ~12-hour hackathon build. The Arkiv integration lives in
`backend/src/arkiv/client.ts`. We have split this into **things that actually blocked us**,
**documentation problems**, and **one design tension we think is worth your attention**. Where we
could not verify something inside the event, we say so rather than claim it worked.

---

## 1. Blocked us

### Node 22 is required, and it forced an awkward workaround
`@arkiv-network/sdk` needs Node 22. The rest of our backend runs on Node 20, and we were not
willing to move the whole service onto a newer runtime at hour 8 of a hackathon for one feature.

Our workaround: load the SDK via a **dynamic `import()`** inside the Arkiv client only, so Node 20
runs everything else and only the record-writing path needs 22. It works, but it means the Arkiv
code path is the one part of the backend whose runtime requirement differs from the rest, and the
failure only appears at the moment you first try to write a record.

**What would have helped:** stating the Node floor at the very top of the TypeScript
getting-started page (we found it by failing), and ideally shipping a build that runs on the
current LTS.

### Two credentials before the first write
To write a single entity you need **both**:
- `ARKIV_ACCESS_KEY` from `hub.arkiv.network/access-keys`, and
- a separate **funded** account (`ARKIV_PRIVATE_KEY`) topped up from `hub.arkiv.network/faucet`.

Neither alone is enough. Compared with the rest of our stack — where one funded key is the whole
story — this is two gates before you can see anything work, and it was the single biggest reason
our Arkiv path was the last thing to come alive.

**Resolved before submission.** The credentials landed and the write path is now **verified against
the live rabdi testnet** — multiple reports have been written as real entities, and the public record
page reads them back off Arkiv rather than from our mirror. What stands as feedback is how long the
two-credential gate kept this the last subsystem to come alive.

---

## 2. Documentation problems

### Version drift between pages
Within the same docs site we hit three different versions in the space of one task:
- the TypeScript getting-started guide pins **SDK v0.4.4**
- the docs index states it was last updated against **v0.6.0**
- the generated API reference documents `expiresIn` **in seconds** and marks the older `btl`
  field **deprecated**

So the first question on arrival — "which field sets the lifetime, and in what unit?" — has three
plausible answers depending on which page you landed on. We went with `ExpirationTime.fromSeconds`
from `@arkiv-network/sdk/utils`.

**What would have helped:** one version banner per page, and a single canonical expiry example.

### Numbers stored as strings silently break range queries
The docs do mention it, but it is easy to miss and impossible to notice until a query returns
nothing: if you store a numeric value as a `str`, `gt()` / `lt()` filters won't work on it. We
caught this in time and typed `valueMovedUsdc`, `paidUsdc` and `bonusUsdc` as `dec`.

**What would have helped:** this belongs as a warning box in the schema section, not a line in a
query page — it is a data-modelling decision you cannot cheaply reverse later.

### No end-to-end "write then query it back" example
Each piece exists (`createEntity`, `buildQuery().where(eq(...))`, `withAttributes`,
`withPayload`), but we did not find one short example that writes an entity with indexed
attributes **and an expiry**, then reads it back by attribute. That is the actual shape of every
real integration, and assembling it from three pages is where most of our reading time went.

---

### Two things we only learned when we implemented the read
- **`where` filters only on indexed columns.** Sensible, but it shapes the schema earlier than you
  expect: we had already indexed `recorder`, which is what made "every record this backend wrote"
  a cheap query. Had we not, there would have been no way to list our own records without a scan.
- **Rows come back as `{ type, value }` wrappers**, so mapping an entity back to a plain object means
  unwrapping every attribute. Correct and explicit, but a documented `toPlain(row)` helper would have
  saved us writing one.

## 3. A design tension worth your attention

**Expiry is excellent as a deadline and wrong as an archive — and we needed both.**

Arkiv's first-class `expiration` is genuinely the feature that sold us. We use it directly as the
company's response deadline: an unanswered report expires on its own and we never wrote a timer,
a cron job, or a cleanup task. That is a real saving and we would use it again.

But our product also promises a **permanent public track record** — "which companies actually pay
their hackers" is the thing that makes the bounty credible. Those two needs point in opposite
directions on the same entity: the deadline wants the record to disappear, the track record wants
it to persist forever.

For the hackathon we accepted the tension and set a long expiry. The clean fix is two entities —
a short-lived "open report" that carries the deadline, and a permanent "settled outcome" — which
means writing twice and reasoning about the pair. What we would have liked is a way to express
*"this attribute is a deadline; the entity itself is permanent"*, or an expiry that transitions an
entity to a terminal state instead of removing it.

---

## 4. Smaller notes

- **Entities are public, which is correct here but shapes the schema.** It forced an explicit
  decision about what must never be written: we store the verdict (severity, amounts, status) and
  never the exploit source. That was the right pressure to apply, but it is worth saying loudly in
  the docs that schema design on Arkiv is also a disclosure decision.
- **viem-based SDK was the single best thing about the integration.** Our backend already signs
  Sepolia transactions with viem, and `createWalletClient({ chain: rabdi(...) })` is the same
  shape. Writing a record felt like sending a transaction we already knew how to send. No second
  mental model, and it is why this integration took hours rather than a day.
- **`hub.arkiv.network` is the right front door** — access keys, faucet and docs in one place was
  easy to navigate once we knew it existed.
