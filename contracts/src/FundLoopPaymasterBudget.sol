// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @notice Review-only bounded gas reimbursement vault for the limited payout signer.
contract FundLoopPaymasterBudget is Ownable, Pausable {
    error UnauthorizedController();
    error InvalidSponsorship();
    error SponsorshipAlreadyUsed();
    error BudgetDepleted();
    error SponsorshipTransferFailed();

    address public controller;
    uint256 public remainingBudget;
    uint256 public maxPerRequest;
    mapping(bytes32 requestHash => bool used) public usedRequests;

    event BudgetFunded(address indexed funder, uint256 amount, uint256 remaining);
    event SponsorshipConsumed(bytes32 indexed requestHash, address indexed recipient, uint256 amount, uint256 remaining);
    event ControllerChanged(address indexed previousController, address indexed newController);

    constructor(address initialOwner, address initialController, uint256 perRequest) Ownable(initialOwner) {
        if (initialController == address(0) || perRequest == 0) revert InvalidSponsorship();
        controller = initialController;
        maxPerRequest = perRequest;
    }

    function fund() external payable {
        if (msg.value == 0) revert InvalidSponsorship();
        remainingBudget += msg.value;
        emit BudgetFunded(msg.sender, msg.value, remainingBudget);
    }

    function sponsor(bytes32 requestHash, address payable recipient, uint256 amount) external whenNotPaused {
        if (msg.sender != controller) revert UnauthorizedController();
        if (requestHash == bytes32(0) || recipient == address(0) || amount == 0 || amount > maxPerRequest) revert InvalidSponsorship();
        if (usedRequests[requestHash]) revert SponsorshipAlreadyUsed();
        if (amount > remainingBudget || amount > address(this).balance) revert BudgetDepleted();
        usedRequests[requestHash] = true;
        remainingBudget -= amount;
        (bool success,) = recipient.call{value: amount}("");
        if (!success) revert SponsorshipTransferFailed();
        emit SponsorshipConsumed(requestHash, recipient, amount, remainingBudget);
    }

    function setController(address nextController) external onlyOwner {
        if (nextController == address(0)) revert InvalidSponsorship();
        address previous = controller;
        controller = nextController;
        emit ControllerChanged(previous, nextController);
    }

    function setMaxPerRequest(uint256 amount) external onlyOwner {
        if (amount == 0) revert InvalidSponsorship();
        maxPerRequest = amount;
    }

    function setPaused(bool value) external onlyOwner {
        if (value) _pause(); else _unpause();
    }
}
