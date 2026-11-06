# How we use Arkiv

All Arkiv code is in the backend: `backend/src/arkiv/client.ts`, called from the
submission pipeline (`backend/src/pipeline/index.ts`, step 12).

## The data we store

One entity per **paid** report — the public outcome, never the exploit itself.
Schema (`defineSchema("ghostproof-reports", …)`):

| Attribute | Type | Indexed | Meaning |
|-----------|------|---------|---------|
| `bountyId` | str | ✓ | which bounty/vault |
| `reportId` | str | ✓ | our report id |
| `exploitHash` | str | ✓ | keccak of the normalized exploit (dedupe/evidence) |
| `severity` | str | | critical / high / medium (omitted if none) |
| `valueMovedUsdc` | dec | | how much the attack moved, measured on the fork |
| `status` | str | ✓ | base-paid / bonus-added / rejected |
| `paidUsdc` | dec | | the automatic base actually paid |
| `bonusUsdc` | dec | | any company bonus on top |
| `createdAt` | u64 | | unix seconds |
| `recorder` | addr | ✓ | the backend account that wrote it |

## Writing

```ts
const chain = rabdi({ accessKey: ARKIV_ACCESS_KEY });
const walletClient = createWalletClient({ chain, transport: http(), account });
const { entityKey, txHash } = await walletClient.createEntity(
  Reports,
  values,
  { expiration: ExpirationTime.fromSeconds(ARKIV_EXPIRES_IN) }, // the deadline
);
```

- We write **only after a real base payout succeeds**, so the public record shows
  real outcomes, never a half-finished report.
- The `expiration` is the company's response deadline — an unanswered report
  expires on its own, with no timer on our side.
- The SDK is loaded with a **dynamic import** so the rest of the backend runs on
  Node 20; Arkiv needs Node 22.

## Reading

The public record page calls the backend's `GET /records`. Every record we write
to Arkiv is also kept in an in-process **mirror**; `/records` serves the mirror so
the page still renders if the Arkiv RPC is momentarily unreachable during judging.
The mirror is a cache of what we wrote, not a second source of truth — Arkiv is
the record.

## Failure handling

Every Arkiv call is wrapped so a failure is logged and returns `null`; the finding
and its payout are never lost because Arkiv hiccuped. This is the demo-first
stance: the money path (fork → rule → payout) must not depend on the record write.

## Config

`ARKIV_ACCESS_KEY` (from hub.arkiv.network/access-keys) and `ARKIV_PRIVATE_KEY`
(a rabdi account funded at hub.arkiv.network/faucet) in `backend/.env`. Verify the
integration on its own with `npm run arkiv-smoke`, which writes one sample record
and prints its entity key.
