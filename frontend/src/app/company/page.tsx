"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { parseUnits } from "viem";
import type { ReportEnvelope, SeverityName } from "@shared/types";
import { Ghost } from "@/components/Ghost";
import { ConnectButton } from "@/components/ConnectButton";
import { DemoFlag, SealedNote, SeverityTag, Stat, StatusTag } from "@/components/Bits";
import { fetchReports } from "@/lib/api";
import { BOUNTY, DEMO_POOL, RULES, ruleName } from "@/lib/rules";
import {
  COMPANY_WALLET,
  POOL_ADDRESS,
  USDC_ADDRESS,
  USDC_DECIMALS,
  bountyPoolAbi,
  erc20Abi,
  reportIdToBytes32,
  sepoliaAddr,
  sepoliaTx,
  toUsdc,
} from "@/lib/chain";
import { short, timeAgo, usd } from "@/lib/format";

export default function CompanyPage() {
  return (
    <Suspense>
      <Company />
    </Suspense>
  );
}

/** Pool numbers read straight from the deployed BountyPool on Sepolia. */
function usePool() {
  const bal = useReadContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [POOL_ADDRESS], query: { refetchInterval: 10000 } });
  const cfg = useReadContract({ address: POOL_ADDRESS, abi: bountyPoolAbi, functionName: "getConfig" });
  const paid = useReadContract({ address: POOL_ADDRESS, abi: bountyPoolAbi, functionName: "paidThisMonth", query: { refetchInterval: 10000 } });
  const live = bal.data !== undefined && cfg.data !== undefined;
  const c = cfg.data;
  return {
    live,
    loading: bal.isLoading || cfg.isLoading,
    balance: live ? toUsdc(bal.data)! : DEMO_POOL.balance,
    limit: c ? toUsdc(c[0])! : DEMO_POOL.limit,
    monthlyCap: c ? toUsdc(c[1])! : DEMO_POOL.monthlyCap,
    tiers: {
      medium: c ? toUsdc(c[2])! : DEMO_POOL.medium,
      high: c ? toUsdc(c[3])! : DEMO_POOL.high,
      critical: c ? toUsdc(c[4])! : DEMO_POOL.critical,
    } as Record<SeverityName, number>,
    paidThisMonth: toUsdc(paid.data),
    refetch: () => {
      bal.refetch();
      paid.refetch();
    },
  };
}
type Pool = ReturnType<typeof usePool>;

