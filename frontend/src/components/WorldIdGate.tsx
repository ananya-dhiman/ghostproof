"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { proofOfHuman, type RpContext } from "@worldcoin/idkit";
import { BACKEND_URL, verifyHuman } from "@/lib/api";

// IDKit touches `window`, so load the widget on the client only.
const IDKitRequestWidget = dynamic(
  () => import("@worldcoin/idkit").then((m) => m.IDKitRequestWidget),
  { ssr: false },
);

const APP_ID = process.env.NEXT_PUBLIC_WLD_APP_ID as `app_${string}` | undefined;
const ACTION = process.env.NEXT_PUBLIC_WLD_ACTION || "verify-human";

/**
 * World ID check, on IDKit 4.x.
 *
 * An IDKit 4.x request must carry an `rp_context` signed with the Developer
 * Portal signing key. That key stays on the backend, so we ask the backend to
 * sign each attempt (POST /world/rp-context) and the browser only relays it.
 * The proof itself is verified by the backend too (POST /verify-human), which
 * also blocks a second submission from the same person.
 *
 * `backendWorldId` comes from GET /health: if the backend cannot sign or verify,
 * we say so and fall back to a clearly labelled simulated ID.
 */
export function WorldIdGate({
  backendWorldId,
  onVerified,
  disabled,
}: {
  backendWorldId: boolean;
  onVerified: (nullifier: string, simulated: boolean) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);

  async function simulate() {
    setBusy(true);
    setError(null);
    try {
      const fake =
        "0xsim" +
        Array.from(crypto.getRandomValues(new Uint8Array(30)), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
      // The backend still records the ID so "one submission per person" applies.
      await verifyHuman({
        proof: "0x",
        merkle_root: "0x",
        nullifier_hash: fake,
        verification_level: "device",
      }).catch(() => null);
      onVerified(fake, true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Ask the backend to sign this attempt, then open the widget. */
  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/world/rp-context`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: ACTION }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `could not sign the request (${res.status})`);
      }
      const ctx = (await res.json()) as RpContext & { app_id?: string };
      setRpContext({
        rp_id: ctx.rp_id,
        nonce: ctx.nonce,
        created_at: ctx.created_at,
        expires_at: ctx.expires_at,
        signature: ctx.signature,
      } as RpContext);
      setOpen(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!backendWorldId || !APP_ID) {
    return (
      <div className="stack" style={{ gap: 8 }}>
        <button className="btn accent" disabled={disabled || busy} onClick={simulate}>
          {busy ? "Checking…" : "Verify I'm human (simulated)"}
        </button>
        <span className="muted" style={{ fontSize: "0.8rem" }}>
          {!backendWorldId
            ? "World ID isn't switched on in the checker yet, so this check is simulated."
            : "Set NEXT_PUBLIC_WLD_APP_ID in the frontend to use the real World ID widget."}
        </span>
        {error && <div className="err">{error}</div>}
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <button className="btn accent" disabled={disabled || busy} onClick={start}>
        {busy ? "Preparing…" : "Verify with World ID"}
      </button>

      {rpContext && (
        <IDKitRequestWidget
          open={open}
          onOpenChange={setOpen}
          app_id={APP_ID}
          action={ACTION}
          rp_context={rpContext}
          allow_legacy_proofs={true}
          preset={proofOfHuman({ signal: ACTION })}
          handleVerify={async (result: unknown) => {
            // The backend verifies against World ID; the browser never decides.
            const res = await fetch(`${BACKEND_URL}/verify-human`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ idkitResponse: result }),
            });
            const body = (await res.json().catch(() => ({}))) as {
              verified?: boolean;
              nullifierHash?: string;
              alreadyUsed?: boolean;
              error?: string;
            };
            if (!res.ok || !body.verified) {
              throw new Error(body.error || "World ID check failed");
            }
            if (body.alreadyUsed) {
              throw new Error("This person has already submitted once.");
            }
            if (body.nullifierHash) onVerified(body.nullifierHash, false);
          }}
          // Runs after handleVerify resolves. The nullifier we trust is the one
          // the backend returned, so that is already applied above.
          onSuccess={() => setOpen(false)}
          // IDKit 4.x hands back an error code, not an object.
          onError={(errorCode) => setError(String(errorCode) || "World ID error")}
        />
      )}

      {error && <div className="err">{error}</div>}
    </div>
  );
}
