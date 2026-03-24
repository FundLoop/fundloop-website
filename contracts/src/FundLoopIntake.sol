// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract FundLoopIntake is Ownable {
    using SafeERC20 for IERC20;

    error ZeroAmount();
    error InvalidProjectId();
    error NativeDepositsDisabled();
    error TokenNotAllowed(address token);
    error InvalidTreasury();

    event Deposit(
        uint256 indexed projectId,
        address indexed asset,
        uint256 amount,
        address indexed sender,
        address treasury,
        bool isNative
    );
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event NativeDepositsEnabled(bool enabled);
    event TokenAllowanceUpdated(address indexed token, bool allowed);

    address public treasury;
    bool public nativeDepositsAllowed = true;
    mapping(address => bool) public allowedTokens;

    constructor(address initialOwner, address initialTreasury) Ownable(initialOwner) {
        if (initialTreasury == address(0)) revert InvalidTreasury();
        treasury = initialTreasury;
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidTreasury();
        address previousTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(previousTreasury, newTreasury);
    }

    function setNativeDepositsAllowed(bool enabled) external onlyOwner {
        nativeDepositsAllowed = enabled;
        emit NativeDepositsEnabled(enabled);
    }

    function setAllowedToken(address token, bool allowed) external onlyOwner {
        allowedTokens[token] = allowed;
        emit TokenAllowanceUpdated(token, allowed);
    }

    function depositNative(uint256 projectId) external payable {
        if (projectId == 0) revert InvalidProjectId();
        if (!nativeDepositsAllowed) revert NativeDepositsDisabled();
        if (msg.value == 0) revert ZeroAmount();

        (bool success, ) = treasury.call{ value: msg.value }("");
        require(success, "TREASURY_TRANSFER_FAILED");

        emit Deposit(projectId, address(0), msg.value, msg.sender, treasury, true);
    }

    function depositToken(uint256 projectId, address token, uint256 amount) external {
        if (projectId == 0) revert InvalidProjectId();
        if (amount == 0) revert ZeroAmount();
        if (!allowedTokens[token]) revert TokenNotAllowed(token);

        IERC20(token).safeTransferFrom(msg.sender, treasury, amount);

        emit Deposit(projectId, token, amount, msg.sender, treasury, false);
    }
}
