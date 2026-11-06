// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {VulnerableVault} from "../src/VulnerableVault.sol";
import {BountyPool} from "../src/BountyPool.sol";

/// @notice Deploys the demo stack to Sepolia and seeds it:
///   - MockUSDC (demo token)
///   - VulnerableVault with a 1000 USDC victim deposit
///   - BountyPool funded with 2000 USDC, settler set
///
/// Run (see contracts/README.md):
///   forge script script/Deploy.s.sol --rpc-url sepolia --broadcast
/// Env:
///   PRIVATE_KEY  deployer key (also the company/owner)
///   SETTLER      checker backend address (defaults to the deployer)
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address me = vm.addr(pk);
        address settler = vm.envOr("SETTLER", me);

        vm.startBroadcast(pk);

        MockUSDC usdc = new MockUSDC();
        VulnerableVault vault = new VulnerableVault(usdc);
        BountyPool pool = new BountyPool(usdc, 50e6, 1000e6);
        pool.setSettler(settler);

        usdc.mint(me, 5000e6);

        usdc.approve(address(vault), 1000e6);
        vault.deposit(1000e6);

        usdc.approve(address(pool), 2000e6);
        pool.fundPool(2000e6);

        vm.stopBroadcast();

        console.log("USDC   :", address(usdc));
        console.log("Vault  :", address(vault));
        console.log("Pool   :", address(pool));
        console.log("Settler:", settler);
    }
}
