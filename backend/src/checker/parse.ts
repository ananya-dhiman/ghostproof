/**
 * Turns `forge test --json` output into the measured facts the checker needs.
 *
 * The harness logs three lines we care about (see sandbox.ts):
 *   GP_MOVED   <wei6>                 USDC (6-decimals) the attacker gained
 *   GP_NOTHEFT <0|1> <severity 1..3>  the mandatory no-theft rule
 *   GP_ACCT    <0|1> <severity 1..3>  the accounting rule
 */
import type { RawLog } from "./replay.js";

export interface ParsedRun {
  compiled: boolean;
  ran: boolean;
  /** raw 6-decimal units moved to the attacker */
  movedRaw: bigint;
  rules: {
    noTheft: { broken: boolean; severity: number };
    accounting: { broken: boolean; severity: number };
  };
  /** raw EVM logs the run emitted, in execution order */
  rawLogs: RawLog[];
  /** forge-decoded console lines, in order */
  decodedLogs: string[];
  /** block the run forked, as forge reported it */
  forkBlockNumber: number;
  /** compiler / runtime error text, safe to show the submitter */
  error: string | null;
}

interface ForgeJsonTest {
  status?: string;
  decoded_logs?: string[];
  logs?: RawLog[];
  fork_block_number?: number;
}
interface ForgeJsonSuite {
  test_results?: Record<string, ForgeJsonTest>;
}

function parseLog(logs: string[], tag: string): number[] {
  const line = logs.find((l) => l.startsWith(tag + " "));
  if (!line) return [];
  return line
    .slice(tag.length + 1)
    .trim()
    .split(/\s+/)
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n));
}

export function parseForgeOutput(stdout: string, stderr: string): ParsedRun {
  const empty: ParsedRun = {
    compiled: false,
    ran: false,
    movedRaw: 0n,
    rawLogs: [],
    decodedLogs: [],
    forkBlockNumber: 0,
    rules: {
      noTheft: { broken: false, severity: 3 },
      accounting: { broken: false, severity: 1 },
    },
    error: null,
  };

  let json: Record<string, ForgeJsonSuite> | null = null;
  try {
    // forge prints the JSON object on stdout; tolerate leading warning lines.
    const start = stdout.indexOf("{");
    if (start >= 0) json = JSON.parse(stdout.slice(start));
  } catch {
    json = null;
  }

  if (!json || Object.keys(json).length === 0) {
    // No parseable results => compilation failed. Surface the solc error.
    return {
      ...empty,
      error: extractCompileError(stderr || stdout),
    };
  }

  // Find our harness test among the suites.
  for (const suite of Object.values(json)) {
    const test = suite.test_results?.["test_check()"];
    if (!test) continue;
    const logs = test.decoded_logs ?? [];

    const moved = parseLog(logs, "GP_MOVED");
    const noTheft = parseLog(logs, "GP_NOTHEFT");
    const acct = parseLog(logs, "GP_ACCT");

    return {
      compiled: true,
      ran: true,
      rawLogs: test.logs ?? [],
      decodedLogs: logs,
      forkBlockNumber: Number(test.fork_block_number ?? 0),
      movedRaw: moved.length ? BigInt(moved[0]!) : 0n,
      rules: {
        noTheft: {
          broken: (noTheft[0] ?? 0) === 1,
          severity: noTheft[1] ?? 3,
        },
        accounting: {
          broken: (acct[0] ?? 0) === 1,
          severity: acct[1] ?? 1,
        },
      },
      error: null,
    };
  }

  // JSON parsed but our test is missing — treat as a compile/setup failure.
  return { ...empty, error: extractCompileError(stderr || stdout) };
}

/** Pull the first meaningful error block out of forge's stderr. */
function extractCompileError(text: string): string {
  if (!text.trim()) return "the exploit failed to compile or run";
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const errIdx = lines.findIndex((l) => /error(\[|:)/i.test(l));
  const slice = errIdx >= 0 ? lines.slice(errIdx, errIdx + 6) : lines.slice(0, 6);
  return slice.join("\n").slice(0, 1000);
}
