import { http, createConfig } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { keccak256, parseAbi, stringToBytes, zeroAddress, type Hex } from "viem";
import { ADDRESSES, DEPLOYER, USDC_DECIMALS } from "@shared/config";

// publicnode is the RPC Person A confirmed works (rpc.sepolia.org is dead).
const RPC = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: { [sepolia.id]: http(RPC, { retryCount: 3 }) },
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
/** The company wallet: owner of the pool, the only account allowed to add a bonus. */
export const COMPANY_WALLET = DEPLOYER as Hex;
export const CONTRACTS_DEPLOYED = POOL_ADDRESS !== zeroAddress && USDC_ADDRESS !== zeroAddress;
export { USDC_DECIMALS };

// Typed subset of shared/abis/BountyPool.json + MockUSDC.json (only what the UI touches).
export const erc20Abi = parseAbi(["function balanceOf(address) view returns (uint256)"]);
export const bountyPoolAbi = parseAbi([
  "function getConfig() view returns (uint256 limit, uint256 cap, uint256 medium, uint256 high, uint256 critical)",
  "function reports(bytes32) view returns (uint8 status, address hacker, uint8 severity, uint256 basePaid, uint256 bonus, bool closed)",
  "function addBonus(bytes32 id, uint256 amount)",
  "function paidThisMonth() view returns (uint256)",
  "function openReports() view returns (uint256)",
]);

/** Report id string -> on-chain id. Same as the backend's settleReport: keccak256(UTF-8 bytes). */
export function reportIdToBytes32(reportId: string): Hex {
  return keccak256(stringToBytes(reportId));
}

export const toUsdc = (v: bigint | undefined) => (v === undefined ? undefined : Number(v) / 10 ** USDC_DECIMALS);

export const sepoliaTx = (hash: string) => `https://sepolia.etherscan.io/tx/${hash}`;
export const sepoliaAddr = (addr: string) => `https://sepolia.etherscan.io/address/${addr}`;
