import { NextResponse } from "next/server";
import { verifyCloudProof } from "@worldcoin/idkit-core/backend";
import type { ISuccessResult } from "@worldcoin/idkit";
import { randomBytes } from "node:crypto";
import { store } from "@/lib/server/store";

const APP_ID = process.env.NEXT_PUBLIC_WLD_APP_ID as `app_${string}` | undefined;
const ACTION = process.env.NEXT_PUBLIC_WLD_ACTION || "verify-human";

// World ID proofs are checked HERE on the server, never trusted from the browser.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as (Partial<ISuccessResult> & { demo?: boolean; signal?: string }) | null;
  if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  if (body.demo) {
    if (APP_ID) return NextResponse.json({ error: "Simulated check is off: World ID is configured." }, { status: 403 });
    // Fresh fake nullifier each time so the demo can be rehearsed.
    const nullifier = "0xdemo" + randomBytes(30).toString("hex");
    store.verified.add(nullifier);
    return NextResponse.json({ nullifier, simulated: true });
  }

  if (!APP_ID) return NextResponse.json({ error: "World ID is not configured on the server." }, { status: 500 });
  if (!body.proof || !body.merkle_root || !body.nullifier_hash || !body.verification_level) {
    return NextResponse.json({ error: "Missing World ID proof fields." }, { status: 400 });
  }

  const proof: ISuccessResult = {
    proof: body.proof,
    merkle_root: body.merkle_root,
    nullifier_hash: body.nullifier_hash,
    verification_level: body.verification_level,
  };
  const res = await verifyCloudProof(proof, APP_ID, ACTION, body.signal);
  if (!res.success) {
    return NextResponse.json({ error: res.detail || res.code || "World ID verification failed." }, { status: 400 });
  }
  store.verified.add(proof.nullifier_hash);
  return NextResponse.json({ nullifier: proof.nullifier_hash });
}
