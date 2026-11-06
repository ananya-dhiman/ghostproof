"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import type { ArkivReportRecord } from "@shared/types";
import { Ghost } from "@/components/Ghost";
import { ConnectButton } from "@/components/ConnectButton";
import { DemoFlag, SealedNote, SeverityTag, Stat, StatusTag } from "@/components/Bits";
import { fetchRecords, fetchReport, type ReportView } from "@/lib/api";
import { BOUNTY, DEMO_POOL, RULES, ruleName } from "@/lib/rules";
import {
  CONTRACTS_DEPLOYED,
  POOL_ADDRESS,
  USDC_ADDRESS,
  USDC_DECIMALS,
  bountyPoolAbi,
  erc20Abi,
  reportIdToBytes32,
  sepoliaTx,
} from "@/lib/chain";
import { short, timeAgo, usd } from "@/lib/format";

export default function CompanyPage() {
  return (
    <Suspense>
      <Company />
    </Suspense>
  );
}

function usePool() {
  const bal = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [POOL_ADDRESS],
    query: { enabled: CONTRACTS_DEPLOYED, refetchInterval: 8000 },
  });
  const cfg = useReadContract({
    address: POOL_ADDRESS,
    abi: bountyPoolAbi,
    functionName: "getConfig",
    query: { enabled: CONTRACTS_DEPLOYED },
  });
  const n = (v: bigint | undefined) => (v === undefined ? undefined : Number(formatUnits(v, USDC_DECIMALS)));
  const live = CONTRACTS_DEPLOYED && bal.data !== undefined && cfg.data !== undefined;
  if (!live) return { live: false, ...DEMO_POOL, refetch: () => {} };
  const [limit, cap, medium, high, critical] = cfg.data!;
  return {
    live: true,
    balance: n(bal.data)!,
    limit: n(limit)!,
    monthlyCap: n(cap)!,
    medium: n(medium)!,
    high: n(high)!,
    critical: n(critical)!,
    suggestedCriticalBonus: DEMO_POOL.suggestedCriticalBonus,
    refetch: () => bal.refetch(),
  };
}

function Company() {
  const params = useSearchParams();
  const pool = usePool();
  const [records, setRecords] = useState<ArkivReportRecord[]>([]);
  const [demo, setDemo] = useState<{ on: boolean; error?: string }>({ on: false });
  const [selected, setSelected] = useState<string | null>(params.get("report"));
  const [view, setView] = useState<ReportView | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRecords().then((r) => {
      setRecords(r.data);
      setDemo({ on: r.demo, error: r.error });
      setSelected((s) => s ?? r.data.find((x) => x.status !== "rejected")?.reportId ?? null);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    fetchReport(selected).then((r) => {
      setView(r.data);
      setLoading(false);
    });
  }, [selected]);

  // Rejected reports never reach the company (verified:false => stop).
  const incoming = useMemo(() => records.filter((r) => r.status !== "rejected"), [records]);
  const paidTotal = incoming.reduce((s, r) => s + r.paidUsdc + r.bonusUsdc, 0);

  function onBonusAdded(reportId: string, amount: number) {
    setRecords((rs) => rs.map((r) => (r.reportId === reportId ? { ...r, status: "bonus-added", bonusUsdc: r.bonusUsdc + amount } : r)));
    setView((v) => (v?.record ? { ...v, record: { ...v.record, status: "bonus-added", bonusUsdc: v.record.bonusUsdc + amount } } : v));
    pool.refetch();
  }

  return (
    <div className="container page">
      <div className="section-head">
        <div className="stack" style={{ gap: 10 }}>
          <span className="kicker">Company dashboard</span>
          <h1 style={{ fontSize: "clamp(2.2rem, 5vw, 3.8rem)" }}>{BOUNTY.company}</h1>
          <div className="row">
            <span className="tag yellow">Bounty {BOUNTY.id}</span>
            <span className={`tag ${pool.live ? "black" : ""}`}>{pool.live ? "Live on Sepolia" : "Pool: demo numbers"}</span>
            <DemoFlag show={demo.on} error={demo.error} />
          </div>
        </div>
        <Ghost variant="shield" size={130} rotate={-8} float />
      </div>

      {/* ---------- pool ---------- */}
      <div className="grid-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: 36 }}>
        <Stat label="Locked pool" value={pool.balance.toLocaleString()} unit="USDC" />
        <Stat label="Auto-pay limit" value={pool.limit} unit="USDC / report" />
        <Stat label="Monthly cap" value={pool.monthlyCap} unit="USDC" />
        <Stat label="Paid out so far" value={paidTotal} unit="USDC" />
      </div>

      {/* ---------- rules ---------- */}
      <div className="section-head">
        <h2>Your rules</h2>
        <span className="muted" style={{ maxWidth: 420 }}>Written before any bug was seen. Breaking one triggers the base pay, not anyone&apos;s opinion.</span>
      </div>
      <div className="grid-2" style={{ marginBottom: 44 }}>
        {RULES.map((r) => (
          <div key={r.id} className={`card ${r.mandatory ? "yellow" : ""}`}>
            <div className="card-title">
              <h3>{r.name}</h3>
              <div className="row" style={{ gap: 6 }}>
                {r.mandatory && <span className="tag black">Mandatory</span>}
                <SeverityTag severity={r.severity} />
              </div>
            </div>
            <p>{r.plain}</p>
            <p className="mono" style={{ marginTop: 10, fontSize: "0.8rem" }}>
              rule id: {r.id} · base pay {usd(r.severity === "critical" ? pool.critical : r.severity === "high" ? pool.high : pool.medium)}
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
          {incoming.length === 0 && (
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
                background: selected === r.reportId ? "var(--black)" : "var(--paper)",
                color: selected === r.reportId ? "var(--yellow)" : "var(--black)",
              }}
            >
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong className="mono">{r.reportId}</strong>
                <SeverityTag severity={r.severity} />
              </div>
              <div className="row" style={{ justifyContent: "space-between", marginTop: 10 }}>
                <span style={{ fontSize: "0.85rem" }}>{usd(r.valueMovedUsdc)} at risk · {timeAgo(r.createdAt)}</span>
                <StatusTag status={r.status} />
              </div>
            </button>
          ))}
        </div>

        <div>
          {!selected || !view ? (
            <div className="card row">
              <Ghost variant="detective" size={80} />
              <span>{loading ? "Loading report…" : "Pick a report to read it."}</span>
            </div>
          ) : (
            <ReportDetail view={view} pool={pool} onBonusAdded={onBonusAdded} />
          )}
        </div>
      </div>

      <div style={{ marginTop: 40 }}>
        <SealedNote />
      </div>
    </div>
  );
}

