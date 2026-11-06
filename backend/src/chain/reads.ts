/**
 * Read-only chain lookups for the company screen: the pool's configuration and
 * its current USDC balance. Safe to call only when addresses are deployed and
 * an RPC is set — the /pool route guards with chainReady()/addressesDeployed().
 */
import type { Address } from "viem";
import { bountyPoolAbi, mockUsdcAbi } from "./abis.js";
import { addresses, publicClient } from "./clients.js";

export interface PoolInfo {
  poolUsdc: number;
  autoPayLimitUsdc: number;
  monthlyCapUsdc: number;
  tiers: { medium: number; high: number; critical: number };
}

export async function readPool(): Promise<PoolInfo> {
  const client = publicClient();

  const [config, balance] = await Promise.all([
    client.readContract({
      address: addresses.pool,
      abi: bountyPoolAbi,
      functionName: "getConfig",
    }) as Promise<readonly [bigint, bigint, bigint, bigint, bigint]>,
    client.readContract({
      address: addresses.usdc,
      abi: mockUsdcAbi,
      functionName: "balanceOf",
      args: [addresses.pool as Address],
    }) as Promise<bigint>,
  ]);

  const toUsdc = (v: bigint) => Number(v) / 1e6;
  const [limit, cap, medium, high, critical] = config;

  return {
    poolUsdc: toUsdc(balance),
    autoPayLimitUsdc: toUsdc(limit),
    monthlyCapUsdc: toUsdc(cap),
    tiers: {
      medium: toUsdc(medium),
      high: toUsdc(high),
      critical: toUsdc(critical),
    },
  };
}
