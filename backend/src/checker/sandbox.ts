/**
 * Builds a throwaway Foundry project for one submission.
 *
 * Each run gets its own temp directory so hostile code is isolated and nothing
 * leaks between submissions. The directory holds:
 *   - foundry.toml   (ffi off, fs_permissions empty — the second safety layer)
 *   - src/           (Person A's contracts, vendored in sandbox-template)
 *   - test/submission/Submission.sol  (the submitted exploit, verbatim)
 *   - test/Harness.t.sol              (generated: deploys, measures, runs rules)
 *
 * forge-std is referenced by absolute path from the template's lib, so it is
 * not copied per run.
 */
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureForgeStd } from "../../scripts/setup-sandbox.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const TEMPLATE_DIR = path.resolve(here, "../../sandbox-template");
const FORGE_STD_SRC = path.join(TEMPLATE_DIR, "lib", "forge-std", "src");

export interface Sandbox {
  dir: string;
  cleanup: () => Promise<void>;
}

/** POSIX-style absolute path, which forge's remappings accept on Windows too. */
function fwd(p: string): string {
  return p.replace(/\\/g, "/");
}

function foundryToml(): string {
  return [
    "[profile.default]",
    'src = "src"',
    'out = "out"',
    'test = "test"',
    'solc = "0.8.24"',
    "optimizer = true",
    "optimizer_runs = 200",
    "ffi = false",
    "fs_permissions = []",
    `remappings = ["forge-std/=${fwd(FORGE_STD_SRC)}/", "target/=src/"]`,
    "",
  ].join("\n");
}

/**
 * The generated test. It mirrors Person A's ExploitTest exactly: deploy a fresh
 * MockUSDC + vault, seed a legitimate 1000 USDC deposit, then from a fresh
 * attacker account deploy and run the submission and measure what it took.
 *
 * It never asserts a verdict — it logs measured numbers and the company's rule
 * outcomes (from A's Rules library) in a machine-parseable form, and the
 * backend decides. `run()` is wrapped so a reverting exploit is a measured
 * zero, not a crashed test.
 */
function harness(contractName: string): string {
  return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {MockUSDC} from "target/mocks/MockUSDC.sol";
import {VulnerableVault} from "target/VulnerableVault.sol";
import {Rules} from "target/rules/Rules.sol";
import {${contractName}} from "./submission/Submission.sol";

contract Harness is Test {
    MockUSDC usdc;
    VulnerableVault vault;

    function setUp() public {
        usdc = new MockUSDC();
        vault = new VulnerableVault(usdc);
        address victim = makeAddr("victim");
        usdc.mint(victim, 1000e6);
        vm.startPrank(victim);
        usdc.approve(address(vault), 1000e6);
        vault.deposit(1000e6);
        vm.stopPrank();
    }

    function test_check() public {
        address attacker = makeAddr("attacker");
        ${contractName} exploit = new ${contractName}();

        uint256 beforeBal = usdc.balanceOf(address(exploit));
        vm.prank(attacker);
        try exploit.run(vault) {} catch {}
        uint256 afterBal = usdc.balanceOf(address(exploit));
        uint256 moved = afterBal > beforeBal ? afterBal - beforeBal : 0;

        (bool noTheftBroken, uint8 noTheftSev) = Rules.noTheft(beforeBal, afterBal);
        (bool acctBroken, uint8 acctSev) =
            Rules.accountingIntact(vault.totalDeposits(), usdc.balanceOf(address(vault)));

        console2.log("GP_MOVED", moved);
        console2.log("GP_NOTHEFT", noTheftBroken ? uint256(1) : uint256(0), noTheftSev);
        console2.log("GP_ACCT", acctBroken ? uint256(1) : uint256(0), acctSev);
    }
}
`;
}

/**
 * Fork harness: instead of deploying a fresh vault, attach to the real deployed
 * MockUSDC + VulnerableVault (forge forks Sepolia at the pinned block, so the
 * run sees the live vault's actual balances and depositors). Everything else —
 * fresh attacker, run the submission, measure, apply the rules — is identical.
 */
function forkHarness(contractName: string, usdc: string, vault: string): string {
  return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {MockUSDC} from "target/mocks/MockUSDC.sol";
import {VulnerableVault} from "target/VulnerableVault.sol";
import {Rules} from "target/rules/Rules.sol";
import {${contractName}} from "./submission/Submission.sol";

contract Harness is Test {
    MockUSDC usdc = MockUSDC(${usdc});
    VulnerableVault vault = VulnerableVault(${vault});

    function test_check() public {
        address attacker = makeAddr("attacker");
        ${contractName} exploit = new ${contractName}();

        uint256 beforeBal = usdc.balanceOf(address(exploit));
        vm.prank(attacker);
        try exploit.run(vault) {} catch {}
        uint256 afterBal = usdc.balanceOf(address(exploit));
        uint256 moved = afterBal > beforeBal ? afterBal - beforeBal : 0;

        (bool noTheftBroken, uint8 noTheftSev) = Rules.noTheft(beforeBal, afterBal);
        (bool acctBroken, uint8 acctSev) =
            Rules.accountingIntact(vault.totalDeposits(), usdc.balanceOf(address(vault)));

        console2.log("GP_MOVED", moved);
        console2.log("GP_NOTHEFT", noTheftBroken ? uint256(1) : uint256(0), noTheftSev);
        console2.log("GP_ACCT", acctBroken ? uint256(1) : uint256(0), acctSev);
    }
}
`;
}

export interface SandboxOptions {
  /** Deployed addresses to attach to; when set, generate the fork harness. */
  fork?: { usdc: string; vault: string };
}

export async function buildSandbox(
  exploitSource: string,
  contractName: string,
  opts: SandboxOptions = {},
): Promise<Sandbox> {
  // forge-std is gitignored, so a fresh clone has none and every submission would
  // fail with a confusing solc "Source not found" error. Install it on first use
  // (postinstall normally does it) and fail loudly and usefully if we cannot.
  if (!(await ensureForgeStd())) {
    throw new Error(
      "checker sandbox is not set up: forge-std is missing from backend/sandbox-template/lib. " +
        "Run `npm run setup-sandbox` in backend/, or " +
        "`cd backend/sandbox-template && forge install foundry-rs/forge-std`.",
    );
  }

  const dir = await mkdtemp(path.join(os.tmpdir(), "gp-run-"));
  try {
    await cp(path.join(TEMPLATE_DIR, "src"), path.join(dir, "src"), {
      recursive: true,
    });
    await writeFile(path.join(dir, "foundry.toml"), foundryToml());
    await mkdir(path.join(dir, "test", "submission"), { recursive: true });
    await writeFile(
      path.join(dir, "test", "submission", "Submission.sol"),
      exploitSource,
    );
    const harnessSrc = opts.fork
      ? forkHarness(contractName, opts.fork.usdc, opts.fork.vault)
      : harness(contractName);
    await writeFile(path.join(dir, "test", "Harness.t.sol"), harnessSrc);
  } catch (err) {
    await rm(dir, { recursive: true, force: true });
    throw err;
  }
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}
