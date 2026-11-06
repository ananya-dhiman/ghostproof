"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { VerificationLevel, type ISuccessResult } from "@worldcoin/idkit";
import { verifyWorldId } from "@/lib/api";

// IDKit touches `window`, so load it on the client only.
const IDKitWidget = dynamic(() => import("@worldcoin/idkit").then((m) => m.IDKitWidget), { ssr: false });

const APP_ID = process.env.NEXT_PUBLIC_WLD_APP_ID as `app_${string}` | undefined;
const ACTION = process.env.NEXT_PUBLIC_WLD_ACTION || "verify-human";

export function WorldIdGate({
  signal,
  onVerified,
  disabled,
}: {
  signal: string;
  onVerified: (nullifier: string) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!APP_ID) {
    // No World ID app configured: the server accepts a clearly-labelled simulated check.
    return (
      <div className="stack" style={{ gap: 8 }}>
        <button
          className="btn dark"
          disabled={disabled || busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const { nullifier } = await verifyWorldId({ demo: true, signal });
              onVerified(nullifier);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Checking…" : "Verify I'm human (simulated)"}
        </button>
        <span className="muted" style={{ fontSize: "0.8rem" }}>
          World ID app not configured, so this is a simulated check. Set NEXT_PUBLIC_WLD_APP_ID to use the real one.
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
        signal={signal}
        verification_level={VerificationLevel.Device}
        handleVerify={async (proof: ISuccessResult) => {
          // Proof is checked on the server (verifyCloudProof), never trusted in the browser.
          await verifyWorldId({ ...proof, signal });
        }}
        onSuccess={(r: ISuccessResult) => onVerified(r.nullifier_hash)}
        onError={(e) => setError(e.message || e.code)}
      >
        {({ open }: { open: () => void }) => (
          <button className="btn dark" disabled={disabled} onClick={open}>
            Verify with World ID
          </button>
        )}
      </IDKitWidget>
      {error && <div className="err">{error}</div>}
    </div>
  );
}
