/**
 * GET /health — which parts of the system are actually live right now.
 *
 * Worth having in a 15-hour build: when something stops working at hour 12,
 * this answers "is it my code or is it the key?" in one request.
 */
import { Router } from "express";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { configuredSubsystems, env } from "../env.js";
import type { HealthResponse } from "../types.js";

const run = promisify(execFile);

export const healthRouter: Router = Router();

let foundryAvailable: boolean | null = null;

/** Same resolution the checker uses, so the probe can't disagree with it. */
function forgeBin(): string {
  return (
    process.env.FORGE_BIN || path.join(os.homedir(), ".foundry", "bin", "forge.exe")
  );
}

async function probeFoundry(): Promise<boolean> {
  if (foundryAvailable !== null) return foundryAvailable;
  try {
    // PATH alone is not enough: the server is usually started from a shell
    // without the foundry bin on it, while the checker falls back to
    // foundryup's default location. Reporting foundry:false while the checker
    // can actually run is worse than no probe at all.
    await run(forgeBin(), ["--version"], { timeout: 5000, windowsHide: true });
    foundryAvailable = true;
  } catch {
    foundryAvailable = false;
  }
  return foundryAvailable;
}

healthRouter.get("/health", async (_req, res) => {
  const configured = configuredSubsystems();
  const foundry = await probeFoundry();

  const payload: HealthResponse = {
    ok: true,
    mode: env.mockPipeline ? "mock" : "live",
    subsystems: { foundry, ...configured },
  };
  res.json(payload);
});
