/**
 * GET /health — which parts of the system are actually live right now.
 *
 * Worth having in a 15-hour build: when something stops working at hour 12,
 * this answers "is it my code or is it the key?" in one request.
 */
import { Router } from "express";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { configuredSubsystems, env } from "../env.js";
import type { HealthResponse } from "../types.js";

const run = promisify(execFile);

export const healthRouter: Router = Router();

let foundryAvailable: boolean | null = null;

async function probeFoundry(): Promise<boolean> {
  if (foundryAvailable !== null) return foundryAvailable;
  try {
    await run("forge", ["--version"], { timeout: 5000, windowsHide: true });
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
