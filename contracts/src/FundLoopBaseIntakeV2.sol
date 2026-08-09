// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Non-production Base stablecoin intake with separated fee and epoch treasuries.
contract FundLoopBaseIntakeV2 is Ownable, Pausable {
    using SafeERC20 for IERC20;

    uint16 public constant MAX_PROJECT_FEE_BPS = 1_000;
    string public constant CONTRACT_VERSION = "fundloop-base-intake-v2";

    enum BaseAsset { USDC, USDT, PYUSD }

    error ZeroAmount();
    error InvalidProjectId();
    error InvalidAccountingPeriod();
    error InvalidTreasury();
    error DuplicateTreasury();
    error InvalidToken();
    error TokenNotAllowed(address token);
    error TokenNotProviderApproved(address token);
    error FeeTooHigh(uint16 feeBps);
    error ReceiptReferenceUsed(bytes32 receiptReference);

    event BaseReceipt(
        bytes32 indexed receiptReference,
        uint256 indexed projectId,
        uint256 indexed accountingPeriodId,
        address token,
        address sender,
        uint256 grossAmount,
        uint16 projectFeeBps,
        uint256 feeAmount,
        uint256 netEpochAmount,
        address platformTreasury,
        address epochTreasury
    );
    event BaseTreasuriesUpdated(address indexed platformTreasury, address indexed epochTreasury);
    event BaseTokenConfigured(BaseAsset indexed asset, address indexed token, bool enabled);
    event ProjectFeeConfigured(uint256 indexed projectId, uint16 feeBps);
    event PlatformFeeTransferred(bytes32 indexed receiptReference, address indexed token, address indexed treasury, uint256 amount);
    event EpochTreasuryFunded(bytes32 indexed receiptReference, address indexed token, address indexed treasury, uint256 amount);

    address public platformTreasury;
    address public epochTreasury;
    mapping(BaseAsset => address) public tokenForAsset;
    mapping(BaseAsset => bool) public providerApprovedAsset;
    mapping(address => bool) public allowedTokens;
    mapping(uint256 => uint16) public projectFeeBps;
    mapping(bytes32 => bool) public usedReceiptReferences;

    constructor(
        address initialOwner,
        address initialPlatformTreasury,
        address initialEpochTreasury,
        address usdc,
        address usdt,
        address pyusd,
        bool usdcProviderApproved,
        bool usdtProviderApproved,
        bool pyusdProviderApproved
    ) Ownable(initialOwner) {
        _setTreasuries(initialPlatformTreasury, initialEpochTreasury);
        _configureToken(BaseAsset.USDC, usdc, usdcProviderApproved);
        _configureToken(BaseAsset.USDT, usdt, usdtProviderApproved);
        _configureToken(BaseAsset.PYUSD, pyusd, pyusdProviderApproved);
    }

    function setPaused(bool paused) external onlyOwner {
        if (paused) _pause();
        else _unpause();
    }

    function setTreasuries(address nextPlatformTreasury, address nextEpochTreasury) external onlyOwner {
        _setTreasuries(nextPlatformTreasury, nextEpochTreasury);
    }

    function setTokenEnabled(BaseAsset asset, bool enabled) external onlyOwner {
        address token = tokenForAsset[asset];
        if (enabled && !providerApprovedAsset[asset]) revert TokenNotProviderApproved(token);
        if (token == address(0)) revert InvalidToken();
        allowedTokens[token] = enabled;
        emit BaseTokenConfigured(asset, token, enabled);
    }

    function setProjectFeeBps(uint256 projectId, uint16 feeBps) external onlyOwner {
        if (projectId == 0) revert InvalidProjectId();
        if (feeBps > MAX_PROJECT_FEE_BPS) revert FeeTooHigh(feeBps);
        projectFeeBps[projectId] = feeBps;
        emit ProjectFeeConfigured(projectId, feeBps);
    }

    function deposit(
        uint256 projectId,
        uint256 accountingPeriodId,
        address token,
        uint256 grossAmount,
        bytes32 receiptReference
    ) external whenNotPaused {
        if (projectId == 0) revert InvalidProjectId();
        if (accountingPeriodId == 0) revert InvalidAccountingPeriod();
        if (grossAmount == 0) revert ZeroAmount();
        if (!allowedTokens[token]) revert TokenNotAllowed(token);
        if (usedReceiptReferences[receiptReference]) revert ReceiptReferenceUsed(receiptReference);

        usedReceiptReferences[receiptReference] = true;
        uint16 feeBps = projectFeeBps[projectId];
        uint256 feeAmount = (grossAmount * feeBps) / 10_000;
        uint256 netEpochAmount = grossAmount - feeAmount;

        IERC20(token).safeTransferFrom(msg.sender, platformTreasury, feeAmount);
        IERC20(token).safeTransferFrom(msg.sender, epochTreasury, netEpochAmount);

        emit PlatformFeeTransferred(receiptReference, token, platformTreasury, feeAmount);
        emit EpochTreasuryFunded(receiptReference, token, epochTreasury, netEpochAmount);
        emit BaseReceipt(
            receiptReference,
            projectId,
            accountingPeriodId,
            token,
            msg.sender,
            grossAmount,
            feeBps,
            feeAmount,
            netEpochAmount,
            platformTreasury,
            epochTreasury
        );
    }

    function _setTreasuries(address nextPlatformTreasury, address nextEpochTreasury) private {
        if (nextPlatformTreasury == address(0) || nextEpochTreasury == address(0)) revert InvalidTreasury();
        if (nextPlatformTreasury == nextEpochTreasury) revert DuplicateTreasury();
        platformTreasury = nextPlatformTreasury;
        epochTreasury = nextEpochTreasury;
        emit BaseTreasuriesUpdated(nextPlatformTreasury, nextEpochTreasury);
    }

    function _configureToken(BaseAsset asset, address token, bool approved) private {
        if (token == address(0) && approved) revert InvalidToken();
        address configured = tokenForAsset[asset];
        if (configured != address(0) && configured != token) revert InvalidToken();
        tokenForAsset[asset] = token;
        providerApprovedAsset[asset] = approved;
        if (token != address(0)) allowedTokens[token] = approved;
        emit BaseTokenConfigured(asset, token, approved);
    }
}
