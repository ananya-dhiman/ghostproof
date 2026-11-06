/**
 * Loads Person A's compiled ABIs from /shared/abis (A owns these; we only read
 * them). Loaded via fs at startup rather than a static import so the JSON stays
 * outside the TS rootDir without upsetting the compiler.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Abi } from "viem";

const here = path.dirname(fileURLToPath(import.meta.url));
const abiDir = path.resolve(here, "../../../shared/abis");

function load(name: string): Abi {
  return JSON.parse(readFileSync(path.join(abiDir, name), "utf8")) as Abi;
}

export const bountyPoolAbi = load("BountyPool.json");
export const mockUsdcAbi = load("MockUSDC.json");
export const vulnerableVaultAbi = load("VulnerableVault.json");
