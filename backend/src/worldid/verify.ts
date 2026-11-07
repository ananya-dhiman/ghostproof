/**
 * B7 — World ID, on IDKit 4.x.
 *
 * Two backend jobs, and both must stay on the backend:
 *
 *  1. SIGN THE REQUEST. An IDKit 4.x request carries an `rp_context` signed with
 *     the Developer Portal signing key. The key never goes to the browser, so the
 *     frontend asks us for a signature per attempt.
 *
 *  2. VERIFY THE PROOF. We forward the *complete* IDKit result to
 *     POST https://developer.world.org/api/v4/verify/{rp_id} without remapping
 *     any fields, and we check `environment` both before sending and in the
 *     reply — a staging proof must never pass in production.
 *
 * Why not the old v2 /verify/{app_id}: that flow needed an Incognito Action
 * registered in the portal, which IDKit 4.x apps do not have. `action` is now a
 * free string that scopes uniqueness, carried inside the signature.
 */
import { env } from "../env.js";

const VERIFY_BASE =
  process.env.WORLD_VERIFY_URL?.trim() || "https://developer.world.org";

export interface RpContextPayload {
  rp_id: string;
  app_id: string;
  action: string;
  nonce: string;
  created_at: number;
  expires_at: number;
  signature: string;
  environment: string;
}

export interface WorldIdVerifyOutcome {
  success: boolean;
  /** The nullifier that identifies this human for this action. */
  nullifier?: string;
  code?: string;
  detail?: string;
}

export function worldIdConfigured(): boolean {
  return Boolean(env.worldAppId && env.worldRpId && env.worldRpSigningKey);
}

/**
 * Sign an rp_context for one verification attempt. Loaded dynamically so the
 * backend still boots if the SDK is absent or World ID is unconfigured.
 */
export async function signRpContext(action: string): Promise<RpContextPayload> {
  const { signRequest } = await import("@worldcoin/idkit-core/signing");

  const signed = signRequest({
    signingKeyHex: env.worldRpSigningKey,
    action,
  }) as {
    sig: string;
    nonce: string;
    createdAt: number;
    expiresAt: number;
  };

  return {
    rp_id: env.worldRpId,
    app_id: env.worldAppId,
    action,
    nonce: signed.nonce,
    created_at: signed.createdAt,
    expires_at: signed.expiresAt,
    signature: signed.sig,
    environment: env.worldEnvironment,
  };
}

/**
 * Verify an IDKit 4.x result. `idkitResponse` is passed through untouched —
 * the docs are explicit that remapping identifiers or rebuilding a legacy
 * verification_level breaks verification.
 */
export async function verifyWorldIdProof(
  idkitResponse: Record<string, unknown>,
): Promise<WorldIdVerifyOutcome> {
  const expected = env.worldEnvironment;

  // Reject a proof from the wrong environment before we send it anywhere.
  const got = idkitResponse?.environment;
  if (typeof got === "string" && got !== expected) {
    return {
      success: false,
      code: "wrong_environment",
      detail: `proof was created for "${got}" but this server expects "${expected}"`,
    };
  }

  const url = `${VERIFY_BASE}/api/v4/verify/${encodeURIComponent(env.worldRpId)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...idkitResponse, environment: expected }),
      signal: controller.signal,
    });

    const body = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      environment?: string;
      nullifier?: string;
      code?: string;
      detail?: string;
      message?: string;
      results?: { nullifier?: string; success?: boolean; detail?: string }[];
    };

    if (!res.ok || body.success !== true) {
      return {
        success: false,
        code: body.code ?? `http_${res.status}`,
        detail:
          body.detail ??
          body.message ??
          body.results?.find((r) => r.success === false)?.detail ??
          "World ID rejected the proof",
      };
    }

    if (body.environment !== expected) {
      return {
        success: false,
        code: "wrong_environment",
        detail: `World ID verified against "${body.environment}", expected "${expected}"`,
      };
    }

    const nullifier = body.nullifier ?? body.results?.[0]?.nullifier;
    if (!nullifier) {
      return { success: false, code: "no_nullifier", detail: "verified but no nullifier returned" };
    }

    return { success: true, nullifier };
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
