"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import type { HealthResponse, ReportEnvelope } from "@shared/types";
import { Ghost, Boo } from "@/components/Ghost";
import { ConnectButton } from "@/components/ConnectButton";
import { WorldIdGate } from "@/components/WorldIdGate";
import { DemoFlag, SealedNote, SeverityTag } from "@/components/Bits";
import { fetchHealth, fetchReport, submitExploit } from "@/lib/api";
import { DEMO_EXPLOIT } from "@/lib/mock";
import { BOUNTY, ruleName } from "@/lib/rules";
import { sepoliaTx } from "@/lib/chain";
import { short, usd } from "@/lib/format";

type StepState = "todo" | "active" | "done" | "failed";
// Note: "verified" is NOT final. The backend passes through it on the way to "base-paid"
// (checker done, payment pending), so we decide from the data, not the status name.
const STOPPED = new Set(["rejected", "duplicate", "error"]);
function settled(e: ReportEnvelope | null) {
  if (!e) return false;
  if (STOPPED.has(e.status) || e.status === "bonus-added") return true;
  if (e.checker && !e.checker.ruleBroken) return !!e.report; // ran, broke nothing
  return !!e.payout && !!e.report;
}

export default function HackerPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { address, isConnected } = useAccount();
  const [health, setHealth] = useState<HealthResponse | null | undefined>(undefined);
  const [nullifier, setNullifier] = useState<string | null>(null);
  const [simulatedId, setSimulatedId] = useState(false);
  const [source, setSource] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [env, setEnv] = useState<ReportEnvelope | null>(null);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const connected = mounted && isConnected && !!address;

  useEffect(() => {
    fetchHealth().then(setHealth);
  }, []);

  // Poll GET /report/:id every 2s until it settles (and the AI report has arrived).
  useEffect(() => {
    if (!reportId) return;
    let stop = false;
    let tries = 0;
    setPolling(true);
    const tick = async () => {
      const r = await fetchReport(reportId);
      if (stop) return;
      if (r.data) setEnv(r.data);
      if (!settled(r.data) && tries++ < 120) setTimeout(tick, 2000);
      else setPolling(false);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [reportId]);

  async function onSubmit() {
    if (!address || !nullifier || !source.trim()) return;
    setSubmitting(true);
    setError(null);
    setEnv(null);
    setReportId(null);
    try {
      const r = await submitExploit({ bountyId: BOUNTY.id, hackerAddress: address, worldIdNullifier: nullifier, exploitSource: source });
      setDemo(r.demo);
      setReportId(r.reportId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onFile(f: File | undefined) {
    if (f) setSource(await f.text());
  }

  const s = env?.status;
  const c = env?.checker;
  const stopped = STOPPED.has(s ?? "");
  const noRule = !!c && !c.ruleBroken;
  const payoutStuck = !!c?.ruleBroken && !env?.payout && !polling;
  const replay: StepState = !reportId ? "todo" : c ? "done" : stopped ? "failed" : "active";
  const rule: StepState = !c ? (stopped ? "failed" : "todo") : c.ruleBroken ? "done" : "failed";
  const paid: StepState = env?.payout ? "done" : payoutStuck ? "failed" : c?.ruleBroken && !stopped ? "active" : "todo";
  const report: StepState = env?.report ? "done" : env?.payout ? "active" : "todo";

  return (
    <div className="container page">
      <div className="section-head">
        <div className="stack" style={{ gap: 10 }}>
          <span className="kicker">For hackers</span>
          <h1 style={{ fontSize: "clamp(2.2rem, 5vw, 3.8rem)" }}>Submit a bug</h1>
          <p style={{ maxWidth: 620 }}>
            Bounty <span className="code">{BOUNTY.id}</span> · {BOUNTY.name}. Send your attack as a test. If it
            breaks one of the company&apos;s rules, you get the base reward right away, on-chain.
          </p>
        </div>
        <Ghost variant="shades" size={130} rotate={8} float />
      </div>

      {health === null && (
        <div className="callout" style={{ marginBottom: 24 }}>
          <Ghost variant="spooked" size={50} />
          <div>
            <strong>The checker is offline.</strong> Submissions will run as a clearly marked offline demo until it&apos;s back.
          </div>
        </div>
      )}

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
                {simulatedId ? "Simulated World ID check." : "Verified once with World ID."} ID{" "}
                <span className="code">{short(nullifier, 8, 6)}</span>
              </p>
            ) : (
              <>
                <p style={{ marginBottom: 12 }}>One person, one submission. Stops bots and copy-paste farms.</p>
                <WorldIdGate
                  backendWorldId={!!health?.subsystems.worldId}
                  disabled={!connected}
                  onVerified={(n, sim) => {
                    setNullifier(n);
                    setSimulatedId(sim);
                  }}
                />
              </>
            )}
          </StepCard>

          <StepCard n={3} title="Paste your attack" locked={!nullifier} done={!!reportId}>
            <p style={{ marginBottom: 12 }}>
              A Solidity contract with <span className="code">function run(VulnerableVault vault) external</span>. Import
              the target as <span className="code">target/VulnerableVault.sol</span>. It runs from a fresh account with no
              permissions.
            </p>
            <div className="row" style={{ marginBottom: 12 }}>
              <button className="btn small raised" onClick={() => fileRef.current?.click()} disabled={!nullifier}>
                Upload .sol
              </button>
              <button className="btn small raised" onClick={() => setSource(DEMO_EXPLOIT)} disabled={!nullifier}>
                Load demo exploit
              </button>
              <input ref={fileRef} type="file" accept=".sol,text/plain" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            </div>
            <label className="label" htmlFor="src">Exploit.sol</label>
            <textarea
              id="src"
              className="textarea"
              placeholder="contract Exploit { function run(VulnerableVault vault) external { … } }"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              disabled={!nullifier}
              spellCheck={false}
            />
            <div className="row" style={{ marginTop: 16, justifyContent: "space-between" }}>
              <button
                className="btn big accent"
                onClick={onSubmit}
                disabled={!nullifier || !source.trim() || submitting || polling}
              >
                {submitting ? "Sending…" : "Submit attack →"}
              </button>
            </div>
            {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}
          </StepCard>
        </div>

        {/* ---------- right: live status ---------- */}
        <div className="stack" style={{ gap: 24, position: "sticky", top: 96 }}>
          <div className="card hazard-top" style={{ marginTop: 14 }}>
            <div className="card-title">
              <h3>Live status</h3>
              <div className="row" style={{ gap: 6 }}>
                {reportId && <span className="tag flat mono">{reportId}</span>}
                <DemoFlag show={demo} />
              </div>
            </div>

            {!reportId ? (
              <div className="row" style={{ gap: 16, alignItems: "center" }}>
                <Ghost variant="sleepy" size={90} />
                <p className="muted">Nothing submitted yet. Your result will show up here as it happens.</p>
              </div>
            ) : (
              <div className="steps">
                <TrackStep state="done" title="Submitted" body="Your test is in the queue." />
                <TrackStep
                  state={replay}
                  title="Replaying on a copy of the chain"
                  body={
                    c ? `Ran on a copy of Sepolia at block ${c.forkBlock.toLocaleString()}. ${usd(c.valueMovedUsdc)} moved.`
                    : stopped ? env?.error ?? "Stopped."
                    : "Measuring how much money moves. This can take up to a minute."
                  }
                />
                <TrackStep
                  state={rule}
                  title="Checking the company's rules"
                  body={
                    !c ? (stopped ? "Didn't get this far." : "Waiting for the replay.")
                    : c.ruleBroken ? (
                      <>
                        Broke <strong>{ruleName(c.ruleBroken)}</strong> · <SeverityTag severity={c.severity} />
                      </>
                    ) : (
                      "No rule was broken, so nothing is paid automatically."
                    )
                  }
                />
                {!noRule && !stopped && (
                  <>
                    <TrackStep
                      state={paid}
                      title="Base reward paid"
                      body={
                        env?.payout ? (
                          <>
                            {usd(env.payout.paidUsdc)} sent to your wallet.{" "}
                            {!demo && (
                              <a href={sepoliaTx(env.payout.txHash)} target="_blank" rel="noreferrer">See the transaction</a>
                            )}
                          </>
                        ) : payoutStuck ? (
                          "The rule broke, but the payment hasn't gone through yet. The finding is saved; the team will pay it."
                        ) : (
                          "Paying from the locked pool on Sepolia…"
                        )
                      }
                    />
                    <TrackStep
                      state={report}
                      title="Evidence report written"
                      body={
                        env?.report
                          ? env.report.fallback ? "Written (from a prepared template; the live AI was unavailable)." : "Written. The company now has a plain-language summary."
                          : "An AI describes the bug. It never decides the pay."
                      }
                    />
                  </>
                )}
              </div>
            )}

            {env?.payout && (
              <div className="card accent" style={{ marginTop: 20, display: "flex", gap: 16, alignItems: "center", boxShadow: "var(--shadow-sm)" }}>
                <Ghost variant="bag" size={80} rotate={-8} />
                <div className="stack" style={{ gap: 8 }}>
                  <strong style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem" }}>+{usd(env.payout.paidUsdc)}</strong>
                  <span>Paid automatically. Any bigger bonus is up to the company.</span>
                  <Link className="btn small" href={`/company?report=${env.reportId}`}>
                    See what the company sees
                  </Link>
                </div>
              </div>
            )}
            {(stopped || noRule) && (
              <div className="row" style={{ marginTop: 16 }}>
                <Ghost variant="spooked" size={80} />
                <Boo text={s === "duplicate" ? "already found!" : noRule ? "no rule broken" : "not accepted"} rotate={4} />
              </div>
            )}
          </div>
          <SealedNote />
        </div>
      </div>
    </div>
  );
}

function StepCard({ n, title, done, locked, children }: { n: number; title: string; done?: boolean; locked?: boolean; children: React.ReactNode }) {
  return (
    <section className="card" style={{ opacity: locked ? 0.55 : 1, background: done ? "var(--raised)" : "var(--surface)" }}>
      <div className="card-title" style={{ justifyContent: "flex-start" }}>
        <span className="step-dot" style={{ background: done ? "var(--ink)" : "var(--base)", color: done ? "var(--base)" : "var(--ink)" }}>
          {done ? "✓" : n}
        </span>
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function TrackStep({ state, title, body }: { state: StepState; title: string; body: React.ReactNode }) {
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
