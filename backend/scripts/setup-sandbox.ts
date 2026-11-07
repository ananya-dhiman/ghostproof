/**
 * Installs the checker sandbox's one external dependency: forge-std.
 *
 * `sandbox-template/.gitignore` deliberately keeps `lib/` out of git — forge-std
 * is a public dependency, not ours to vendor — so a fresh clone has no copy of
 * it and the checker cannot compile a single submission until this has run.
 *
 * Idempotent: does nothing if forge-std is already there. Wired to `postinstall`
 * so `npm install` sets it up, and called again by the checker before its first
 * run so a clone installed with `--ignore-scripts` still self-heals.
 */
import { spawn } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.resolve(here, "../sandbox-template");
const LIB_DIR = path.join(TEMPLATE_DIR, "lib");
const FORGE_STD_DIR = path.join(LIB_DIR, "forge-std");
const SENTINEL = path.join(FORGE_STD_DIR, "src", "Test.sol");

const REPO = "https://github.com/foundry-rs/forge-std";

export async function forgeStdInstalled(): Promise<boolean> {
  try {
    await access(SENTINEL);
    return true;
  } catch {
    return false;
  }
}

function run(cmd: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: "inherit", shell: false });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`)),
    );
  });
}

/**
 * Ensure forge-std is present. Returns true if it is (already, or after
 * installing). Never throws: the caller decides how loudly to complain, because
 * during `postinstall` a missing network should not fail the whole install.
 */
export async function ensureForgeStd(): Promise<boolean> {
  if (await forgeStdInstalled()) return true;

  console.log("[setup-sandbox] forge-std missing — cloning into sandbox-template/lib …");
  try {
    await mkdir(LIB_DIR, { recursive: true });
    await run("git", ["clone", "--depth", "1", "--quiet", REPO, FORGE_STD_DIR], TEMPLATE_DIR);
  } catch (err) {
    console.error(
      "[setup-sandbox] could not install forge-std:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }

  const ok = await forgeStdInstalled();
  console.log(
    ok
      ? "[setup-sandbox] forge-std installed."
      : "[setup-sandbox] clone finished but forge-std still looks incomplete.",
  );
  return ok;
}

// Run directly (postinstall / manual): report, but never fail the install.
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const ok = await ensureForgeStd();
  if (!ok) {
    console.error(
      "[setup-sandbox] The checker will reject every submission until forge-std exists.\n" +
        "              Fix it with:  cd backend/sandbox-template && forge install foundry-rs/forge-std",
    );
  }
}
