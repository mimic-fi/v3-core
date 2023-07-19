// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '@mimic-fi/v3-helpers/contracts/math/FixedPoint.sol';

contract RelayerMock {
    using FixedPoint for uint256;

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
