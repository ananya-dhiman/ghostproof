// Offline demo data, used ONLY when the backend can't be reached. Every screen flags it.
// Shapes match the real backend exactly (shared/types.ts), so nothing else has to care.
import type { ArkivReportRecord, EvidenceReport, ReportEnvelope, SubmitRequest } from "@shared/types";

// Same as backend/fixtures/Exploit.sol: the demo submission the checker accepts.
export const DEMO_EXPLOIT = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VulnerableVault} from "target/VulnerableVault.sol";

contract ExploitDrain {
    function run(VulnerableVault vault) external {
        // emergencyWithdraw is missing its owner-only check, so a fresh
        // account with no deposit drains the whole vault to itself.
        vault.emergencyWithdraw();
    }
}
`;

const CANNED_REPORT: EvidenceReport = {
  summary:
    "A brand-new account with no special permissions called the vault's emergency withdraw and walked away with all 1,000 USDC held for other users.",
  steps: [
    "Start from a fresh account that owns nothing and has no roles.",
    "Call emergencyWithdraw() on the vault directly.",
    "The vault sends its entire USDC balance to the caller.",
    "The checker compares balances before and after: the attacker gained 1,000 USDC.",
  ],
  rootCause: "emergencyWithdraw() is missing an owner-only check, so any caller is treated as the owner.",
  suggestedSeverity: "critical",
  suggestedFixSummary: "Restrict emergencyWithdraw() to the owner and send funds to a fixed safe address, never to the caller.",
  fallback: true,
};

const hex = (seed: string, len = 64) => {
  let h = "";
  for (let i = 0; h.length < len; i++) h += ((seed.charCodeAt(i % seed.length) * (i + 7)) % 256).toString(16).padStart(2, "0");
  return "0x" + h.slice(0, len);
};

const now = () => Math.floor(Date.now() / 1000);
const BOOT = now();

function staticEnvelope(n: number, ageSec: number, kind: "critical" | "medium" | "rejected"): ReportEnvelope {
  const reportId = `rep_demo_${n}`;
  const t = BOOT - ageSec;
  if (kind === "rejected") {
    return {
      reportId, status: "rejected",
      submission: { bountyId: "vault-01", hackerAddress: "0x3333333333333333333333333333333333333333", submittedAt: t },
      checker: null, report: null, payout: null, arkiv: null,
      error: "submission rejected: the submission must expose `function run(VulnerableVault vault) external`",
    };
  }
  const critical = kind === "critical";
  return {
    reportId, status: "base-paid",
    submission: { bountyId: "vault-01", hackerAddress: critical ? "0x1111111111111111111111111111111111111111" : "0x2222222222222222222222222222222222222222", submittedAt: t },
    checker: {
      verified: true, ruleBroken: critical ? "no-theft" : "fee-accounting", severity: critical ? "critical" : "medium",
      valueMovedUsdc: critical ? 1000 : 12.5, forkBlock: 12077778, exploitHash: hex(reportId), reportId,
    },
    report: critical ? CANNED_REPORT : {
      summary: "Depositing a tiny amount over and over lets rounding errors pile up, so the vault's books no longer match the money it holds.",
      steps: ["Deposit the smallest possible amount 500 times.", "Read the vault's recorded total.", "Compare it with the real token balance: they differ by 12.5 USDC."],
      rootCause: "Share maths rounds in the depositor's favour instead of the vault's.",
      suggestedSeverity: "medium",
      suggestedFixSummary: "Round down when minting shares and up when burning them.",
      fallback: true,
    },
    payout: { txHash: hex(reportId + "tx"), paidUsdc: 50 },
    arkiv: null,
    error: null,
  };
}

const STATIC: ReportEnvelope[] = [staticEnvelope(3, 60 * 7, "critical"), staticEnvelope(2, 3600 * 5, "medium"), staticEnvelope(1, 86400 * 2, "rejected")];

// Reports simulated in this browser while offline, advanced by elapsed time.
const simulated = new Map<string, { body: SubmitRequest; at: number }>();

export function demoSubmit(body: SubmitRequest) {
  const reportId = `rep_offline_${Date.now().toString(36)}`;
  simulated.set(reportId, { body, at: Date.now() });
  return { reportId, status: "checking" as const };
}

export function demoReport(reportId: string): ReportEnvelope | null {
  const s = simulated.get(reportId);
  if (!s) return STATIC.find((r) => r.reportId === reportId) ?? null;
  const elapsed = Date.now() - s.at;
  const base = staticEnvelope(99, 0, "critical");
  const env: ReportEnvelope = {
    ...base,
    reportId,
    submission: { bountyId: s.body.bountyId, hackerAddress: s.body.hackerAddress, submittedAt: Math.floor(s.at / 1000) },
    checker: elapsed > 3000 ? { ...base.checker!, reportId, exploitHash: hex(reportId) } : null,
    payout: elapsed > 5000 ? base.payout : null,
    report: elapsed > 7000 ? CANNED_REPORT : null,
    status: elapsed > 5000 ? "base-paid" : "checking",
  };
  return env;
}

export function demoReports(): ReportEnvelope[] {
  const sims = [...simulated.keys()].map((id) => demoReport(id)!).filter(Boolean);
  return [...sims, ...STATIC];
}

export function demoRecords(): ArkivReportRecord[] {
  return demoReports()
    .filter((r) => r.checker)
    .map((r) => ({
      bountyId: r.submission.bountyId,
      reportId: r.reportId,
      exploitHash: r.checker!.exploitHash,
      severity: r.checker!.severity,
      valueMovedUsdc: r.checker!.valueMovedUsdc,
      status: r.payout ? "base-paid" : "rejected",
      paidUsdc: r.payout?.paidUsdc ?? 0,
      bonusUsdc: 0,
      createdAt: r.submission.submittedAt,
    }));
}
