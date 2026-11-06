/**
 * Runs `forge test --json` in a sandbox directory with a scrubbed environment
 * and a hard timeout.
 *
 * Hostile-code containment (three layers, this is the third):
 *   1. guard.ts rejected dangerous cheatcodes before we got here.
 *   2. foundry.toml has ffi off and fs_permissions empty.
 *   3. here: the child process gets NO secrets in its environment, and is
 *      hard-killed if it runs long.
 */
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { env } from "../env.js";

export interface ForgeRun {
  /** true if forge exited 0 (tests compiled and ran). */
  ok: boolean;
  stdout: string;
  stderr: string;
  /** true if the run was killed for exceeding the timeout. */
  timedOut: boolean;
}

export interface ForgeOptions {
  /** When set, forge forks this RPC so the harness runs against live chain state. */
  forkUrl?: string;
  /** Pin the fork to a block for determinism. */
  forkBlock?: bigint;
}

/** Locate the forge binary: PATH first, then the default foundryup location. */
function forgeBin(): string {
  // execFile resolves a bare name against PATH; the fallback covers a server
  // started without the foundry bin on PATH.
  const home = os.homedir();
  const candidate = path.join(home, ".foundry", "bin", "forge.exe");
  return process.env.FORGE_BIN || candidate;
}

/**
 * A minimal environment: start from the current one, then delete anything that
 * looks like a secret or an RPC endpoint. forge still needs USERPROFILE/PATH to
 * find its solc cache (~/.svm) and binaries, so we keep those.
 */
function scrubbedEnv(): NodeJS.ProcessEnv {
  const clone: NodeJS.ProcessEnv = { ...process.env };
  const danger = /KEY|SECRET|TOKEN|MNEMONIC|PRIVATE|PASSWORD|RPC_URL|ANTHROPIC/i;
  for (const name of Object.keys(clone)) {
    if (danger.test(name)) delete clone[name];
  }
  // Ensure the foundry bin is reachable even if the server's PATH lacked it.
  const foundryBin = path.join(os.homedir(), ".foundry", "bin");
  clone.PATH = `${foundryBin}${path.delimiter}${clone.PATH ?? ""}`;
  // Belt and braces: forge must never see a fork RPC here (B1/B2 are local).
  delete clone.SEPOLIA_RPC_URL;
  return clone;
}

export function runForge(dir: string, opts: ForgeOptions = {}): Promise<ForgeRun> {
  const args = ["test", "--json", "-vv", "--match-contract", "Harness"];
  if (opts.forkUrl) {
    args.push("--fork-url", opts.forkUrl);
    if (opts.forkBlock !== undefined) {
      args.push("--fork-block-number", opts.forkBlock.toString());
    }
  }
  return new Promise((resolve) => {
    const child = execFile(
      forgeBin(),
      args,
      {
        cwd: dir,
        env: scrubbedEnv(),
        timeout: env.forgeTimeoutMs,
        killSignal: "SIGKILL",
        windowsHide: true,
        maxBuffer: 32 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        const timedOut =
          Boolean(error) &&
          (error as NodeJS.ErrnoException & { killed?: boolean }).killed === true;
        resolve({
          ok: !error,
          stdout: stdout ?? "",
          stderr: stderr ?? "",
          timedOut,
        });
      },
    );
    child.on("error", () => {
      /* resolved by the execFile callback */
    });
  });
}
