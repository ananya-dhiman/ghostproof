// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * THROWAWAY TARGET — backend-only, until Person A deploys the real vault.
 *
 * This exists so the fork runner can be built and tested without waiting on
 * the contracts track. Person A owns the real VulnerableVault.sol.
 *
 * ---------------------------------------------------------------------------
 * IMPORTANT for Person A: a classic re-entrancy does NOT work against plain
 * USDC. Circle's test USDC is a vanilla ERC-20: `transfer` moves a number and
 * returns. It never hands control back to the receiver, so there is no moment
 * to re-enter. Re-entrancy demos use ETH (`call` with value) or a token with a
 * transfer hook (ERC-777 / ERC-1363).
 *
 * So the vault needs ONE of these to be genuinely exploitable in USDC:
 *   (a) an explicit receiver callback before state is written — what this
 *       throwaway does, and the closest thing to the plan's "re-entrancy
 *       withdraw" while keeping USDC as the money; or
 *   (b) a plain accounting bug instead of re-entrancy (e.g. withdraw checks
 *       one mapping and decrements another), which needs no callback at all
 *       and is arguably easier to explain to a non-technical judge.
 *
 * This file implements (a). It is the backend's stand-in, not a vote.
 * ---------------------------------------------------------------------------
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// Receivers may opt in to a notification when the vault pays them out.
interface IWithdrawReceiver {
    function onWithdraw(uint256 amount) external;
}

contract VulnerableVault {
    IERC20 public immutable token;
    mapping(address => uint256) public balanceOf;

    constructor(address token_) {
        token = IERC20(token_);
    }

    function deposit(uint256 amount) external {
        require(token.transferFrom(msg.sender, address(this), amount), "transfer failed");
        balanceOf[msg.sender] += amount;
    }

    /**
     * THE BUG: the receiver is notified, and the tokens are sent, BEFORE the
     * depositor's recorded balance is zeroed. A contract that implements
     * onWithdraw regains control while the vault still believes it owes the
     * full amount, and can call straight back in.
     *
     * The zeroing is what makes the loop profitable rather than reverting:
     * `= 0` is idempotent, so every nested call pays out in full and the
     * unwinding writes cost nothing. (A `-= amount` here would underflow on
     * the way back out and revert the whole attack — which is exactly why the
     * real-world version of this bug zeroes.)
     */
    function withdrawAll() external {
        uint256 amount = balanceOf[msg.sender];
        require(amount > 0, "nothing to withdraw");

        if (msg.sender.code.length > 0) {
            IWithdrawReceiver(msg.sender).onWithdraw(amount);
        }
        require(token.transfer(msg.sender, amount), "transfer failed");

        balanceOf[msg.sender] = 0; // too late
    }

    function totalHeld() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}
