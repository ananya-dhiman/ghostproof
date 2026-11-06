// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Rules
/// @notice The company's rules, written BEFORE any bug is seen. Each check returns whether
///         the rule was BROKEN and the severity to pay at. The checker backend runs these
///         after replaying a submitted exploit on a fork, comparing before/after state.
///
///         Severity: 1 = Medium, 2 = High, 3 = Critical.
library Rules {
    uint8 internal constant MEDIUM = 1;
    uint8 internal constant HIGH = 2;
    uint8 internal constant CRITICAL = 3;

    /// @notice MANDATORY default rule every company must keep: a fresh attacker account must
    ///         not end up holding the pooled token. Broken if the attacker's balance rose.
    function noTheft(uint256 attackerBalanceBefore, uint256 attackerBalanceAfter)
        internal
        pure
        returns (bool broken, uint8 severity)
    {
        broken = attackerBalanceAfter > attackerBalanceBefore;
        severity = CRITICAL;
    }

    /// @notice Example second rule: the vault's recorded total must match its real token
    ///         balance. Broken if accounting drifts (e.g. a fee or rounding bug). Medium.
    function accountingIntact(uint256 recordedTotal, uint256 realBalance)
        internal
        pure
        returns (bool broken, uint8 severity)
    {
        broken = recordedTotal != realBalance;
        severity = MEDIUM;
    }
}
