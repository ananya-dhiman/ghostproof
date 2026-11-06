/**
 * The on-chain report id.
 *
 * BountyPool keys reports by a bytes32. Backend and frontend must derive the
 * same one from the string reportId so `settleReport` (backend) and
 * `addBonus`/`reports` (frontend) refer to the same report. We use
 * keccak256 of the UTF-8 bytes of the reportId.
 */
import { keccak256, toHex } from "viem";

export function reportIdToBytes32(reportId: string): `0x${string}` {
  return keccak256(toHex(reportId));
}
