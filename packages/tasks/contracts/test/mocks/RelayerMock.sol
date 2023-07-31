// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract RelayerMock {
    event Deposited(address smartVault, uint256 amount);

    mapping (address => uint256) public getSmartVaultBalance;

    mapping (address => uint256) public getSmartVaultUsedQuota;

    function deposit(address smartVault, uint256 amount) external payable {
        getSmartVaultBalance[smartVault] += amount;
        emit Deposited(smartVault, amount);
    }

    function setSmartVaultUsedQuota(address smartVault, uint256 quota) external {
        getSmartVaultUsedQuota[smartVault] = quota;
    }
}
