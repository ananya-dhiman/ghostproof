/**
 * B4 — the automatic base payout.
 *
 * After the checker confirms a rule broke, the backend (which must be the pool's
 * `settler`) calls BountyPool.settleReport. The pool itself enforces the limits:
 * the base is min(tierAmount[severity], autoPayLimit), further capped by the
 * month's remaining allowance, and the pool is locked while the report is open.
 * The AI never touches this path.
 *
 * settleReport(bytes32 id, address hacker, uint8 severity, bytes sig) -> uint256
 * `sig` is "0x" (reserved for a future sealed-checker signature check).
 */
import type { Address } from "viem";
import type { SeverityName } from "../types.js";
import { bountyPoolAbi } from "./abis.js";
import { addresses, backendAccount, publicClient, walletClient } from "./clients.js";
import { reportIdToBytes32 } from "./ids.js";

export interface PayoutResult {
  txHash: `0x${string}`;
  paidUsdc: number;
  onchainId: `0x${string}`;
}

/** A's Rules enum: Medium=1, High=2, Critical=3. */
function severityToUint8(name: SeverityName): number {
  if (name === "critical") return 3;
  if (name === "high") return 2;
  return 1;
}

export async function settlePayout(
  reportId: string,
  hacker: Address,
  severity: SeverityName,
): Promise<PayoutResult> {
  const onchainId = reportIdToBytes32(reportId);
  const sev = severityToUint8(severity);

  // simulateContract both checks the call will succeed (settler auth, pool
  // balance, caps) and gives us settleReport's return value — the amount paid —
  // which a plain tx receipt does not expose.
  const { request, result } = await publicClient().simulateContract({
    address: addresses.pool,
    abi: bountyPoolAbi,
    functionName: "settleReport",
    args: [onchainId, hacker, sev, "0x"],
    account: backendAccount(),
  });

  const txHash = await walletClient().writeContract(request);
  await publicClient().waitForTransactionReceipt({ hash: txHash });

  const paidRaw = typeof result === "bigint" ? result : 0n;
  return {
    txHash,
    paidUsdc: Number(paidRaw) / 1e6,
    onchainId,
  };
}
