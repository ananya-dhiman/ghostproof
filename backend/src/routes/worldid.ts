/**
 * World ID routes (IDKit 4.x).
 *
 *   POST /world/rp-context  -> an rp_context signed with our Developer Portal
 *                              signing key, for one verification attempt.
 *   POST /verify-human      -> verify the IDKit result against World ID and
 *                              remember the nullifier.
 *
 * The browser never verifies and never sees the signing key. When World ID is
 * unconfigured we say so honestly and record the nullifier anyway, so the rest
 * of the submission flow stays testable (the UI labels that case as simulated).
 */
import { Router } from "express";
import { env } from "../env.js";
import * as store from "../store.js";
import { signRpContext, verifyWorldIdProof, worldIdConfigured } from "../worldid/verify.js";
import type { WorldIdVerifyResponse } from "../types.js";

export const worldIdRouter: Router = Router();

worldIdRouter.post("/world/rp-context", async (req, res) => {
  if (!worldIdConfigured()) {
    res.status(503).json({
      error:
        "World ID is not configured on this server (needs WORLD_APP_ID, WORLD_RP_ID and WORLD_RP_SIGNING_KEY)",
    });
    return;
  }

  const action =
    typeof (req.body as { action?: unknown })?.action === "string" &&
    (req.body as { action: string }).action
      ? (req.body as { action: string }).action
      : env.worldActionId;

  try {
    res.json(await signRpContext(action));
  } catch (err) {
    console.error("[worldid] could not sign rp_context:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "could not sign the request",
    });
  }
});

worldIdRouter.post("/verify-human", async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;

  // IDKit 4.x hands us a whole result object; accept it directly or wrapped.
  const idkitResponse = (
    typeof body.idkitResponse === "object" && body.idkitResponse
      ? body.idkitResponse
      : body
  ) as Record<string, unknown>;

  if (!worldIdConfigured()) {
    // Not configured: be honest rather than faking a pass, but still record the
    // nullifier so one-submission-per-person is demonstrable.
    const fallback =
      typeof idkitResponse.nullifier === "string"
        ? idkitResponse.nullifier
        : typeof body.nullifier_hash === "string"
          ? body.nullifier_hash
          : "";
    if (!fallback) {
      res.status(400).json({ error: "a nullifier is required" });
      return;
    }
    store.markNullifierVerified(fallback);
    const payload: WorldIdVerifyResponse = {
      verified: false,
      nullifierHash: fallback,
      alreadyUsed: store.isNullifierSpent(fallback),
      error:
        "World ID is not configured on this server yet (set WORLD_RP_ID and WORLD_RP_SIGNING_KEY)",
    };
    res.json(payload);
    return;
  }

  const outcome = await verifyWorldIdProof(idkitResponse);

  if (!outcome.success || !outcome.nullifier) {
    const payload: WorldIdVerifyResponse = {
      verified: false,
      nullifierHash:
        typeof idkitResponse.nullifier === "string" ? idkitResponse.nullifier : "",
      alreadyUsed: false,
      error: outcome.detail ?? outcome.code ?? "World ID verification failed",
    };
    console.error(
      `[worldid] verification failed: ${outcome.code ?? "?"} — ${outcome.detail ?? "?"}`,
    );
    res.status(401).json(payload);
    return;
  }

  // A real, unique human. Remember the nullifier so /submit accepts exactly one
  // submission from them and blocks any second attempt.
  store.markNullifierVerified(outcome.nullifier);
  const payload: WorldIdVerifyResponse = {
    verified: true,
    nullifierHash: outcome.nullifier,
    alreadyUsed: store.isNullifierSpent(outcome.nullifier),
  };
  res.json(payload);
});
