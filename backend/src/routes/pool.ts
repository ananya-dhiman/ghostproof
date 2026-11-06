/**
 * GET /pool — the company's pool configuration and balance, for the company
 * screen (pool balance, auto-pay limit, monthly cap, tiers).
 *
 * Reads A's BountyPool on Sepolia. Until the contracts are deployed it returns
 * `deployed: false` so the frontend shows demo numbers instead of erroring.
 */
import { Router } from "express";
import { addressesDeployed } from "../chain/clients.js";
import { readPool } from "../chain/reads.js";
import { env } from "../env.js";

export const poolRouter: Router = Router();

poolRouter.get("/pool", async (_req, res) => {
  if (!addressesDeployed() || !env.sepoliaRpcUrl) {
    res.json({
      deployed: false,
      reason: !env.sepoliaRpcUrl
        ? "SEPOLIA_RPC_URL not set"
        : "contracts not deployed yet",
    });
    return;
  }
  try {
    const pool = await readPool();
    res.json({ deployed: true, ...pool });
  } catch (err) {
    console.error("[pool] read failed:", err);
    res.status(502).json({ deployed: false, reason: "pool read failed" });
  }
});
