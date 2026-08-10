// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MockSafe {
    error UnauthorizedOwner();
    error ModuleNotEnabled();
    error OwnerExecutionFailed();

    address public immutable owner;
    mapping(address module => bool enabled) public modules;

    constructor(address initialOwner) { owner = initialOwner; }

    function enableModule(address module) external {
        if (msg.sender != owner) revert UnauthorizedOwner();
        modules[module] = true;
    }

    function disableModule(address module) external {
        if (msg.sender != owner) revert UnauthorizedOwner();
        modules[module] = false;
    }

    function execOwnerTransaction(address to, uint256 value, bytes calldata data) external returns (bytes memory result) {
        if (msg.sender != owner) revert UnauthorizedOwner();
        (bool success, bytes memory returned) = to.call{value: value}(data);
        if (!success) revert OwnerExecutionFailed();
        return returned;
    }

    function execTransactionFromModule(address to, uint256 value, bytes calldata data, uint8 operation) external returns (bool success) {
        if (!modules[msg.sender]) revert ModuleNotEnabled();
        if (operation != 0) return false;
        (success,) = to.call{value: value}(data);
    }


    receive() external payable {}
}
