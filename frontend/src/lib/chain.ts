import { http, createConfig } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { keccak256, parseAbi, stringToBytes, zeroAddress, type Hex } from "viem";
import { ADDRESSES, USDC_DECIMALS } from "@shared/config";

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || undefined),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

export const USDC_ADDRESS = ADDRESSES.usdc as Hex;
export const POOL_ADDRESS = ADDRESSES.pool as Hex;
export const VAULT_ADDRESS = ADDRESSES.vault as Hex;
/** True once Person A has filled in real addresses in shared/config.ts. */
export const CONTRACTS_DEPLOYED = POOL_ADDRESS !== zeroAddress && USDC_ADDRESS !== zeroAddress;
export { USDC_DECIMALS };

// Minimal ABIs: only what the UI touches. Full ABIs live with Person A's contracts.
export const erc20Abi = parseAbi(["function balanceOf(address) view returns (uint256)"]);
export const bountyPoolAbi = parseAbi([
  "function getConfig() view returns (uint256 limit, uint256 cap, uint256 medium, uint256 high, uint256 critical)",
  "function addBonus(bytes32 id, uint256 amount)",
  "function paidThisMonth() view returns (uint256)",
  "function openReports() view returns (uint256)",
]);

/**
 * Report id string ("rep_001") to the bytes32 used on-chain.
 * TODO(B): confirm the backend uses keccak256(reportId) when it calls settleReport.
 */
export function reportIdToBytes32(reportId: string): Hex {
  if (/^0x[0-9a-fA-F]{64}$/.test(reportId)) return reportId as Hex;
  return keccak256(stringToBytes(reportId));
}

export const sepoliaTx = (hash: string) => `https://sepolia.etherscan.io/tx/${hash}`;
export const sepoliaAddr = (addr: string) => `https://sepolia.etherscan.io/address/${addr}`;
