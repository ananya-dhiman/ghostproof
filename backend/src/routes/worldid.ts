/**
 * POST /verify-human — World ID proof verification.
 *
 * Verification happens HERE, never in the browser: a client-side check proves
 * nothing, since anyone can call our API directly. Person C owns the IDKit
 * widget and forwards us what it produces.
 *
 * Until B7 wires `verifyCloudProof` up, this accepts the proof and records the
 * nullifier so the submission flow is testable end to end. It reports
 * `verified: true` only once the real check is in place — with no WORLD_APP_ID
 * configured it says so plainly rather than pretending.
 */
import { Router } from "express";
import { env } from "../env.js";
import * as store from "../store.js";
import type { WorldIdProofRequest, WorldIdVerifyResponse } from "../types.js";

export const worldIdRouter: Router = Router();

worldIdRouter.post("/verify-human", async (req, res) => {
  const body = req.body as Partial<WorldIdProofRequest> | undefined;
  const nullifier = body?.nullifier_hash;

  if (typeof nullifier !== "string" || !nullifier) {
    res.status(400).json({ error: "nullifier_hash is required" });
    return;
  }

  if (!env.worldAppId) {
    // Not configured yet: be honest about it rather than returning a fake pass.
    store.markNullifierVerified(nullifier);
    const payload: WorldIdVerifyResponse = {
      verified: false,
      nullifierHash: nullifier,
      alreadyUsed: store.isNullifierSpent(nullifier),
      error: "World ID is not configured on this server yet (B7)",
    };
    res.json(payload);
    return;
  }

  // TODO(B7): verifyCloudProof(proof, app_id, action, signal) against the
  // World ID Simulator, then mark verified only on a real pass.
  store.markNullifierVerified(nullifier);
  const payload: WorldIdVerifyResponse = {
    verified: true,
    nullifierHash: nullifier,
    alreadyUsed: store.isNullifierSpent(nullifier),
  };
  res.json(payload);
});
