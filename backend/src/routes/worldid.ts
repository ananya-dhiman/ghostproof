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
import { verifyWorldIdProof } from "../worldid/verify.js";

export const worldIdRouter: Router = Router();

worldIdRouter.post("/verify-human", async (req, res) => {
  const body = req.body as Partial<WorldIdProofRequest> | undefined;
  const nullifier = body?.nullifier_hash;

  if (typeof nullifier !== "string" || !nullifier) {
    res.status(400).json({ error: "nullifier_hash is required" });
    return;
  }

  if (!env.worldAppId) {
    // Not configured yet: be honest rather than returning a fake pass. We still
    // record the nullifier so the submission flow is testable before the App ID
    // is set — real verification turns on the moment WORLD_APP_ID lands in .env.
    store.markNullifierVerified(nullifier);
    const payload: WorldIdVerifyResponse = {
      verified: false,
      nullifierHash: nullifier,
      alreadyUsed: store.isNullifierSpent(nullifier),
      error: "World ID is not configured on this server yet (set WORLD_APP_ID)",
    };
    res.json(payload);
    return;
  }

  // Need the full proof to verify against World ID's cloud endpoint.
  if (!body?.proof || !body.merkle_root || !body.verification_level) {
    res.status(400).json({
      error: "proof, merkle_root, nullifier_hash and verification_level are required",
    });
    return;
  }

  const outcome = await verifyWorldIdProof(body as WorldIdProofRequest);

  if (!outcome.success) {
    const payload: WorldIdVerifyResponse = {
      verified: false,
      nullifierHash: nullifier,
      alreadyUsed: store.isNullifierSpent(nullifier),
      error: outcome.detail ?? outcome.code ?? "World ID verification failed",
    };
    res.status(401).json(payload);
    return;
  }

  // Real, unique human. Remember the nullifier so /submit will accept one
  // submission from it and block any second attempt.
  store.markNullifierVerified(nullifier);
  const payload: WorldIdVerifyResponse = {
    verified: true,
    nullifierHash: nullifier,
    alreadyUsed: store.isNullifierSpent(nullifier),
  };
  res.json(payload);
});
