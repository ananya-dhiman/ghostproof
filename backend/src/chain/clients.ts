/**
 * viem clients for Sepolia, plus a single `chainReady()` gate.
 *
 * Everything on-chain (payout, pool reads) is optional until Person A deploys
 * and the operator sets keys. `chainReady()` is the one check the pipeline uses
 * to decide whether to attempt a real payout or leave it pending — so a missing
 * deploy degrades to a visible "verified, not yet paid" state, never a crash.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { ADDRESSES } from "../../../shared/config.js";
import { env } from "../env.js";

const ZERO = "0x0000000000000000000000000000000000000000";

export const addresses = {
  usdc: ADDRESSES.usdc as Address,
  vault: ADDRESSES.vault as Address,
  pool: ADDRESSES.pool as Address,
};

/** True once A has filled in real (non-zero) addresses in shared/config.ts. */
export function addressesDeployed(): boolean {
  return (
    addresses.usdc !== ZERO &&
    addresses.vault !== ZERO &&
    addresses.pool !== ZERO
  );
}

let _public: PublicClient | null = null;
export function publicClient(): PublicClient {
  if (!env.sepoliaRpcUrl) throw new Error("SEPOLIA_RPC_URL is not set");
  if (!_public) {
    _public = createPublicClient({
      chain: sepolia,
      transport: http(env.sepoliaRpcUrl),
    });
  }
  return _public;
}

let _wallet: WalletClient | null = null;
let _account: ReturnType<typeof privateKeyToAccount> | null = null;

export function backendAccount() {
  if (!_account) {
    if (!env.backendPrivateKey) throw new Error("BACKEND_PRIVATE_KEY is not set");
    const key = env.backendPrivateKey.startsWith("0x")
      ? (env.backendPrivateKey as `0x${string}`)
      : (`0x${env.backendPrivateKey}` as `0x${string}`);
    _account = privateKeyToAccount(key);
  }
  return _account;
}

export function walletClient(): WalletClient {
  if (!env.sepoliaRpcUrl) throw new Error("SEPOLIA_RPC_URL is not set");
  if (!_wallet) {
    _wallet = createWalletClient({
      account: backendAccount(),
      chain: sepolia,
      transport: http(env.sepoliaRpcUrl),
    });
  }
  return _wallet;
}

/** Can we actually send the payout transaction right now? */
export function chainReady(): { ok: boolean; reason?: string } {
  if (!env.sepoliaRpcUrl) return { ok: false, reason: "SEPOLIA_RPC_URL not set" };
  if (!env.backendPrivateKey) return { ok: false, reason: "BACKEND_PRIVATE_KEY not set" };
  if (!addressesDeployed()) return { ok: false, reason: "contracts not deployed yet (shared/config.ts addresses are zero)" };
  return { ok: true };
}
