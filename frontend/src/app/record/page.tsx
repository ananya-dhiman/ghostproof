"use client";

import { useEffect, useState } from "react";
import type { ArkivReportRecord } from "@shared/types";
import { Ghost, Boo } from "@/components/Ghost";
import { DemoFlag, SeverityTag, Stat, StatusTag } from "@/components/Bits";
import { fetchRecords } from "@/lib/api";
import { short, timeAgo, usd } from "@/lib/format";

export default function RecordPage() {
  const [records, setRecords] = useState<ArkivReportRecord[] | null>(null);
  const [demo, setDemo] = useState<{ on: boolean; error?: string }>({ on: false });

  useEffect(() => {
    const load = () =>
      fetchRecords().then((r) => {
        setRecords(r.data);
        setDemo({ on: r.demo, error: r.error });
      });
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const rows = records ?? [];
  const paid = rows.filter((r) => r.status !== "rejected");
  const total = paid.reduce((s, r) => s + r.paidUsdc + r.bonusUsdc, 0);
  const bonusRate = paid.length ? Math.round((rows.filter((r) => r.status === "bonus-added").length / paid.length) * 100) : 0;

  return (
    <div className="container page">
      <div className="section-head" style={{ position: "relative" }}>
        <div className="stack" style={{ gap: 10 }}>
          <span className="kicker">Public record · on Arkiv</span>
          <h1 style={{ fontSize: "clamp(2.2rem, 5vw, 3.8rem)" }}>Track record</h1>
          <p style={{ maxWidth: 620 }}>
            Every report and what happened to it, stored on a shared public record anyone can read. A company
            can&apos;t quietly ghost a hacker here.
          </p>
          <DemoFlag show={demo.on} error={demo.error} />
        </div>
        <div className="row" style={{ alignItems: "end" }}>
          <Boo text="receipts!" rotate={-6} style={{ marginBottom: 90 }} />
          <Ghost variant="classic" size={120} rotate={6} float />
        </div>
      </div>

      <div className="grid-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: 32 }}>
        <Stat label="Reports" value={rows.length} />
        <Stat label="Paid on proof" value={paid.length} />
        <Stat label="Total paid" value={total.toLocaleString()} unit="USDC" />
        <Stat label="Got a bonus" value={`${bonusRate}%`} />
      </div>

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
            <strong>Why a public record?</strong> Hackers can check how a company treated past reports before
            spending a weekend on its code.
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
