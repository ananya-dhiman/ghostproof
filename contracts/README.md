# Ghostproof contracts (Person A)

Foundry project: the demo target, the bounty pool, and the company's rules.

## Contracts
- `src/VulnerableVault.sol` — demo target with an intentional theft bug (public `emergencyWithdraw`).
- `src/BountyPool.sol` — holds the company's USDC, auto-pays a capped base per confirmed bug, locks while a report is open; the company adds any bonus.
- `src/rules/Rules.sol` — the company's pre-written rules (no-theft = Critical; accounting = Medium).
- `src/mocks/MockUSDC.sol` — 6-decimal test token. No real value.
- `test/exploits/ExploitDrain.sol` — the known-good demo exploit.
- `test/Exploit.t.sol` — proves the exploit works and the no-theft rule catches it (the template the backend runs on a fork).
- `test/BountyPool.t.sol` — tests the money logic.
- `script/Deploy.s.sol` — deploys + seeds the stack on Sepolia.

## Setup
Install Foundry (https://getfoundry.sh), then from `contracts/`:
```bash
forge install foundry-rs/forge-std
forge build
forge test -vv
```

## Deploy to Sepolia
```bash
export PRIVATE_KEY=0x...          # deployer = company/owner (use a throwaway test key)
export SETTLER=0x...              # the checker backend address (optional; defaults to deployer)
export SEPOLIA_RPC_URL=https://...
forge script script/Deploy.s.sol --rpc-url sepolia --broadcast
```
The script prints the USDC, Vault, Pool, and Settler addresses.

## Handoff
After deploying, paste the printed addresses into `../shared/config.ts` (`ADDRESSES`). That file is owned by Person A; B and C read it.

## Safety note
`foundry.toml` sets `ffi = false` and `fs_permissions = []`. The checker backend reuses these settings to run untrusted submitted tests, so a hostile submission cannot touch the host. Keep them off.

Test tokens have no monetary value.
