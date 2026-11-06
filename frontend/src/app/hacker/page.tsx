"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import type { CheckerResult } from "@shared/types";
import { Ghost, Boo } from "@/components/Ghost";
import { ConnectButton } from "@/components/ConnectButton";
import { WorldIdGate } from "@/components/WorldIdGate";
import { DemoFlag, SealedNote, SeverityTag } from "@/components/Bits";
import { fetchReport, submitExploit, type ReportView } from "@/lib/api";
import { DEMO_EXPLOIT } from "@/lib/mock";
import { BOUNTY, ruleName } from "@/lib/rules";
import { short, usd } from "@/lib/format";

type Phase = "idle" | "checking" | "done" | "error";

export default function HackerPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { address, isConnected } = useAccount();
  const [nullifier, setNullifier] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<CheckerResult | null>(null);
  const [view, setView] = useState<ReportView | null>(null);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const connected = mounted && isConnected && !!address;

  // Poll the report until the base payout + evidence report are in.
  useEffect(() => {
    if (!result?.verified) return;
    let stop = false;
    let tries = 0;
    const tick = async () => {
      const r = await fetchReport(result.reportId);
      if (stop) return;
      setView(r.data);
      const finished = r.data.record?.status && r.data.report;
      if (!finished && tries++ < 40) setTimeout(tick, 2500);
    };
    const t = setTimeout(tick, 1200);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [result]);

  async function onSubmit() {
    if (!address || !nullifier || !source.trim()) return;
    setPhase("checking");
    setError(null);
    setResult(null);
    setView(null);
    try {
      const r = await submitExploit({ source, hackerAddress: address, worldIdNullifier: nullifier });
      setResult(r.result);
      setDemo(r.demo);
      setPhase("done");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }

  async function onFile(f: File | undefined) {
    if (f) setSource(await f.text());
  }

  const paid = view?.record?.status === "base-paid" || view?.record?.status === "bonus-added";

  return (
    <div className="container page">
      <div className="section-head">
        <div className="stack" style={{ gap: 10 }}>
          <span className="kicker">For hackers</span>
          <h1 style={{ fontSize: "clamp(2.2rem, 5vw, 3.8rem)" }}>Submit a bug</h1>
          <p style={{ maxWidth: 620 }}>
            Bounty <span className="code">{BOUNTY.id}</span> · {BOUNTY.name}. Send your attack as a test. If it
            breaks one of the company&apos;s rules, you get the base reward right away.
          </p>
        </div>
        <Ghost variant="shades" size={130} rotate={8} float />
      </div>

      <div className="grid-2" style={{ alignItems: "start", gap: 32 }}>
        {/* ---------- left: the form ---------- */}
        <div className="stack" style={{ gap: 24 }}>
          <StepCard n={1} title="Connect your wallet" done={connected}>
            {connected ? (
              <p>
                Rewards go to <span className="code">{short(address, 8, 6)}</span>
              </p>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                <ConnectButton className="btn" />
                <span className="muted" style={{ fontSize: "0.85rem" }}>Use a browser wallet on Ethereum Sepolia (test network).</span>
              </div>
            )}
          </StepCard>

          <StepCard n={2} title="Prove you're a real human" done={!!nullifier} locked={!connected}>
            {nullifier ? (
              <p>
                Verified once with World ID. ID <span className="code">{short(nullifier, 8, 6)}</span>
              </p>
            ) : (
              <>
                <p style={{ marginBottom: 12 }}>One person, one submission. Stops bots and copy-paste farms.</p>
                <WorldIdGate signal={address ?? ""} disabled={!connected} onVerified={setNullifier} />
              </>
            )}
          </StepCard>

          <StepCard n={3} title="Paste your attack" locked={!nullifier} done={phase === "done"}>
            <p style={{ marginBottom: 12 }}>
              A Solidity test with <span className="code">runExploit()</span>. It runs from a fresh account with no
              permissions.
            </p>
            <div className="row" style={{ marginBottom: 12 }}>
              <button className="btn small white" onClick={() => fileRef.current?.click()} disabled={!nullifier}>
                Upload .sol
              </button>
              <button className="btn small white" onClick={() => setSource(DEMO_EXPLOIT)} disabled={!nullifier}>
                Load demo exploit
              </button>
              <input ref={fileRef} type="file" accept=".sol,text/plain" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            </div>
            <label className="label" htmlFor="src">Exploit.t.sol</label>
            <textarea
              id="src"
              className="textarea"
              placeholder="contract Exploit { function runExploit() external { … } }"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              disabled={!nullifier}
              spellCheck={false}
            />
            <div className="row" style={{ marginTop: 16, justifyContent: "space-between" }}>
              <button
                className="btn big dark"
                onClick={onSubmit}
                disabled={!nullifier || !source.trim() || phase === "checking"}
              >
                {phase === "checking" ? "Checking…" : "Submit attack →"}
              </button>
              {error && <div className="err">{error}</div>}
            </div>
          </StepCard>
        </div>

        {/* ---------- right: live status ---------- */}
        <div className="stack" style={{ gap: 24, position: "sticky", top: 96 }}>
          <div className="card hazard-top" style={{ marginTop: 14 }}>
            <div className="card-title">
              <h3>Live status</h3>
              <DemoFlag show={demo} />
            </div>

            {phase === "idle" && !result && (
              <div className="row" style={{ gap: 16, alignItems: "center" }}>
                <Ghost variant="sleepy" size={90} />
                <p className="muted">Nothing submitted yet. Your result will show up here as it happens.</p>
              </div>
            )}

            {(phase !== "idle" || result) && (
              <div className="steps">
                <TrackStep state="done" title="Submitted" body="Your test is in." />
                <TrackStep
                  state={phase === "checking" ? "active" : result ? "done" : phase === "error" ? "failed" : "todo"}
                  title="Replaying on a copy of the chain"
                  body={result ? `Ran on a fork at block ${result.forkBlock.toLocaleString()}.` : "Measuring how much money moved."}
                />
                <TrackStep
                  state={!result ? "todo" : result.verified ? "done" : "failed"}
                  title="Checking the company's rules"
                  body={
                    !result ? "Waiting for the replay." : result.verified ? (
                      <>
                        Broke <strong>{ruleName(result.ruleBroken)}</strong> · <SeverityTag severity={result.severity} /> ·{" "}
                        {usd(result.valueMovedUsdc)} moved
                      </>
                    ) : (
                      "No rule was broken, so nothing is paid. The company never sees this."
                    )
                  }
                />
                {result?.verified !== false && (
                  <TrackStep
                    state={paid ? "done" : result?.verified ? "active" : "todo"}
                    title="Base reward paid"
                    body={paid ? `${usd(view!.record!.paidUsdc)} sent to your wallet, automatically.` : "Paying from the locked pool…"}
                  />
                )}
                {result?.verified !== false && (
                  <TrackStep
                    state={view?.report ? "done" : paid ? "active" : "todo"}
                    title="Evidence report written"
                    body={view?.report ? "The company now has a plain-language write-up." : "An AI describes the bug. It never decides pay."}
                  />
                )}
              </div>
            )}

            {paid && result && (
              <div className="card yellow" style={{ marginTop: 20, display: "flex", gap: 16, alignItems: "center", boxShadow: "var(--shadow-sm)" }}>
                <Ghost variant="bag" size={80} rotate={-8} />
                <div className="stack" style={{ gap: 8 }}>
                  <strong style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem" }}>
                    +{usd(view!.record!.paidUsdc)}
                  </strong>
                  <span>Any bigger bonus is up to the company.</span>
                  <Link className="btn small dark" href={`/company?report=${result.reportId}`}>
                    View report {result.reportId}
                  </Link>
                </div>
              </div>
            )}
            {result && !result.verified && (
              <div className="row" style={{ marginTop: 16 }}>
                <Ghost variant="spooked" size={80} />
                <Boo text="no rule broken" rotate={4} />
              </div>
            )}
          </div>
          <SealedNote />
        </div>
      </div>
    </div>
  );
}

function StepCard({
  n,
  title,
  done,
  locked,
  children,
}: {
  n: number;
  title: string;
  done?: boolean;
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="card" style={{ opacity: locked ? 0.55 : 1, background: done ? "var(--white)" : "var(--paper)" }}>
      <div className="card-title" style={{ justifyContent: "flex-start" }}>
        <span className="step-dot" style={{ background: done ? "var(--black)" : "var(--yellow)", color: done ? "var(--yellow)" : "var(--black)" }}>
          {done ? "✓" : n}
        </span>
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function TrackStep({ state, title, body }: { state: "todo" | "active" | "done" | "failed"; title: string; body: React.ReactNode }) {
  return (
    <div className={`step ${state}`}>
      <div className="step-dot">{state === "done" ? "✓" : state === "failed" ? "✕" : state === "active" ? "…" : ""}</div>
      <div>
        <div className="step-title">{title}</div>
        <div className="muted" style={{ fontSize: "0.92rem" }}>{body}</div>
      </div>
    </div>
  );
}
