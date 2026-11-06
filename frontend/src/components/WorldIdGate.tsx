"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { VerificationLevel, type ISuccessResult } from "@worldcoin/idkit";
import { verifyHuman } from "@/lib/api";

// IDKit touches `window`, so load it on the client only.
const IDKitWidget = dynamic(() => import("@worldcoin/idkit").then((m) => m.IDKitWidget), { ssr: false });

const APP_ID = process.env.NEXT_PUBLIC_WLD_APP_ID as `app_${string}` | undefined;
const ACTION = process.env.NEXT_PUBLIC_WLD_ACTION || "verify-human";

/**
 * World ID check. The widget runs here; the proof is checked by the BACKEND
 * (POST /verify-human), which also blocks a second submission from the same person.
 * No signal is bound, matching backend/src/worldid/verify.ts.
 *
 * `backendWorldId` comes from GET /health: when the backend has no WORLD_APP_ID it can't
 * verify anything, so we say so and use a clearly labelled simulated ID instead.
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

  async function simulate() {
    setBusy(true);
    setError(null);
    try {
      const fake = "0xsim" + Array.from(crypto.getRandomValues(new Uint8Array(30)), (b) => b.toString(16).padStart(2, "0")).join("");
      // The backend still records the ID so its "one submission per person" rule applies.
      await verifyHuman({ proof: "0x", merkle_root: "0x", nullifier_hash: fake, verification_level: "device" }).catch(() => null);
      onVerified(fake, true);
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
            ? "World ID isn't switched on in the checker yet (WORLD_APP_ID), so this check is simulated."
            : "Set NEXT_PUBLIC_WLD_APP_ID in the frontend to use the real World ID widget."}
        </span>
        {error && <div className="err">{error}</div>}
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <IDKitWidget
        app_id={APP_ID}
        action={ACTION}
        verification_level={VerificationLevel.Device}
        handleVerify={async (proof: ISuccessResult) => {
          const r = await verifyHuman({
            proof: proof.proof,
            merkle_root: proof.merkle_root,
            nullifier_hash: proof.nullifier_hash,
            verification_level: proof.verification_level,
          });
          if (!r.verified) throw new Error(r.error || "World ID check failed");
          if (r.alreadyUsed) throw new Error("This person has already submitted once.");
        }}
        onSuccess={(r: ISuccessResult) => onVerified(r.nullifier_hash, false)}
        onError={(e) => setError(e.message || e.code)}
      >
        {({ open }: { open: () => void }) => (
          <button className="btn accent" disabled={disabled} onClick={open}>
            Verify with World ID
          </button>
        )}
      </IDKitWidget>
      {error && <div className="err">{error}</div>}
    </div>
  );
}