function ReportDetail({
  view,
  pool,
  onBonusAdded,
}: {
  view: ReportView;
  pool: ReturnType<typeof usePool>;
  onBonusAdded: (id: string, amount: number) => void;
}) {
  const { result, report, record } = view;
  return (
    <div className="stack" style={{ gap: 24 }}>
      {/* scorecard: facts measured by the checker, no AI */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ background: "var(--black)", color: "var(--yellow)", padding: "12px 20px" }} className="row">
          <strong style={{ fontFamily: "var(--font-display)", textTransform: "uppercase" }}>Scorecard · {result.reportId}</strong>
          <span style={{ marginLeft: "auto", fontSize: "0.8rem" }}>Measured on a copy of the chain. No AI.</span>
        </div>
        <div className="grid-2" style={{ padding: 20, gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <Fact k="Rule broken" v={ruleName(result.ruleBroken)} />
          <Fact k="Severity" v={<SeverityTag severity={result.severity} />} />
          <Fact k="Money moved" v={usd(result.valueMovedUsdc)} />
          <Fact k="Fork block" v={result.forkBlock.toLocaleString()} />
          <Fact k="Base paid" v={record ? usd(record.paidUsdc) : "—"} />
          <Fact k="Bonus" v={record ? usd(record.bonusUsdc) : "—"} />
        </div>
        <div style={{ padding: "0 20px 18px" }} className="mono">
          <span style={{ fontSize: "0.75rem" }}>exploit hash </span>
          <span className="code">{short(result.exploitHash, 14, 10)}</span>
        </div>
      </div>

      {/* evidence report: AI describes, never decides */}
      <div className="card yellow" style={{ position: "relative" }}>
        <div className="sticker-abs" style={{ top: -36, right: -18 }}>
          <Ghost variant="detective" size={80} rotate={10} />
        </div>
        <div className="card-title">
          <h3>Evidence report</h3>
          <span className="tag white">Written by AI · describes only</span>
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
              <span className="muted" style={{ fontSize: "0.85rem" }}>(advice only; pay used the rule&apos;s severity)</span>
            </div>
          </div>
        )}
      </div>

      {record && record.status !== "rejected" && (
        <BonusBox reportId={result.reportId} severity={result.severity} suggested={result.severity === "critical" ? pool.suggestedCriticalBonus : 0} onAdded={onBonusAdded} />
      )}
    </div>
  );
}

function Fact({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ border: "2px solid var(--black)", padding: "10px 12px", background: "var(--white)" }}>
      <div className="stat-label">{k}</div>
      <div style={{ fontFamily: "var(--font-display)", marginTop: 4 }}>{v}</div>
    </div>
  );
}

function BonusBox({
  reportId,
  severity,
  suggested,
  onAdded,
}: {
  reportId: string;
  severity: string | null;
  suggested: number;
  onAdded: (id: string, amount: number) => void;
}) {
  const [amount, setAmount] = useState(suggested ? String(suggested) : "");
  const [msg, setMsg] = useState<string | null>(null);
  const { isConnected } = useAccount();
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (receipt.isSuccess) {
      onAdded(reportId, Number(amount));
      setMsg("Bonus sent on-chain.");
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
    if (!CONTRACTS_DEPLOYED) {
      // TODO: remove once Person A's pool address is in shared/config.ts.
      onAdded(reportId, Number(amount));
      setMsg("Demo mode: contracts not deployed yet, so no transaction was sent.");
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
    <div className="card black">
      <div className="card-title">
        <h3 style={{ color: "var(--yellow)" }}>Add a bonus</h3>
        <Ghost variant="bag" size={60} rotate={8} />
      </div>
      <p className="muted" style={{ marginBottom: 14 }}>
        The base was paid automatically. Anything on top is your choice.
        {severity === "critical" && suggested > 0 && <> For a critical bug, the suggested bonus is {usd(suggested)}.</>}
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
        {CONTRACTS_DEPLOYED && !isConnected ? (
          <ConnectButton className="btn" />
        ) : (
          <button className="btn" onClick={send} disabled={!valid || isPending || receipt.isLoading}>
            {isPending ? "Confirm in wallet…" : receipt.isLoading ? "Sending…" : "Add bonus"}
          </button>
        )}
      </div>
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