function Company() {
  const params = useSearchParams();
  const pool = usePool();
  const [reports, setReports] = useState<ReportEnvelope[] | null>(null);
  const [demo, setDemo] = useState<{ on: boolean; error?: string }>({ on: false });
  const [selected, setSelected] = useState<string | null>(params.get("report"));

  useEffect(() => {
    const load = () =>
      fetchReports().then((r) => {
        setReports(r.data);
        setDemo({ on: r.demo, error: r.error });
      });
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  // The company only ever sees reports that actually broke one of its rules.
  const incoming = useMemo(() => (reports ?? []).filter((r) => r.checker?.ruleBroken), [reports]);
  useEffect(() => {
    if (!selected && incoming[0]) setSelected(incoming[0].reportId);
  }, [incoming, selected]);
  const current = incoming.find((r) => r.reportId === selected) ?? null;

  return (
    <div className="container page">
      <div className="section-head">
        <div className="stack" style={{ gap: 10 }}>
          <span className="kicker">Company dashboard</span>
          <h1 style={{ fontSize: "clamp(2.2rem, 5vw, 3.8rem)" }}>{BOUNTY.company}</h1>
          <div className="row">
            <span className="tag flat">Bounty {BOUNTY.id}</span>
            <a className={`tag ${pool.live ? "accent" : ""}`} href={sepoliaAddr(POOL_ADDRESS)} target="_blank" rel="noreferrer">
              {pool.live ? "Live on Sepolia ↗" : pool.loading ? "Reading the chain…" : "Chain unreachable: showing deployed numbers"}
            </a>
            <DemoFlag show={demo.on} error={demo.error} />
          </div>
        </div>
        <Ghost variant="shield" size={130} rotate={-8} float />
      </div>

      {/* ---------- pool ---------- */}
      <div className="grid-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: 36 }}>
        <Stat label="Locked pool" value={pool.balance.toLocaleString()} unit="USDC" />
        <Stat label="Auto-pay limit" value={pool.limit} unit="USDC / report" />
        <Stat label="Monthly cap" value={pool.monthlyCap.toLocaleString()} unit="USDC" />
        <Stat label="Paid this month" value={pool.paidThisMonth ?? "—"} unit="USDC" />
      </div>

      {/* ---------- rules ---------- */}
      <div className="section-head">
        <h2>Your rules</h2>
        <span className="muted" style={{ maxWidth: 420 }}>Written before any bug was seen. Breaking one triggers the base pay, not anyone&apos;s opinion.</span>
      </div>
      <div className="grid-2" style={{ marginBottom: 44 }}>
        {RULES.map((r) => (
          <div key={r.id} className={`card ${r.mandatory ? "flat" : ""}`}>
            <div className="card-title">
              <h3>{r.name}</h3>
              <div className="row" style={{ gap: 6 }}>
                {r.mandatory && <span className="tag accent">Mandatory</span>}
                <SeverityTag severity={r.severity} />
              </div>
            </div>
            <p>{r.plain}</p>
            <p className="mono" style={{ marginTop: 10, fontSize: "0.8rem" }}>
              rule id: {r.id} · tier {usd(pool.tiers[r.severity])} · paid automatically up to {usd(Math.min(pool.tiers[r.severity], pool.limit))}
            </p>
          </div>
        ))}
      </div>

      {/* ---------- reports ---------- */}
      <div className="section-head">
        <h2>Incoming reports</h2>
        <span className="muted">Only reports that broke a rule show up here.</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 340px) minmax(0, 1fr)", gap: 28, alignItems: "start" }} className="reports-grid">
        <div className="stack" style={{ gap: 14 }}>
          {reports === null && (
            <div className="card row">
              <Ghost variant="detective" size={70} />
              <span>Loading reports…</span>
            </div>
          )}
          {reports !== null && incoming.length === 0 && (
            <div className="card row">
              <Ghost variant="sleepy" size={70} />
              <span>No reports yet. Quiet. Too quiet.</span>
            </div>
          )}
          {incoming.map((r) => (
            <button
              key={r.reportId}
              onClick={() => setSelected(r.reportId)}
              className={`card lift ${selected === r.reportId ? "is-selected" : ""}`}
              style={{
                textAlign: "left", cursor: "pointer", font: "inherit", padding: 16,
                background: selected === r.reportId ? "var(--ink)" : "var(--surface)",
                color: selected === r.reportId ? "var(--base)" : "var(--ink)",
              }}
            >
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong className="mono" style={{ fontSize: "0.85rem" }}>{r.reportId}</strong>
                <SeverityTag severity={r.checker?.severity} />
              </div>
              <div className="row" style={{ justifyContent: "space-between", marginTop: 10 }}>
                <span style={{ fontSize: "0.85rem" }}>
                  {usd(r.checker?.valueMovedUsdc ?? 0)} at risk · {timeAgo(r.submission.submittedAt)}
                </span>
                <StatusTag status={r.status} />
              </div>
            </button>
          ))}
        </div>

        <div>
          {current ? (
            <ReportDetail env={current} pool={pool} demo={demo.on} />
          ) : (
            reports !== null && incoming.length > 0 && (
              <div className="card row">
                <Ghost variant="detective" size={80} />
                <span>Pick a report to read it.</span>
              </div>
            )
          )}
        </div>
      </div>

      <div style={{ marginTop: 40 }}>
        <SealedNote />
      </div>
    </div>
  );
}

function ReportDetail({ env, pool, demo }: { env: ReportEnvelope; pool: Pool; demo: boolean }) {
  const c = env.checker!;
  const report = env.report;
  const id = useMemo(() => reportIdToBytes32(env.reportId), [env.reportId]);
  // The on-chain truth for this report: base paid + bonus.
  const onchain = useReadContract({ address: POOL_ADDRESS, abi: bountyPoolAbi, functionName: "reports", args: [id], query: { enabled: !demo, refetchInterval: 8000 } });
  const onChainExists = !!onchain.data && onchain.data[0] !== 0;
  const chainBase = onChainExists ? toUsdc(onchain.data![3]) : undefined;
  const chainBonus = onChainExists ? toUsdc(onchain.data![4]) : undefined;
  const base = chainBase ?? env.payout?.paidUsdc ?? 0;
  const tier = c.severity ? pool.tiers[c.severity] : 0;

  return (
    <div className="stack" style={{ gap: 24 }}>
      {/* scorecard: facts measured by the checker, no AI */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ background: "var(--ink)", color: "var(--base)", padding: "12px 20px" }} className="row">
          <strong style={{ fontFamily: "var(--font-display)", textTransform: "uppercase" }}>Scorecard</strong>
          <span className="mono" style={{ fontSize: "0.8rem" }}>{env.reportId}</span>
          <span style={{ marginLeft: "auto", fontSize: "0.8rem" }}>Measured on a copy of the chain. No AI.</span>
        </div>
        <div className="grid-2" style={{ padding: 20, gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <Fact k="Rule broken" v={ruleName(c.ruleBroken)} />
          <Fact k="Severity" v={<SeverityTag severity={c.severity} />} />
          <Fact k="Money moved" v={usd(c.valueMovedUsdc)} />
          <Fact k="Fork block" v={c.forkBlock.toLocaleString()} />
          <Fact k="Base paid" v={usd(base)} />
          <Fact k="Bonus" v={chainBonus !== undefined ? usd(chainBonus) : "—"} />
          <Fact k="On-chain" v={demo ? "—" : onChainExists ? "Yes ✓" : onchain.isLoading ? "Checking…" : "Not found"} />
        </div>
        <div style={{ padding: "0 20px 18px" }} className="stack">
          <span className="mono" style={{ fontSize: "0.75rem" }}>
            hacker <a href={sepoliaAddr(env.submission.hackerAddress)} target="_blank" rel="noreferrer" className="code">{short(env.submission.hackerAddress, 8, 6)}</a>
            {" · "}exploit hash <span className="code">{short(c.exploitHash, 10, 8)}</span>
          </span>
          {env.payout && !demo && (
            <span className="mono" style={{ fontSize: "0.75rem" }}>
              payout tx <a href={sepoliaTx(env.payout.txHash)} target="_blank" rel="noreferrer" className="code">{short(env.payout.txHash, 10, 8)} ↗</a>
              {env.arkiv?.entityKey && (
                <>
                  {" · "}Arkiv entity{" "}
                  {env.arkiv.url ? (
                    <a href={env.arkiv.url} target="_blank" rel="noreferrer" className="code">{short(env.arkiv.entityKey, 10, 8)} ↗</a>
                  ) : (
                    <span className="code" title={env.arkiv.entityKey}>{short(env.arkiv.entityKey, 10, 8)}</span>
                  )}
                </>
              )}
            </span>
          )}

          {/* The machine output the payout was decided on. Shown in full so the
              company can re-run the same check itself rather than trust our prose. */}
          <details className="mono" style={{ fontSize: "0.72rem", marginTop: 4 }}>
            <summary style={{ cursor: "pointer" }}>
              Raw checker output — the measurement the payout was based on
            </summary>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                margin: "8px 0 0",
                padding: 12,
                border: "1px solid var(--ink)",
                maxHeight: 280,
                overflow: "auto",
              }}
            >
{JSON.stringify({ checker: c, payout: env.payout, arkiv: env.arkiv }, null, 2)}
            </pre>
            <span style={{ display: "block", marginTop: 6, opacity: 0.8 }}>
              Deterministic: re-running this exploit against the same fork block yields the same
              numbers. Nothing here was written by a model.
            </span>
          </details>

          {/* The re-runnable proof. A company should not have to trust our summary:
              here is the submission, the exact test, and forge's own output. */}
          {env.runEvidence && env.runEvidence.replay.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="stat-label" style={{ marginBottom: 2 }}>
                Replay — what the chain actually did, in order
              </div>
              <div className="mono" style={{ fontSize: "0.72rem", opacity: 0.8, marginBottom: 8 }}>
                Decoded from the events the run emitted. Not a description of it.
              </div>

              <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {env.runEvidence.replay.map((s) => (
                  <li
                    key={s.seq}
                    className="row"
                    style={{
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "8px 10px",
                      borderLeft: "3px solid var(--ink)",
                      marginBottom: 6,
                      background: "var(--raised)",
                    }}
                  >
                    <span className="mono" style={{ fontSize: "0.72rem", opacity: 0.7, minWidth: 18 }}>
                      {s.seq}
                    </span>
                    <span style={{ flex: 1 }}>
                      <span style={{ display: "block", fontWeight: 600 }}>{s.title}</span>
                      <span className="mono" style={{ fontSize: "0.72rem", opacity: 0.85 }}>
                        {s.detail}
                      </span>
                    </span>
                    <span className={`tag ${s.kind === "rule" ? "accent" : "flat"}`} style={{ fontSize: "0.65rem" }}>
                      {s.kind === "event" ? "on-chain event" : s.kind}
                    </span>
                  </li>
                ))}
              </ol>

              <details className="mono" style={{ fontSize: "0.72rem", marginTop: 6 }}>
                <summary style={{ cursor: "pointer" }}>forge&apos;s raw output (nothing hidden)</summary>
                <Proof title="" body={env.runEvidence.forgeLog} />
              </details>
            </div>
          )}
        </div>
      </div>

      {/* evidence report: AI describes, never decides */}
      <div className="card flat" style={{ position: "relative" }}>
        <div className="sticker-abs" style={{ top: -62, right: -26 }}>
          <Ghost variant="detective" size={80} rotate={10} />
        </div>
        <div className="card-title">
          <h3>Evidence report</h3>
          <span className="tag raised">{report?.fallback ? "Prepared template" : "Written by AI"} · describes only</span>
        </div>
        {!report ? (
          <p>The report is still being written…</p>
        ) : (
          <div className="stack" style={{ gap: 16 }}>
            <p style={{ fontSize: "1.1rem", fontWeight: 600 }}>{report.summary}</p>
            <div>
              <div className="label">How it works</div>
              <ol className="steps-list">
                {report.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
            <div className="grid-2" style={{ gap: 16 }}>
              <div className="card" style={{ boxShadow: "var(--shadow-sm)", padding: 16 }}>
                <div className="label">Root cause</div>
                <p>{report.rootCause}</p>
              </div>
              <div className="card" style={{ boxShadow: "var(--shadow-sm)", padding: 16 }}>
                <div className="label">Suggested fix</div>
                <p>{report.suggestedFixSummary}</p>
              </div>
            </div>
            <div className="row">
              <span className="label" style={{ margin: 0 }}>AI suggests</span>
              <SeverityTag severity={report.suggestedSeverity} />
              <span className="muted" style={{ fontSize: "0.85rem" }}>(advice only; the pay used the rule&apos;s severity)</span>
            </div>
          </div>
        )}
      </div>

      {env.payout && (
        <BonusBox
          reportId={env.reportId}
          suggested={Math.max(0, tier - base - (chainBonus ?? 0))}
          tier={tier}
          canPay={demo || onChainExists}
          demo={demo}
          onDone={() => {
            onchain.refetch();
            pool.refetch();
          }}
        />
      )}
    </div>
  );
}

