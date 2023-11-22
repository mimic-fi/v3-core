// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

pragma solidity ^0.8.0;

contract BalancerV2PoolConnectorMock {
    address public immutable balancerV2Vault;

    constructor(address _balancerV2Vault) {
        balancerV2Vault = _balancerV2Vault;
    }

    event LogExecute(address tokenIn, uint256 amountIn, address[] tokensOut, uint256[] minAmountsOut);

    function exit(address tokenIn, uint256 amountIn, address[] memory tokensOut, uint256[] memory minAmountsOut)
        external
        returns (uint256[] memory amountsOut)
    {
        emit LogExecute(tokenIn, amountIn, tokensOut, minAmountsOut);
        return minAmountsOut;
    }
}
