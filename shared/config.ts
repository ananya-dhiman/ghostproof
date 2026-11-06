// Shared config — OWNED BY PERSON A. Person B and C: read only, do not edit.

export const CHAIN = {
  name: "Ethereum Sepolia",
  chainId: 11155111,
  rpcEnv: "SEPOLIA_RPC_URL", // put your RPC URL in each service's own .env
};

// Filled in after Person A deploys (see contracts/README.md). Placeholders until then.
export const ADDRESSES = {
  usdc: "0x0000000000000000000000000000000000000000", // MockUSDC (demo)
  vault: "0x0000000000000000000000000000000000000000", // VulnerableVault
  pool: "0x0000000000000000000000000000000000000000", // BountyPool
};

// Circle's official test USDC on Ethereum Sepolia, if you prefer it over MockUSDC
// (verify on Circle's faucet before using): 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
export const USDC_DECIMALS = 6;

export const SEVERITY = { MEDIUM: 1, HIGH: 2, CRITICAL: 3 } as const;
export type Severity = (typeof SEVERITY)[keyof typeof SEVERITY];
