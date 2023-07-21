// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract RelayerMock {
    event Deposited(address smartVault, uint256 amount);

    mapping (address => uint256) public getSmartVaultBalance;

    function deposit(address smartVault, uint256 amount) external payable {
        getSmartVaultBalance[smartVault] += amount;
        emit Deposited(smartVault, amount);
    }

    function withdraw(address smartVault, uint256 amount) external {
        getSmartVaultBalance[smartVault] -= amount;
    }
}
