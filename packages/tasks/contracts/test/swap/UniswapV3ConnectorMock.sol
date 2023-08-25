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

contract UniswapV3ConnectorMock {
    event LogExecute(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint24 fee,
        address[] hopTokens,
        uint24[] hopFees
    );

    function execute(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint24 fee,
        address[] memory hopTokens,
        uint24[] memory hopFees
    ) external returns (uint256) {
        emit LogExecute(tokenIn, tokenOut, amountIn, minAmountOut, fee, hopTokens, hopFees);
        return minAmountOut;
    }
}
