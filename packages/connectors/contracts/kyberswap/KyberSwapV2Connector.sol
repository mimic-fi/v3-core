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
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/utils/Address.sol';

import '@mimic-fi/v3-helpers/contracts/utils/ERC20Helpers.sol';

import '../interfaces/kyberswap/IKyberSwapV2Connector.sol';

/**
 * @title KyberSwapV2Connector
 * @dev Interfaces with KyberSwap V2 to swap tokens
 */
contract KyberSwapV2Connector is IKyberSwapV2Connector {
    // Reference to KyberSwap aggregation router v2
    address public immutable override kyberSwapV2Router;

    /**
     * @dev Creates a new KyberSwapV2Connector contract
     * @param _kyberSwapV2Router KyberSwap aggregation router v2 reference
     */
    constructor(address _kyberSwapV2Router) {
        kyberSwapV2Router = _kyberSwapV2Router;
    }

    /**
     * @dev Executes a token swap in KyberSwap V2
     * @param tokenIn Token to be sent
     * @param tokenOut Token to be received
     * @param amountIn Amount of token in to be swapped
     * @param minAmountOut Minimum amount of token out willing to receive
     * @param data Calldata to be sent to the KyberSwap aggregation router
     */
    function execute(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, bytes memory data)
        external
        override
        returns (uint256 amountOut)
    {
        if (tokenIn == tokenOut) revert KyberSwapV2SwapSameToken(tokenIn);

        uint256 preBalanceIn = IERC20(tokenIn).balanceOf(address(this));
        uint256 preBalanceOut = IERC20(tokenOut).balanceOf(address(this));

        ERC20Helpers.approve(tokenIn, kyberSwapV2Router, amountIn);
        Address.functionCall(kyberSwapV2Router, data, 'KYBER_SWAP_V2_SWAP_FAILED');

        uint256 postBalanceIn = IERC20(tokenIn).balanceOf(address(this));
        bool isPostBalanceInUnexpected = postBalanceIn < preBalanceIn - amountIn;
        if (isPostBalanceInUnexpected) revert KyberSwapV2BadPostTokenInBalance(postBalanceIn, preBalanceIn, amountIn);

        uint256 postBalanceOut = IERC20(tokenOut).balanceOf(address(this));
        amountOut = postBalanceOut - preBalanceOut;
        if (amountOut < minAmountOut) revert KyberSwapV2BadAmountOut(amountOut, minAmountOut);
    }
}
