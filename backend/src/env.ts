/**
 * Environment loading and validation.
 *
 * Rule: fail loudly at boot, not at hour 13. Anything missing is reported as a
 * disabled subsystem (visible on GET /health) rather than a crash, so the demo
 * can run with only some parts wired up.
 */
import "dotenv/config";

function str(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

function num(name: string, fallback: number): number {
  const raw = str(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = str(name).toLowerCase();
  if (!raw) return fallback;
  return raw === "true" || raw === "1" || raw === "yes";
}

export const env = {
  port: num("PORT", 8787),
  corsOrigins: str("CORS_ORIGINS", "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),

  mockPipeline: bool("MOCK_PIPELINE", true),

  sepoliaRpcUrl: str("SEPOLIA_RPC_URL"),
  backendPrivateKey: str("BACKEND_PRIVATE_KEY"),

  useAnvil: bool("USE_ANVIL", true),
  forgeTimeoutMs: num("FORGE_TIMEOUT_MS", 90_000),
  maxExploitBytes: num("MAX_EXPLOIT_BYTES", 65_536),

  anthropicApiKey: str("ANTHROPIC_API_KEY"),
  anthropicModel: str("ANTHROPIC_MODEL", "claude-haiku-5-5"),
  aiTimeoutMs: num("AI_TIMEOUT_MS", 20_000),

  worldAppId: str("WORLD_APP_ID"),
  worldActionId: str("WORLD_ACTION_ID", "verify-human"),

  arkivRpcUrl: str("ARKIV_RPC_URL", "https://rpc.rabdi.db-chain.testnet.arkiv.network"),
  arkivPrivateKey: str("ARKIV_PRIVATE_KEY"),
  arkivExpiresIn: num("ARKIV_EXPIRES_IN", 604_800),
} as const;

/**
 * Which subsystems have enough configuration to be usable.
 * `foundry` is filled in at runtime by a `forge --version` probe.
 */
export function configuredSubsystems() {
  return {
    sepoliaRpc: Boolean(env.sepoliaRpcUrl),
    anthropic: Boolean(env.anthropicApiKey),
    arkiv: Boolean(env.arkivPrivateKey),
    worldId: Boolean(env.worldAppId),
    payoutWallet: Boolean(env.backendPrivateKey),
  };
}

/** Printed once at boot so we always know what state the server is in. */
export function describeBoot(): string {
  const s = configuredSubsystems();
  const flag = (ok: boolean) => (ok ? "on " : "off");
  return [
    `mode          ${env.mockPipeline ? "MOCK (simulated pipeline)" : "LIVE"}`,
    `sepolia rpc   ${flag(s.sepoliaRpc)}`,
    `payout wallet ${flag(s.payoutWallet)}`,
    `anthropic     ${flag(s.anthropic)} (${env.anthropicModel})`,
    `arkiv         ${flag(s.arkiv)}`,
    `world id      ${flag(s.worldId)}`,
  ].join("\n  ");
}
