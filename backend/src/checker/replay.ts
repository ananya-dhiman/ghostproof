/**
 * Turns the forge run's own logs into a chronological, human-readable replay.
 *
 * This is the company's evidence. It is not our narration: every line below is
 * decoded from what the EVM emitted during the run, in the order it happened —
 * ERC-20 Transfer events, the vault's own events, and the measurement lines the
 * harness logged. Nothing here is written by a model.
 */
import { formatUnits, toEventSelector } from "viem";
import type { ReplayStep } from "../types.js";

const CONSOLE_ADDR = "0x000000000000000000636f6e736f6c652e6c6f67";

const TRANSFER = toEventSelector("Transfer(address,address,uint256)").toLowerCase();
const APPROVAL = toEventSelector("Approval(address,address,uint256)").toLowerCase();
const DEPOSITED = toEventSelector("Deposited(address,uint256)").toLowerCase();
const WITHDRAWN = toEventSelector("Withdrawn(address,uint256)").toLowerCase();

export interface RawLog {
  address?: string;
  topics?: string[];
  data?: string;
}

export interface ReplayInput {
  rawLogs: RawLog[];
  decodedLogs: string[];
  forkBlock: number;
  known?: { usdc?: string; vault?: string };
}

function short(addr: string): string {
  const a = addr.toLowerCase();
  return `${a.slice(0, 8)}…${a.slice(-6)}`;
}

/** Friendly name for an address we recognise, else a short hex. */
function label(addr: string | undefined, known: ReplayInput["known"]): string {
  if (!addr) return "unknown";
  const a = addr.toLowerCase();
  if (known?.usdc && a === known.usdc.toLowerCase()) return "USDC";
  if (known?.vault && a === known.vault.toLowerCase()) return `the vault (${short(a)})`;
  return short(a);
}

/** An indexed address topic is the address left-padded to 32 bytes. */
function addrFromTopic(topic: string | undefined): string {
  if (!topic) return "";
  return `0x${topic.slice(-40)}`;
}

function usdc(dataHex: string | undefined): string {
  if (!dataHex) return "0";
  try {
    return `${formatUnits(BigInt(dataHex), 6)} USDC`;
  } catch {
    return dataHex;
  }
}

/** GP_MOVED / GP_NOTHEFT / GP_ACCT into readable measurement steps. */
function fromHarnessLine(line: string): Omit<ReplayStep, "seq"> | null {
  const [tag, ...rest] = line.trim().split(/\s+/);
  const nums = rest.map(Number);

  if (tag === "GP_MOVED") {
    const raw = nums[0];
    return {
      kind: "measure",
      title: "Measured: value the attacker ended up holding",
      detail:
        Number.isFinite(raw) && raw !== undefined
          ? `${formatUnits(BigInt(Math.trunc(raw)), 6)} USDC`
          : line,
    };
  }

  const ruleName = tag === "GP_NOTHEFT" ? "no-theft" : tag === "GP_ACCT" ? "fee-accounting" : null;
  if (ruleName) {
    const broken = nums[0] === 1;
    const sev = nums[1] ?? 0;
    const sevName = sev >= 3 ? "Critical" : sev === 2 ? "High" : "Medium";
    return {
      kind: "rule",
      title: `Company rule "${ruleName}" — written before this bug existed`,
      detail: broken ? `BROKEN → ${sevName}` : "held (not broken)",
    };
  }

  return null;
}

/**
 * Build the replay. Raw EVM events and harness log lines are interleaved in
 * execution order: the console entries in `rawLogs` line up, in sequence, with
 * the readable strings in `decodedLogs`.
 */
export function buildReplay(input: ReplayInput): ReplayStep[] {
  const { rawLogs, decodedLogs, forkBlock, known } = input;
  const steps: Omit<ReplayStep, "seq">[] = [];

  steps.push({
    kind: "note",
    title: forkBlock
      ? `Replayed on a copy of Sepolia at block ${forkBlock}`
      : "Replayed in a self-contained sandbox (no fork)",
    detail: "A fresh account with no deposit and no permissions ran the submission.",
  });

  let consoleSeen = 0;

  for (const log of rawLogs) {
    const addr = (log.address ?? "").toLowerCase();

    if (addr === CONSOLE_ADDR) {
      const line = decodedLogs[consoleSeen];
      consoleSeen += 1;
      if (!line) continue;
      const step = fromHarnessLine(line);
      if (step) steps.push(step);
      continue;
    }

    const topic0 = (log.topics?.[0] ?? "").toLowerCase();

    if (topic0 === TRANSFER) {
      const from = addrFromTopic(log.topics?.[1]);
      const to = addrFromTopic(log.topics?.[2]);
      steps.push({
        kind: "event",
        title: `Token transfer — ${usdc(log.data)}`,
        detail: `${label(from, known)} → ${label(to, known)}`,
      });
      continue;
    }

    if (topic0 === DEPOSITED) {
      steps.push({
        kind: "event",
        title: `Vault deposit — ${usdc(log.data)}`,
        detail: `by ${label(addrFromTopic(log.topics?.[1]), known)} (a legitimate user)`,
      });
      continue;
    }

    if (topic0 === WITHDRAWN) {
      steps.push({
        kind: "event",
        title: `Vault withdrawal — ${usdc(log.data)}`,
        detail: `to ${label(addrFromTopic(log.topics?.[1]), known)}`,
      });
      continue;
    }

    if (topic0 === APPROVAL) continue; // setup noise, not evidence

    steps.push({
      kind: "event",
      title: `Event from ${label(addr, known)}`,
      detail: `topic ${topic0.slice(0, 18)}…`,
    });
  }

  // Any harness lines that had no matching console entry (defensive).
  for (let i = consoleSeen; i < decodedLogs.length; i++) {
    const step = fromHarnessLine(decodedLogs[i] ?? "");
    if (step) steps.push(step);
  }

  return steps.map((s, i) => ({ ...s, seq: i + 1 }));
}
