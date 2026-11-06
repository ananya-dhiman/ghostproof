// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "./interfaces/IERC20.sol";

/// @title VulnerableVault
/// @notice DEMO TARGET — contains an INTENTIONAL security bug for the Ghostproof demo.
///         Users deposit USDC; the vault tracks each user's balance.
///
///         THE BUG: `emergencyWithdraw` was meant to be owner-only, but the access check
///         was never added, so ANY account can drain the entire vault. A hacker's exploit
///         demonstrates this, our checker measures the drained amount on a fork, and the
///         company's "no-theft" rule is broken (Critical).
///
///         Do not use outside the demo.
contract VulnerableVault {
    IERC20 public immutable token;
    address public owner;
    mapping(address => uint256) public deposits;
    uint256 public totalDeposits;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    constructor(IERC20 _token) {
        token = _token;
        owner = msg.sender;
    }

    function deposit(uint256 amount) external {
        require(token.transferFrom(msg.sender, address(this), amount), "transfer failed");
        deposits[msg.sender] += amount;
        totalDeposits += amount;
        emit Deposited(msg.sender, amount);
    }

    /// @notice Safe withdrawal of your OWN funds.
    function withdraw(uint256 amount) external {
        require(deposits[msg.sender] >= amount, "insufficient");
        deposits[msg.sender] -= amount;
        totalDeposits -= amount;
        require(token.transfer(msg.sender, amount), "transfer failed");
        emit Withdrawn(msg.sender, amount);
    }

    /// @dev INTENTIONAL BUG: intended to be onlyOwner for emergencies, but the access check
    ///      is missing. Any caller drains the whole vault to themselves.
    function emergencyWithdraw() external {
        uint256 bal = token.balanceOf(address(this));
        totalDeposits = 0;
        require(token.transfer(msg.sender, bal), "transfer failed");
        emit Withdrawn(msg.sender, bal);
    }
}
