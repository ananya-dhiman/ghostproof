// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "./interfaces/IERC20.sol";

/// @title BountyPool
/// @notice Holds a company's USDC bounty pool and pays hackers. The AUTOMATIC payout for a
///         confirmed bug is capped by a per-report limit the company set in advance; anything
///         above that is a manual bonus the company chooses. The pool cannot be withdrawn
///         while a report is open.
///
///         Severity: 1 = Medium, 2 = High, 3 = Critical. `tierAmount[severity]` is what a
///         confirmed bug of that severity is worth; the automatic base is
///         min(tierAmount, autoPayLimit), further capped by the month's remaining allowance.
///
///         DEMO NOTE: `settleReport` is called by an authorised `settler` (our checker
///         backend) which has replayed the exploit on a fork and run the company's pre-written
///         rules. In production the settler would be a sealed, publicly-inspectable checker and
///         this call would verify its signature; here we trust the settler address, and the
///         `sig` argument is reserved for that future check.
contract BountyPool {
    enum Status { None, BasePaid, BonusAdded }

    IERC20 public immutable usdc;
    address public owner; // the company
    address public settler; // the checker backend

    uint256 public autoPayLimit; // max automatic payout per report
    uint256 public monthlyCap; // max automatic USDC per 30 days
    mapping(uint8 => uint256) public tierAmount; // severity => amount

    uint256 public openReports; // pool locked while > 0
    uint256 public paidThisMonth;
    uint256 public monthStart;

    struct Report {
        Status status;
        address hacker;
        uint8 severity;
        uint256 basePaid;
        uint256 bonus;
        bool closed;
    }

    mapping(bytes32 => Report) public reports;

    event PoolFunded(uint256 amount);
    event PoolWithdrawn(uint256 amount);
    event BasePaid(bytes32 indexed id, address indexed hacker, uint8 severity, uint256 amount);
    event BonusAdded(bytes32 indexed id, address indexed hacker, uint256 amount);
    event ReportClosed(bytes32 indexed id);
    event SettlerChanged(address settler);
    event ConfigChanged(uint256 autoPayLimit, uint256 monthlyCap);
    event TierChanged(uint8 severity, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlySettler() {
        require(msg.sender == settler, "not settler");
        _;
    }

    constructor(IERC20 _usdc, uint256 _autoPayLimit, uint256 _monthlyCap) {
        usdc = _usdc;
        owner = msg.sender;
        autoPayLimit = _autoPayLimit;
        monthlyCap = _monthlyCap;
        monthStart = block.timestamp;
        // demo defaults; the company can change these via setTier
        tierAmount[1] = 50e6; // Medium   = 50 USDC
        tierAmount[2] = 200e6; // High    = 200 USDC
        tierAmount[3] = 500e6; // Critical = 500 USDC
    }

    // --- configuration (company) ---

    function setSettler(address _settler) external onlyOwner {
        settler = _settler;
        emit SettlerChanged(_settler);
    }

    function setConfig(uint256 _autoPayLimit, uint256 _monthlyCap) external onlyOwner {
        autoPayLimit = _autoPayLimit;
        monthlyCap = _monthlyCap;
        emit ConfigChanged(_autoPayLimit, _monthlyCap);
    }

    function setTier(uint8 severity, uint256 amount) external onlyOwner {
        tierAmount[severity] = amount;
        emit TierChanged(severity, amount);
    }

    function getConfig()
        external
        view
        returns (uint256 limit, uint256 cap, uint256 medium, uint256 high, uint256 critical)
    {
        return (autoPayLimit, monthlyCap, tierAmount[1], tierAmount[2], tierAmount[3]);
    }

    // --- funding / withdrawal (company) ---

    function fundPool(uint256 amount) external onlyOwner {
        require(usdc.transferFrom(msg.sender, address(this), amount), "transfer failed");
        emit PoolFunded(amount);
    }

    function withdrawPool(uint256 amount) external onlyOwner {
        require(openReports == 0, "reports open");
        require(usdc.transfer(owner, amount), "transfer failed");
        emit PoolWithdrawn(amount);
    }

    // --- report lifecycle (settler = checker backend) ---

    /// @notice Open a confirmed report and pay the automatic base in one call. The pool locks
    ///         (openReports++) until the report is closed. Returns the amount paid.
    function settleReport(bytes32 id, address hacker, uint8 severity, bytes calldata /*sig*/ )
        external
        onlySettler
        returns (uint256 amount)
    {
        require(reports[id].status == Status.None, "exists");
        _rollMonth();

        uint256 tier = tierAmount[severity];
        amount = tier < autoPayLimit ? tier : autoPayLimit;
        uint256 remaining = monthlyCap > paidThisMonth ? monthlyCap - paidThisMonth : 0;
        if (amount > remaining) amount = remaining;

        reports[id] =
            Report({status: Status.BasePaid, hacker: hacker, severity: severity, basePaid: amount, bonus: 0, closed: false});
        openReports++;
        paidThisMonth += amount;

        if (amount > 0) require(usdc.transfer(hacker, amount), "transfer failed");
        emit BasePaid(id, hacker, severity, amount);
    }

    /// @notice Company's optional extra reward above the automatic base.
    function addBonus(bytes32 id, uint256 amount) external onlyOwner {
        Report storage r = reports[id];
        require(r.status != Status.None, "no report");
        r.bonus += amount;
        r.status = Status.BonusAdded;
        require(usdc.transfer(r.hacker, amount), "transfer failed");
        emit BonusAdded(id, r.hacker, amount);
    }

    /// @notice Close a resolved report, unlocking the pool.
    function closeReport(bytes32 id) external onlySettler {
        Report storage r = reports[id];
        require(r.status != Status.None && !r.closed, "bad state");
        r.closed = true;
        openReports--;
        emit ReportClosed(id);
    }

    function _rollMonth() internal {
        if (block.timestamp >= monthStart + 30 days) {
            monthStart = block.timestamp;
            paidThisMonth = 0;
        }
    }
}
