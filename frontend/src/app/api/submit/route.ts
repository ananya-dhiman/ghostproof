import { NextResponse } from "next/server";
import type { CheckerResult, Submission } from "@shared/types";
import { store } from "@/lib/server/store";
import { mockResult } from "@/lib/mock";
import { BOUNTY } from "@/lib/rules";

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");
const MAX_SOURCE = 100_000;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { source?: string; hackerAddress?: string; worldIdNullifier?: string } | null;
  const source = body?.source?.trim();
  const hackerAddress = body?.hackerAddress;
  const nullifier = body?.worldIdNullifier;

  if (!source || !hackerAddress || !nullifier) {
    return NextResponse.json({ error: "Need the exploit source, your wallet address and a World ID check." }, { status: 400 });
  }
  if (source.length > MAX_SOURCE) return NextResponse.json({ error: "Exploit file is too big." }, { status: 413 });
  if (!/^0x[0-9a-fA-F]{40}$/.test(hackerAddress)) return NextResponse.json({ error: "Bad wallet address." }, { status: 400 });
  if (!store.verified.has(nullifier)) {
    return NextResponse.json({ error: "Verify with World ID first." }, { status: 403 });
  }
  if (store.used.has(nullifier)) {
    return NextResponse.json({ error: "This human already submitted. One person, one submission." }, { status: 409 });
  }

  const metadata: Submission = { bountyId: BOUNTY.id, hackerAddress, worldIdNullifier: nullifier };

  // No backend configured: simulate the checker so the screens can be demoed alone.
  if (!BACKEND_URL) {
    await new Promise((r) => setTimeout(r, 2500));
    store.used.add(nullifier);
    const id = `rep_${Date.now().toString(36)}`;
    return NextResponse.json({ result: mockResult(id), demo: true });
  }

  // TODO(B): confirm the /submit format. We send multipart: file "exploit" + field "metadata" (JSON).
  const form = new FormData();
  form.append("exploit", new Blob([source], { type: "text/plain" }), "Exploit.t.sol");
  form.append("metadata", JSON.stringify(metadata));

  try {
    const res = await fetch(`${BACKEND_URL}/submit`, { method: "POST", body: form });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ error: raw?.error || `Checker returned HTTP ${res.status}` }, { status: 502 });
    const result = ("result" in raw ? raw.result : raw) as CheckerResult;
    store.used.add(nullifier);
    return NextResponse.json({ result, demo: false });
  } catch (e) {
    return NextResponse.json({ error: `Could not reach the checker: ${(e as Error).message}` }, { status: 502 });
  }
}
