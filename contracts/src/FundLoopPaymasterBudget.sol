// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @notice Review-only sponsorship budget helper. It is not an ERC-4337 EntryPoint paymaster.
contract FundLoopPaymasterBudget is Ownable, Pausable {
    error UnauthorizedController();
    error InvalidSponsorship();
    error SponsorshipAlreadyUsed();
    error BudgetDepleted();

    address public controller;
    uint256 public remainingBudget;
    uint256 public maxPerRequest;
    mapping(bytes32 requestHash => bool used) public usedRequests;

    event BudgetFunded(uint256 amount, uint256 remaining);
    event SponsorshipConsumed(bytes32 indexed requestHash, uint256 amount, uint256 remaining);
    event ControllerChanged(address indexed previousController, address indexed newController);

    constructor(address initialOwner, address initialController, uint256 perRequest) Ownable(initialOwner) {
        if (initialController == address(0) || perRequest == 0) revert InvalidSponsorship();
        controller = initialController;
        maxPerRequest = perRequest;
    }

    function fund(uint256 amount) external onlyOwner {
        if (amount == 0) revert InvalidSponsorship();
        remainingBudget += amount;
        emit BudgetFunded(amount, remainingBudget);
    }

    function consume(bytes32 requestHash, uint256 amount) external whenNotPaused {
        if (msg.sender != controller) revert UnauthorizedController();
        if (requestHash == bytes32(0) || amount == 0 || amount > maxPerRequest) revert InvalidSponsorship();
        if (usedRequests[requestHash]) revert SponsorshipAlreadyUsed();
        if (amount > remainingBudget) revert BudgetDepleted();
        usedRequests[requestHash] = true;
        remainingBudget -= amount;
        emit SponsorshipConsumed(requestHash, amount, remainingBudget);
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
