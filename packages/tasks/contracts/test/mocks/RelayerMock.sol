// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '@mimic-fi/v3-helpers/contracts/math/FixedPoint.sol';

contract RelayerMock {
    using FixedPoint for uint256;

    event Deposited(address smartVault, uint256 amount);

    uint256 public balance;

    constructor(uint256 _balance) {
        balance = _balance;
    }

    function getSmartVaultBalance(address) external view returns (uint256) {
        return balance;
    }

    function deposit(address smartVault, uint256 amount) external payable {
        balance += amount;
        emit Deposited(smartVault, amount);
    }

    function setBalance(uint256 _balance) external {
        balance = _balance;
    }
}
