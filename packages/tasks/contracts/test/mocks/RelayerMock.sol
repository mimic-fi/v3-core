// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '@mimic-fi/v3-helpers/contracts/math/FixedPoint.sol';

contract RelayerMock {
    using FixedPoint for uint256;

    event Deposited(address smartVault, uint256 amount);

    event SmartVaultMaxQuotaSet(address smartVault, uint256 maxQuota);

    uint256 public balance;

    uint256 public smartVaultMaxQuota;

    uint256 public smartVaultUsedQuota;

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

    function setSmartVaultMaxQuota(address smartVault, uint256 maxQuota) external {
        smartVaultMaxQuota = maxQuota;
        emit SmartVaultMaxQuotaSet(smartVault, maxQuota);
    }

    function getSmartVaultUsedQuota(address) external view returns (uint256) {
        return smartVaultUsedQuota;
    }
}