/** One block of machine evidence: a label and a scrollable, copyable code dump. */
function Proof({ title, body }: { title: string; body: string }) {
  if (!body) return null;
  return (
    <div style={{ marginTop: 10 }}>
      {title ? <div className="stat-label" style={{ marginBottom: 4 }}>{title}</div> : null}
      <pre
        style={{
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          margin: 0,
          padding: 10,
          border: "1px solid var(--ink)",
          maxHeight: 220,
          overflow: "auto",
        }}
      >
        {body}
      </pre>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ border: "2px solid var(--ink)", padding: "10px 12px", background: "var(--raised)" }}>
      <div className="stat-label">{k}</div>
      <div style={{ fontFamily: "var(--font-display)", marginTop: 4 }}>{v}</div>
    </div>
  );
}

function BonusBox({
  reportId, suggested, tier, canPay, demo, onDone,
}: {
  reportId: string; suggested: number; tier: number; canPay: boolean; demo: boolean; onDone: () => void;
}) {
  const [amount, setAmount] = useState(suggested ? String(suggested) : "");
  const [msg, setMsg] = useState<string | null>(null);
  const { address, isConnected } = useAccount();
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });
  const isCompany = !!address && address.toLowerCase() === COMPANY_WALLET.toLowerCase();

  useEffect(() => {
    if (receipt.isSuccess) {
      setMsg("Bonus paid on-chain.");
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.isSuccess]);

  useEffect(() => {
    setAmount(suggested ? String(suggested) : "");
    setMsg(null);
    reset();
  }, [reportId, suggested, reset]);

  const valid = Number(amount) > 0;

  function send() {
    if (!valid) return;
    setMsg(null);
    if (demo) {
      setMsg("Offline demo: no transaction was sent.");
      return;
    }
    writeContract({
      address: POOL_ADDRESS,
      abi: bountyPoolAbi,
      functionName: "addBonus",
      args: [reportIdToBytes32(reportId), parseUnits(amount, USDC_DECIMALS)],
    });
  }

  return (
    <div className="card accent">
      <div className="card-title">
        <h3>Add a bonus</h3>
        <Ghost variant="bag" size={60} rotate={8} />
      </div>
      <p className="muted" style={{ marginBottom: 14 }}>
        The base was paid automatically. Anything on top is your choice.
        {suggested > 0 && <> This rule&apos;s full tier is {usd(tier)}, so topping up by {usd(suggested)} pays it in full.</>}
      </p>
      <div className="row">
        <input
          className="input"
          style={{ maxWidth: 200 }}
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          aria-label="Bonus amount in USDC"
          placeholder="Amount"
        />
        <span style={{ fontWeight: 700 }}>USDC</span>
        {!demo && !isConnected ? (
          <ConnectButton className="btn" />
        ) : (
          <button className="btn" onClick={send} disabled={!valid || isPending || receipt.isLoading || (!demo && (!isCompany || !canPay))}>
            {isPending ? "Confirm in wallet…" : receipt.isLoading ? "Sending…" : "Pay bonus"}
          </button>
        )}
      </div>
      {!demo && isConnected && !isCompany && (
        <p style={{ marginTop: 12, fontSize: "0.85rem" }}>
          Only the company wallet <span className="mono">{short(COMPANY_WALLET, 6, 4)}</span> can pay a bonus. Switch to it in your wallet.
        </p>
      )}
      {!demo && !canPay && <p style={{ marginTop: 12, fontSize: "0.85rem" }}>This report isn&apos;t on-chain yet, so there is nothing to top up.</p>}
      {hash && (
        <p style={{ marginTop: 12, fontSize: "0.85rem" }}>
          Transaction: <a href={sepoliaTx(hash)} target="_blank" rel="noreferrer" className="mono">{short(hash, 10, 8)}</a>
        </p>
      )}
      {msg && <p style={{ marginTop: 12, fontWeight: 700 }}>{msg}</p>}
      {error && <p style={{ marginTop: 12 }}>⚠ {error.message.split("\n")[0]}</p>}
    </div>
  );
}
