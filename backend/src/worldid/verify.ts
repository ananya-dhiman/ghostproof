/**
 * B7 — World ID proof verification, backend-owned.
 *
 * We verify the proof against World ID's cloud endpoint ourselves, so the
 * browser is never trusted. This is a direct call to the documented v2 verify
 * API — the same thing the `verifyCloudProof` helper wraps — which keeps us
 * independent of the churny IDKit SDK packages.
 *
 *   POST https://developer.worldcoin.org/api/v2/verify/{app_id}
 *   body: { nullifier_hash, merkle_root, proof, verification_level, action }
 *   200 { success: true, ... }           -> a real, unique human
 *   400 { code, detail, attribute, ... }  -> invalid / already used / wrong action
 *
 * No signal is bound to the action; the frontend's IDKit widget must also use
 * no signal for `verify-human` so the proofs match.
 */
import { env } from "../env.js";
import type { WorldIdProofRequest } from "../types.js";

export interface WorldIdVerifyOutcome {
  success: boolean;
  /** World ID error code on failure, e.g. "max_verifications_reached". */
  code?: string;
  detail?: string;
}

const VERIFY_BASE =
  process.env.WORLD_VERIFY_URL?.trim() || "https://developer.worldcoin.org";

export async function verifyWorldIdProof(
  payload: WorldIdProofRequest,
): Promise<WorldIdVerifyOutcome> {
  const url = `${VERIFY_BASE}/api/v2/verify/${encodeURIComponent(env.worldAppId)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nullifier_hash: payload.nullifier_hash,
        merkle_root: payload.merkle_root,
        proof: payload.proof,
        verification_level: payload.verification_level,
        action: env.worldActionId,
      }),
      signal: controller.signal,
    });

    const body = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      code?: string;
      detail?: string;
    };

    if (res.ok && body.success) return { success: true };
    return {
      success: false,
      code: body.code ?? `http_${res.status}`,
      detail: body.detail ?? "World ID rejected the proof",
    };
  } catch (err) {
    return {
      success: false,
      code: "verify_unreachable",
      detail: err instanceof Error ? err.message : "World ID verify call failed",
    };
  } finally {
    clearTimeout(timer);
  }
}
