// Demo data. Used when NEXT_PUBLIC_BACKEND_URL is not set, or as a fallback if the backend is down
// during judging. Every screen shows a "demo data" flag when this is in use.
import type { ArkivReportRecord, CheckerResult, EvidenceReport } from "@shared/types";
import type { ReportView } from "./api";

const now = Math.floor(Date.now() / 1000);

export const DEMO_EXPLOIT = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VulnerableVault} from "../src/VulnerableVault.sol";

/// Run from a FRESH account with no permissions.
contract Exploit {
    VulnerableVault public vault;
    constructor(VulnerableVault _vault) { vault = _vault; }

    function runExploit() external {
        // emergencyWithdraw has no owner check: anyone can drain the vault.
        vault.emergencyWithdraw();
    }
}
`;

// Canned report: also the fallback if the live AI call is slow or down.
export const CANNED_REPORT: EvidenceReport = {
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
  suggestedFixSummary:
    "Restrict emergencyWithdraw() to the owner (an onlyOwner check) and send funds to a fixed safe address, never to the caller.",
};

export const MOCK_RECORDS: ArkivReportRecord[] = [
  {
    bountyId: "vault-01", reportId: "rep_003",
    exploitHash: "0x9f3c1ab27e04d5c6f8a1b2c3d4e5f60718293a4b5c6d7e8f9012ab34cd56ef78",
    severity: "critical", valueMovedUsdc: 1000, status: "base-paid", paidUsdc: 50, bonusUsdc: 0, createdAt: now - 60 * 7,
  },
  {
    bountyId: "vault-01", reportId: "rep_002",
    exploitHash: "0x41d8e7aa90b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7",
    severity: "medium", valueMovedUsdc: 12.5, status: "bonus-added", paidUsdc: 50, bonusUsdc: 75, createdAt: now - 3600 * 5,
  },
  {
    bountyId: "vault-01", reportId: "rep_001",
    exploitHash: "0x0c77b1f2e3d4c5b6a7980a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d",
    severity: "high", valueMovedUsdc: 0, status: "rejected", paidUsdc: 0, bonusUsdc: 0, createdAt: now - 86400 * 2,
  },
];

function fakeHash(seed: string) {
  let h = "";
  for (let i = 0; h.length < 64; i++) h += ((seed.charCodeAt(i % seed.length) * (i + 7)) % 256).toString(16).padStart(2, "0");
  return "0x" + h.slice(0, 64);
}

export function mockResult(reportId: string): CheckerResult {
  return {
    verified: true,
    ruleBroken: "no-theft",
    severity: "critical",
    valueMovedUsdc: 1000,
    forkBlock: 7_412_388,
    exploitHash: fakeHash(reportId),
    reportId,
  };
}

const MEDIUM_REPORT: EvidenceReport = {
  summary:
    "Depositing a tiny amount over and over lets rounding errors pile up, so the vault's books no longer match the money it really holds.",
  steps: [
    "Deposit the smallest possible amount of USDC 500 times.",
    "Read the vault's recorded total.",
    "Compare it with the real token balance: they differ by 12.5 USDC.",
  ],
  rootCause: "Share maths rounds in the depositor's favour instead of the vault's.",
  suggestedSeverity: "medium",
  suggestedFixSummary: "Round down when minting shares and round up when burning them.",
};

export function mockReportView(reportId: string): ReportView {
  const rec = MOCK_RECORDS.find((r) => r.reportId === reportId);
  if (!rec) {
    const result = mockResult(reportId);
    return {
      result,
      report: CANNED_REPORT,
      record: {
        bountyId: "vault-01", reportId, exploitHash: result.exploitHash, severity: "critical",
        valueMovedUsdc: 1000, status: "base-paid", paidUsdc: 50, bonusUsdc: 0, createdAt: Math.floor(Date.now() / 1000),
      },
    };
  }
  const rejected = rec.status === "rejected";
  const result: CheckerResult = {
    verified: !rejected,
    ruleBroken: rejected ? null : rec.severity === "critical" ? "no-theft" : "accounting-intact",
    severity: rejected ? null : rec.severity,
    valueMovedUsdc: rec.valueMovedUsdc,
    forkBlock: 7_412_000,
    exploitHash: rec.exploitHash,
    reportId,
  };
  const report = rejected ? null : rec.severity === "medium" ? MEDIUM_REPORT : CANNED_REPORT;
  return { result, report, record: rec };
}
