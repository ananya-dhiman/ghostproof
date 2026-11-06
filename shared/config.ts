// Shared config — OWNED BY PERSON A. Person B and C: read only, do not edit.

export const CHAIN = {
  name: "Ethereum Sepolia",
  chainId: 11155111,
  rpcEnv: "SEPOLIA_RPC_URL", // put your RPC URL in each service's own .env
};

// Deployed to Ethereum Sepolia on 2026-11-06.
export const ADDRESSES = {
  usdc: "0xbbE04C8bE88dE0aa2229356986E6fB44f59ABeB9", // MockUSDC (demo, 6 decimals)
  vault: "0x8ec3c18f93490eAdb94d08a2C46d864a37B5A979", // VulnerableVault (seeded with 1000 USDC)
  pool: "0x5Dc887D6Ee53a809fcEB66Fd5799F3C18f8A3488", // BountyPool (funded with 2000 USDC)
};

// The pool's owner (company) and settler (checker backend) are both the deployer for now.
// Person A can repoint the settler to Person B's backend address via pool.setSettler().
export const DEPLOYER = "0xBCB67d6902e584f703473fC3297d2a9970BA3B20";
export const SETTLER = DEPLOYER;

// Circle's official test USDC on Ethereum Sepolia, if you prefer it over MockUSDC
// (verify on Circle's faucet before using): 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
export const USDC_DECIMALS = 6;

export const SEVERITY = { MEDIUM: 1, HIGH: 2, CRITICAL: 3 } as const;
export type Severity = (typeof SEVERITY)[keyof typeof SEVERITY];
