// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';

import '@mimic-fi/helpers/contracts/utils/ERC20Helpers.sol';

import '../interfaces/bebop/IBebopConnector.sol';

/**
 * @title BebopConnector
 * @dev Interfaces with Bebop to swap tokens
 */
contract BebopConnector is IBebopConnector {
    // Reference to Bebop Settlement contract
    address public immutable override bebopSettlement;

    /**
     * @dev Creates a new BebopConnector contract
     * @param _bebopSettlement Address of Bebop Settlement contract
     */
    constructor(address _bebopSettlement) {
        bebopSettlement = _bebopSettlement;
    }

    /**
     * @dev Executes a token swap using Bebop
     * @param tokenIn Token being sent
     * @param tokenOut Token being received
     * @param amountIn Amount of tokenIn being swapped
     * @param minAmountOut Minimum amount of tokenOut willing to receive
     * @param data Calldata to be sent to the Bebop Settlement contract
     */
    function execute(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, bytes memory data)
        external
        returns (uint256 amountOut)
    {
        if (tokenIn == tokenOut) revert BebopSwapSameToken(tokenIn);

        uint256 preBalanceIn = IERC20(tokenIn).balanceOf(address(this));
        uint256 preBalanceOut = IERC20(tokenOut).balanceOf(address(this));

        ERC20Helpers.approve(tokenIn, bebopSettlement, amountIn);
        Address.functionCall(bebopSettlement, data, 'BEBOP_SWAP_FAILED');

        uint256 postBalanceIn = IERC20(tokenIn).balanceOf(address(this));
        bool isPostBalanceInUnexpected = postBalanceIn < preBalanceIn - amountIn;
        if (isPostBalanceInUnexpected) revert BebopBadPostTokenInBalance(postBalanceIn, preBalanceIn, amountIn);

        uint256 postBalanceOut = IERC20(tokenOut).balanceOf(address(this));
        amountOut = postBalanceOut - preBalanceOut;
        if (amountOut < minAmountOut) revert BebopBadAmountOut(amountOut, minAmountOut);
    }
}
