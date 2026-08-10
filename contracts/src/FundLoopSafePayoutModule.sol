// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ISafeModuleExecutor {
    function execTransactionFromModule(address to, uint256 value, bytes calldata data, uint8 operation)
        external returns (bool success);
}

interface IPayoutGasSponsor {
    function sponsor(bytes32 requestHash, address payable recipient, uint256 amount) external;
}

/// @notice Review-only Safe module enforcing independently bounded FundLoop payouts.
/// @dev Deployment still requires Safe owner-threshold approval; this contract never owns treasury assets.
contract FundLoopSafePayoutModule is Ownable, Pausable {
    error UnauthorizedSigner();
    error InvalidRequest();
    error RequestNotAuthorized();
    error RequestAlreadyUsed();
    error TokenNotAllowed();
    error TransactionLimitExceeded();
    error RollingLimitExceeded();
    error EpochLimitExceeded();
    error RequestExpired();
    error SafeExecutionFailed();

    struct Execution {
        uint64 executedAt;
        uint192 amount;
    }

    ISafeModuleExecutor public immutable safe;
    IPayoutGasSponsor public immutable gasSponsor;
    address public limitedSigner;
    uint256 public maxPerTransaction;
    uint256 public maxRolling24Hours;
    uint256 public maxPerEpoch;
    mapping(address token => bool enabled) public allowedTokens;
    mapping(bytes32 requestHash => bool authorized) public authorizedRequests;
    mapping(bytes32 requestHash => bool used) public usedRequests;
    mapping(bytes32 epochKey => uint256 amount) public epochUsage;
    Execution[] private executions;

    event LimitedSignerChanged(address indexed previousSigner, address indexed newSigner);
    event TokenPermissionChanged(address indexed token, bool enabled);
    event LimitsChanged(uint256 perTransaction, uint256 rolling24Hours, uint256 perEpoch);
    event RequestAuthorized(bytes32 indexed requestHash);
    event PayoutExecuted(
        bytes32 indexed requestHash,
        bytes32 indexed epochKey,
        address indexed token,
        address recipient,
        uint256 recipientAmount,
        address feeRecipient,
        uint256 feeAmount,
        uint256 gasBudget
    );

    constructor(address safeAddress, address signer, address gasSponsorAddress, uint256 perTransaction, uint256 rolling24Hours, uint256 perEpoch)
        Ownable(safeAddress)
    {
        if (safeAddress == address(0) || signer == address(0) || gasSponsorAddress == address(0) || perTransaction == 0 || rolling24Hours < perTransaction || perEpoch < perTransaction) {
            revert InvalidRequest();
        }
        safe = ISafeModuleExecutor(safeAddress);
        gasSponsor = IPayoutGasSponsor(gasSponsorAddress);
        limitedSigner = signer;
        maxPerTransaction = perTransaction;
        maxRolling24Hours = rolling24Hours;
        maxPerEpoch = perEpoch;
    }

    function requestHash(
        address token,
        address recipient,
        uint256 recipientAmount,
        address feeRecipient,
        uint256 feeAmount,
        uint256 gasBudget,
        bytes32 epochKey,
        uint64 expiresAt,
        uint256 nonce
    )
        public view returns (bytes32)
    {
        return keccak256(abi.encode(address(this), block.chainid, address(safe), address(gasSponsor), token, recipient, recipientAmount, feeRecipient, feeAmount, gasBudget, epochKey, expiresAt, nonce));
    }

    function authorizeRequest(bytes32 hash) external onlyOwner {
        if (hash == bytes32(0) || usedRequests[hash]) revert InvalidRequest();
        authorizedRequests[hash] = true;
        emit RequestAuthorized(hash);
    }

    function executePayout(
        address token,
        address recipient,
        uint256 recipientAmount,
        address feeRecipient,
        uint256 feeAmount,
        uint256 gasBudget,
        bytes32 epochKey,
        uint64 expiresAt,
        uint256 nonce
    )
        external whenNotPaused
    {
        if (msg.sender != limitedSigner) revert UnauthorizedSigner();
        if (!allowedTokens[token]) revert TokenNotAllowed();
        if (recipient == address(0) || recipientAmount == 0 || epochKey == bytes32(0) || (feeAmount > 0 && feeRecipient == address(0))) revert InvalidRequest();
        if (block.timestamp > expiresAt) revert RequestExpired();
        uint256 totalAmount = recipientAmount + feeAmount;
        bytes32 hash = requestHash(token, recipient, recipientAmount, feeRecipient, feeAmount, gasBudget, epochKey, expiresAt, nonce);
        if (usedRequests[hash]) revert RequestAlreadyUsed();
        if (!authorizedRequests[hash]) revert RequestNotAuthorized();
        if (totalAmount > maxPerTransaction) revert TransactionLimitExceeded();

        usedRequests[hash] = true;
        authorizedRequests[hash] = false;
        _recordUsage(epochKey, totalAmount);
        _executeTransfers(token, recipient, recipientAmount, feeRecipient, feeAmount);
        gasSponsor.sponsor(hash, payable(limitedSigner), gasBudget);
        emit PayoutExecuted(hash, epochKey, token, recipient, recipientAmount, feeRecipient, feeAmount, gasBudget);
    }

    function _recordUsage(bytes32 epochKey, uint256 totalAmount) private {
        uint256 rollingUsage;
        uint256 cutoff = block.timestamp > 1 days ? block.timestamp - 1 days : 0;
        for (uint256 index = executions.length; index > 0; index--) {
            Execution memory item = executions[index - 1];
            if (item.executedAt <= cutoff) break;
            rollingUsage += item.amount;
        }
        if (rollingUsage + totalAmount > maxRolling24Hours) revert RollingLimitExceeded();
        if (epochUsage[epochKey] + totalAmount > maxPerEpoch) revert EpochLimitExceeded();
        epochUsage[epochKey] += totalAmount;
        executions.push(Execution(uint64(block.timestamp), uint192(totalAmount)));
    }

    function _executeTransfers(address token, address recipient, uint256 recipientAmount, address feeRecipient, uint256 feeAmount) private {
        bool success = safe.execTransactionFromModule(token, 0, abi.encodeCall(IERC20.transfer, (recipient, recipientAmount)), 0);
        if (!success) revert SafeExecutionFailed();
        if (feeAmount > 0) {
            success = safe.execTransactionFromModule(token, 0, abi.encodeCall(IERC20.transfer, (feeRecipient, feeAmount)), 0);
            if (!success) revert SafeExecutionFailed();
        }
    }

    function setTokenAllowed(address token, bool enabled) external onlyOwner {
        if (token == address(0)) revert InvalidRequest();
        allowedTokens[token] = enabled;
        emit TokenPermissionChanged(token, enabled);
    }

    function setLimits(uint256 perTransaction, uint256 rolling24Hours, uint256 perEpoch) external onlyOwner {
        if (perTransaction == 0 || rolling24Hours < perTransaction || perEpoch < perTransaction) revert InvalidRequest();
        maxPerTransaction = perTransaction;
        maxRolling24Hours = rolling24Hours;
        maxPerEpoch = perEpoch;
        emit LimitsChanged(perTransaction, rolling24Hours, perEpoch);
    }

    function rotateSigner(address signer) external onlyOwner {
        if (signer == address(0)) revert InvalidRequest();
        address previous = limitedSigner;
        limitedSigner = signer;
        emit LimitedSignerChanged(previous, signer);
    }

    function setPaused(bool value) external onlyOwner {
        if (value) _pause(); else _unpause();
    }
}
