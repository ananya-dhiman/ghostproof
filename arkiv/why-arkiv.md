# Why Arkiv

Ghostproof pays hackers automatically for proven bugs. The thing that makes that
trustworthy is not the payout — it is the **public, permanent record of what was
proven and what was paid**. That record is what Arkiv holds.

## What we needed

- **A track record anyone can check.** A hacker deciding whether to trust this
  bounty, or a company deciding whether it is being run fairly, should be able to
  see every past report's outcome without asking us. The record must not live in
  our database where we could quietly edit it.
- **A built-in deadline.** When a bug is proven, the company has a window to add a
  bonus on top of the automatic base. If they go silent, the open report should
  not hang forever — it should expire on its own.
- **Something we can query.** The public page filters by bounty and by outcome
  (base paid / bonus added), so the store has to be queryable by indexed fields,
  not just a blob.

## Why Arkiv fits

- **Entities are public and on-chain.** Each report outcome is an Arkiv entity on
  the rabdi testnet — readable by anyone, not sitting in our private DB. That is
  exactly the "shared record" the product promises.
- **Expiry is a first-class feature.** Every entity is written with an
  `ExpirationTime`. We use it directly as the company's response deadline: an
  unanswered report simply expires. We did not have to build a timer, a cron, or
  a cleanup job — the store enforces the deadline for us.
- **Indexed attributes give us queries.** We index `bountyId`, `reportId`,
  `exploitHash`, `status`, and the recorder address, so the public record page can
  ask "show me every paid report for this bounty" cheaply.
- **It is viem-based.** The backend already signs Sepolia transactions with viem;
  Arkiv's SDK extends the same client surface, so writing a record is the same
  shape of code as sending a payout — no second mental model.

## The honest trade-off (privacy / censorship-resistance)

Making the record public is the point, so there is a privacy cost: the hacker's
address, the severity, and the amount paid are visible to anyone. That is a
deliberate choice — a bounty's credibility comes from its outcomes being checkable
— but it means we deliberately do **not** put the exploit source or any
company-identifying detail on Arkiv, only the outcome. The exploit stays with the
checker; Arkiv holds the verdict, not the weapon.
