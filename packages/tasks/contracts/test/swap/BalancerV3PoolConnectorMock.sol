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

import '@mimic-fi/v3-connectors/contracts/interfaces/balancer/IBalancerV3PoolConnector.sol';

contract BalancerV3PoolConnectorMock is IBalancerV3PoolConnector {
    address public immutable balancerV3BatchRouter;
    address public immutable permit2;

    constructor(address _balancerV3BatchRouter, address _permit2) {
        balancerV3BatchRouter = _balancerV3BatchRouter;
        permit2 = _permit2;
    }

    event LogExecute(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        IBalancerV3BatchRouter.SwapPathStep[] steps
    );

    function execute(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        IBalancerV3BatchRouter.SwapPathStep[] memory steps
    ) external returns (uint256) {
        emit LogExecute(tokenIn, tokenOut, amountIn, minAmountOut, steps);
        return minAmountOut;
    }
}
