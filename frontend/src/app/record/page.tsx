"use client";

import { useEffect, useMemo, useState } from "react";
import type { ArkivReportRecord, SeverityName } from "@shared/types";
import { Ghost, Boo } from "@/components/Ghost";
import { DemoFlag, SeverityTag, Stat, StatusTag } from "@/components/Bits";
import { fetchRecords } from "@/lib/api";
import { BOUNTY } from "@/lib/rules";
import { POOL_ADDRESS, USDC_ADDRESS, sepoliaAddr } from "@/lib/chain";
import { short, timeAgo, usd } from "@/lib/format";

export default function RecordPage() {
  const [records, setRecords] = useState<ArkivReportRecord[] | null>(null);
  const [demo, setDemo] = useState<{ on: boolean; error?: string }>({ on: false });
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      fetchRecords().then((r) => {
        setRecords(r.data.records);
        setSource(r.data.source);
        setDemo({ on: r.demo, error: r.error });
      });
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const rows = records ?? [];

  const stats = useMemo(() => {
    const paid = rows.filter((r) => r.status !== "rejected");
    const withBonus = rows.filter((r) => r.status === "bonus-added");
    const totalPaid = paid.reduce((s, r) => s + r.paidUsdc + r.bonusUsdc, 0);
    const atRisk = rows.reduce((s, r) => s + r.valueMovedUsdc, 0);
    const bySeverity = { critical: 0, high: 0, medium: 0 } as Record<SeverityName, number>;
    for (const r of rows) if (r.severity) bySeverity[r.severity] += 1;
    const latest = rows.reduce((m, r) => Math.max(m, r.createdAt), 0);
    return {
      paid,
      withBonus,
      totalPaid,
      atRisk,
      bySeverity,
      latest,
      avgPaid: paid.length ? Math.round(totalPaid / paid.length) : 0,
      bonusRate: paid.length ? Math.round((withBonus.length / paid.length) * 100) : 0,
      rejected: rows.filter((r) => r.status === "rejected").length,
    };
  }, [rows]);

  return (
    <div className="container page">
      <div className="section-head" style={{ position: "relative" }}>
        <div className="stack" style={{ gap: 10 }}>
          <span className="kicker">Company reputation · public record on Arkiv</span>
          <h1 style={{ fontSize: "clamp(2.2rem, 5vw, 3.8rem)" }}>{BOUNTY.company}</h1>
          <p style={{ maxWidth: 620 }}>
            How this company has actually handled bug reports. Written to a shared public record that the
            company cannot edit — so a hacker can check it before spending a weekend on their code.
          </p>
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            <span className="tag flat">Bounty {BOUNTY.id}</span>
            <a className="tag" href={sepoliaAddr(POOL_ADDRESS)} target="_blank" rel="noreferrer">
              Bounty pool ↗
            </a>
            <a className="tag" href={sepoliaAddr(USDC_ADDRESS)} target="_blank" rel="noreferrer">
              Token ↗
            </a>
            {source && !demo.on && (
              <span className={`tag ${source === "arkiv" ? "accent" : "flat"}`}>
                {source === "arkiv" ? "Read from Arkiv" : "Checker's copy of what it wrote to Arkiv"}
              </span>
            )}
            <DemoFlag show={demo.on} error={demo.error} />
          </div>
        </div>
        <div className="row" style={{ alignItems: "end" }}>
          <Boo text="receipts!" rotate={-6} style={{ marginBottom: 90 }} />
          <Ghost variant="classic" size={120} rotate={6} float />
        </div>
      </div>

      {/* ---------- how reports were handled ---------- */}
      <h2 style={{ marginBottom: 14 }}>How reports were handled</h2>
      <div
        className="grid-3"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", marginBottom: 18 }}
      >
        <Stat label="Proven findings" value={rows.length} />
        <Stat label="Paid automatically" value={stats.paid.length} />
        <Stat label="Total paid out" value={stats.totalPaid.toLocaleString()} unit="USDC" />
        <Stat label="Got a bonus on top" value={`${stats.bonusRate}%`} />
        <Stat label="Average payout" value={stats.avgPaid.toLocaleString()} unit="USDC" />
        <Stat label="Value found at risk" value={stats.atRisk.toLocaleString()} unit="USDC" />
        <Stat label="Ignored / expired" value={stats.rejected} />
        <Stat label="Last activity" value={stats.latest ? timeAgo(stats.latest) : "—"} />
      </div>

      {/* ---------- severity mix ---------- */}
      {rows.length > 0 && (
        <div className="card flat" style={{ marginBottom: 18 }}>
          <div className="card-title">
            <h3>Severity mix</h3>
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              decided by which pre-written rule broke, never by opinion
            </span>
          </div>
          <div className="row" style={{ flexWrap: "wrap", gap: 18, marginTop: 8 }}>
            {(["critical", "high", "medium"] as SeverityName[]).map((s) => (
              <div key={s} className="row" style={{ gap: 8 }}>
                <SeverityTag severity={s} />
                <span style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem" }}>
                  {stats.bySeverity[s]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="callout" style={{ marginBottom: 28 }}>
        <Ghost variant="detective" size={56} />
        <div>
          <strong>What this page does not count.</strong> Submissions that failed the checker — code that
          didn&apos;t compile, attacks that didn&apos;t work, or anything the safety guard rejected — never reach
          the public record. Only findings proven by replaying the attack appear here, so these numbers are
          about <em>how the company behaved</em>, not how much noise it received.
        </div>
      </div>

      <h2 style={{ marginBottom: 14 }}>Every report on the record</h2>
      {records === null ? (
        <div className="card row">
          <Ghost variant="detective" size={70} />
          <span>Reading the record…</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="card row">
          <Ghost variant="sleepy" size={70} />
          <span>No reports on the record yet.</span>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="brutal">
            <thead>
              <tr>
                <th>Report</th>
                <th>Bounty</th>
                <th>Severity</th>
                <th>Money at risk</th>
                <th>Outcome</th>
                <th>Paid</th>
                <th>Exploit hash</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.reportId}>
                  <td className="mono" style={{ fontWeight: 700 }}>{r.reportId}</td>
                  <td>{r.bountyId}</td>
                  <td><SeverityTag severity={r.status === "rejected" ? null : r.severity} /></td>
                  <td>{usd(r.valueMovedUsdc)}</td>
                  <td><StatusTag status={r.status} /></td>
                  <td style={{ fontFamily: "var(--font-display)" }}>
                    {usd(r.paidUsdc)}
                    {r.bonusUsdc > 0 && <span style={{ display: "block", fontSize: "0.8rem" }}>+ {usd(r.bonusUsdc)} bonus</span>}
                  </td>
                  <td><span className="code" title={r.exploitHash}>{short(r.exploitHash, 8, 6)}</span></td>
                  <td>{timeAgo(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid-2" style={{ marginTop: 32 }}>
        <div className="callout">
          <Ghost variant="shield" size={56} />
          <div>
            <strong>Why a public record?</strong> A bounty&apos;s credibility is just &quot;does this company
            actually pay&quot;. On Arkiv that answer isn&apos;t ours to edit — including by us.
          </div>
        </div>
        <div className="callout">
          <Ghost variant="sleepy" size={56} />
          <div>
            <strong>Open reports expire.</strong> Each record carries a deadline. If a company goes silent, the
            report expires on its own and the silence is on the record too.
          </div>
        </div>
      </div>
    </div>
  );
}
