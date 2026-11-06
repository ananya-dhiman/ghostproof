/**
 * First line of defence. Every submission is hostile code until proven
 * otherwise, and this runs before we spend a single second on compilation.
 *
 * Foundry cheatcodes are the threat here, not Solidity itself. A submitted
 * test runs with the full `vm` surface, so without this it could read our
 * environment (`vm.envString("BACKEND_PRIVATE_KEY")`), read and write files,
 * shell out (`vm.ffi`), or point the fork at an arbitrary RPC.
 *
 * Defence in depth: foundry.toml also sets `ffi = false` and empty
 * `fs_permissions`, and we spawn forge with a scrubbed environment. This check
 * is the cheap one that also gives the hacker a clear reason for rejection.
 */
import { keccak256, toHex } from "viem";

export interface GuardResult {
  ok: boolean;
  /** Human-readable, safe to show the submitter. */
  reason?: string;
}

interface Banned {
  pattern: RegExp;
  reason: string;
}

const BANNED: Banned[] = [
  {
    pattern: /\bvm\s*\.\s*ffi\b/,
    reason: "vm.ffi (shelling out to the host) is not allowed",
  },
  {
    pattern: /\bvm\s*\.\s*env[A-Za-z]*\s*\(/,
    reason: "vm.env* (reading our environment variables) is not allowed",
  },
  {
    pattern: /\bvm\s*\.\s*(readFile|readLine|readDir|writeFile|writeLine|removeFile|copyFile|createDir|closeFile|fsMetadata|exists|isFile|isDir)\s*\(/,
    reason: "filesystem cheatcodes are not allowed",
  },
  {
    pattern: /\bvm\s*\.\s*rpc\s*\(/,
    reason: "vm.rpc (calling an arbitrary RPC endpoint) is not allowed",
  },
  {
    pattern: /\bvm\s*\.\s*(getCode|getDeployedCode)\s*\(/,
    reason: "vm.getCode reads artifacts off disk and is not allowed",
  },
  {
    pattern: /\bvm\s*\.\s*(sleep|breakpoint|pauseGasMetering)\s*\(/,
    reason: "cheatcodes that stall the run are not allowed",
  },
  {
    pattern: /\bvm\s*\.\s*(serializeJson|writeJson|writeToml)\s*\(/,
    reason: "writing files via the json/toml cheatcodes is not allowed",
  },
];

/** `import "/etc/passwd"` or `import "C:\..."` — only relative imports allowed. */
const ABSOLUTE_IMPORT =
  /\bimport\s+(?:\{[^}]*\}\s+from\s+)?["'](?:\/|[A-Za-z]:[\\/]|\\\\)/;

/** vm.createFork / createSelectFork pointed at anything but our local anvil. */
const CREATE_FORK = /\bvm\s*\.\s*create(?:Select)?Fork\s*\(\s*(["'`])([^"'`]*)\1/g;

const LOCAL_RPC = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/;

export function guardExploitSource(source: string, maxBytes: number): GuardResult {
  if (typeof source !== "string" || source.trim().length === 0) {
    return { ok: false, reason: "exploitSource is empty" };
  }

  const bytes = Buffer.byteLength(source, "utf8");
  if (bytes > maxBytes) {
    return {
      ok: false,
      reason: `submission is ${bytes} bytes, limit is ${maxBytes}`,
    };
  }

  // Strip comments before matching so a banned call cannot hide behind a
  // `/* */` that the Solidity compiler would ignore but our regex would not —
  // and so that a mention in a comment is not a false positive.
  const code = stripComments(source);

  for (const { pattern, reason } of BANNED) {
    if (pattern.test(code)) return { ok: false, reason };
  }

  if (ABSOLUTE_IMPORT.test(code)) {
    return { ok: false, reason: "imports must be relative, not absolute paths" };
  }

  for (const match of code.matchAll(CREATE_FORK)) {
    const url = match[2] ?? "";
    if (!LOCAL_RPC.test(url)) {
      return {
        ok: false,
        reason: "vm.createFork may only target the local sandbox node",
      };
    }
  }

  if (!/function\s+run\s*\(/.test(code)) {
    return {
      ok: false,
      reason:
        "the submission must expose `function run(VulnerableVault vault) external`",
    };
  }

  return { ok: true };
}

/**
 * The name of the contract to instantiate in the harness: the first contract
 * that declares a `run(` function. Returns null if none is found (the guard
 * should have caught that already).
 */
export function findExploitContract(source: string): string | null {
  const code = stripComments(source);
  const contractRe = /\bcontract\s+(\w+)/g;
  const contracts: { name: string; start: number }[] = [];
  for (const m of code.matchAll(contractRe)) {
    contracts.push({ name: m[1]!, start: m.index ?? 0 });
  }
  for (let i = 0; i < contracts.length; i++) {
    const start = contracts[i]!.start;
    const end = i + 1 < contracts.length ? contracts[i + 1]!.start : code.length;
    if (/function\s+run\s*\(/.test(code.slice(start, end))) {
      return contracts[i]!.name;
    }
  }
  return contracts[0]?.name ?? null;
}

/**
 * Hash used for duplicate detection. Comments and whitespace are normalised so
 * that reformatting or re-commenting the same attack does not earn a second
 * payout.
 */
export function hashExploit(source: string): `0x${string}` {
  const normalised = stripComments(source).replace(/\s+/g, " ").trim();
  return keccak256(toHex(normalised));
}

/** Removes // line comments and block comments, preserving string literals. */
export function stripComments(source: string): string {
  let out = "";
  let i = 0;
  const n = source.length;

  while (i < n) {
    const ch = source[i]!;
    const next = source[i + 1];

    // string literal — copy verbatim, respecting escapes
    if (ch === '"' || ch === "'") {
      const quote = ch;
      out += ch;
      i += 1;
      while (i < n) {
        const c = source[i]!;
        out += c;
        i += 1;
        if (c === "\\") {
          if (i < n) {
            out += source[i]!;
            i += 1;
          }
          continue;
        }
        if (c === quote) break;
      }
      continue;
    }

    if (ch === "/" && next === "/") {
      while (i < n && source[i] !== "\n") i += 1;
      continue;
    }

    if (ch === "/" && next === "*") {
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) i += 1;
      i += 2;
      out += " ";
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}
