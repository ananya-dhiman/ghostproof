/**
 * B6 — write the public record to Arkiv (testnet "rabdi").
 *
 * The record (interface #5) is the public, tamper-evident track record of what
 * the bounty paid. We also set an expiry so an unanswered report auto-expires —
 * that is our "response deadline", a natural fit for Arkiv.
 *
 * The SDK is loaded with a dynamic import inside the write, for two reasons:
 *   - it requires Node 22, and the rest of the backend runs on 20;
 *   - if Arkiv isn't configured we never touch it at all.
 * Every failure is swallowed and returns null — the local mirror that /records
 * serves is the source of truth for the demo, so a dead Arkiv never loses a
 * finding or breaks the flow.
 */
import { env } from "../env.js";
import type { ArkivRecord } from "../types.js";

export function arkivReady(): boolean {
  return Boolean(env.arkivAccessKey && env.arkivPrivateKey);
}

export interface ArkivWriteResult {
  entityKey: string;
  txHash: string;
}

export async function writeArkivRecord(
  record: ArkivRecord,
): Promise<ArkivWriteResult | null> {
  if (!arkivReady()) return null;

  try {
    const [{ createWalletClient, ExpirationTime }, { rabdi }, schema, { http, isHex }, { privateKeyToAccount }] =
      await Promise.all([
        import("@arkiv-network/sdk"),
        import("@arkiv-network/sdk/chains"),
        import("@arkiv-network/sdk/schema"),
        import("viem"),
        import("viem/accounts"),
      ]);

    const { addr, dec, defineSchema, str, u64 } = schema;

    const Reports = defineSchema("ghostproof-reports", {
      bountyId: str().indexed(),
      reportId: str().indexed(),
      exploitHash: str().indexed(),
      severity: str().optional(),
      valueMovedUsdc: dec(),
      status: str().indexed(),
      paidUsdc: dec(),
      bonusUsdc: dec(),
      createdAt: u64(),
      recorder: addr().indexed(),
    });

    const key = env.arkivPrivateKey.startsWith("0x")
      ? env.arkivPrivateKey
      : `0x${env.arkivPrivateKey}`;
    if (!isHex(key)) throw new Error("ARKIV_PRIVATE_KEY is not a hex private key");
    const account = privateKeyToAccount(key);

    const chain = rabdi({ accessKey: env.arkivAccessKey });
    const walletClient = createWalletClient({ chain, transport: http(), account });

    const base = {
      bountyId: record.bountyId,
      reportId: record.reportId,
      exploitHash: record.exploitHash,
      valueMovedUsdc: dec(String(record.valueMovedUsdc)),
      status: record.status,
      paidUsdc: dec(String(record.paidUsdc)),
      bonusUsdc: dec(String(record.bonusUsdc)),
      createdAt: u64(BigInt(record.createdAt)),
      recorder: addr(account.address),
    };
    const values = record.severity
      ? { ...base, severity: record.severity }
      : base;

    const { entityKey, txHash } = await walletClient.createEntity(Reports, values, {
      expiration: ExpirationTime.fromSeconds(env.arkivExpiresIn),
    });

    return { entityKey: String(entityKey), txHash: String(txHash) };
  } catch (err) {
    console.error("[arkiv] write failed; relying on the local mirror:", err);
    return null;
  }
}
