// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {BountyPool} from "../src/BountyPool.sol";

contract BountyPoolTest is Test {
    MockUSDC usdc;
    BountyPool pool;
    address company; // = this test contract (pool owner)
    address backend;
    address hacker;

    bytes32 constant RID = keccak256("rep_001");

    function setUp() public {
        company = address(this);
        backend = makeAddr("backend");
        hacker = makeAddr("hacker");

        usdc = new MockUSDC();
        pool = new BountyPool(usdc, 50e6, 1000e6); // auto limit 50, monthly cap 1000
        pool.setSettler(backend);
        usdc.mint(company, 2000e6);
        usdc.approve(address(pool), 2000e6);
        pool.fundPool(2000e6); // company balance now 0, pool holds 2000
    }

    function test_autoPaysBaseCappedAtLimit() public {
        // Critical tier is 500, but the auto limit is 50 -> pays 50 automatically
        vm.prank(backend);
        uint256 paid = pool.settleReport(RID, hacker, 3, "");
        assertEq(paid, 50e6);
        assertEq(usdc.balanceOf(hacker), 50e6);
    }

    function test_companyAddsBonusOnTop() public {
        vm.prank(backend);
        pool.settleReport(RID, hacker, 3, "");
        pool.addBonus(RID, 450e6); // company tops the hacker up to the 500 Critical tier
        assertEq(usdc.balanceOf(hacker), 500e6);
    }

    function test_poolLockedWhileReportOpen() public {
        vm.prank(backend);
        pool.settleReport(RID, hacker, 3, "");

        vm.expectRevert(bytes("reports open"));
        pool.withdrawPool(100e6);

        vm.prank(backend);
        pool.closeReport(RID);

        pool.withdrawPool(100e6); // now allowed
        assertEq(usdc.balanceOf(company), 100e6);
    }

    function test_onlySettlerCanSettle() public {
        vm.expectRevert(bytes("not settler"));
        pool.settleReport(RID, hacker, 3, "");
    }
}
