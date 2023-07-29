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

import '@mimic-fi/v3-helpers/contracts/utils/ERC20Helpers.sol';

import './IParaswapV5Augustus.sol';

/**
 * @title ParaswapV5Connector
 * @dev Interfaces with Paraswap V5 to swap tokens
 */
contract ParaswapV5Connector {
    /**
     * @dev The token in is the same as the token out
     */
    error ParaswapV5SwapSameToken(address token);

    /**
     * @dev The amount out is lower than the minimum amount out
     */
    error ParaswapV5BadAmountOut(uint256 amountOut, uint256 minAmountOut);

    /**
     * @dev The post token in balance is lower than the previous token in balance minus the amount in
     */
    error ParaswapV5BadPostTokenInBalance(uint256 postBalanceIn, uint256 preBalanceIn, uint256 amountIn);

    // Reference to Paraswap V5 Augustus swapper
    IParaswapV5Augustus public immutable paraswapV5Augustus;

    /**
     * @dev Creates a new ParaswapV5Connector contract
     * @param _paraswapV5Augustus Paraswap V5 augusts reference
     */
    constructor(address _paraswapV5Augustus) {
        paraswapV5Augustus = IParaswapV5Augustus(_paraswapV5Augustus);
    }

    /**
     * @dev Executes a token swap in Paraswap V5
     * @param tokenIn Token being sent
     * @param tokenOut Token being received
     * @param amountIn Amount of tokenIn being swapped
     * @param minAmountOut Minimum amount of tokenOut willing to receive
     * @param data Calldata to be sent to the Augusuts swapper
     */
    function execute(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, bytes memory data)
        external
        returns (uint256 amountOut)
    {
        if (tokenIn == tokenOut) revert ParaswapV5SwapSameToken(tokenIn);

        uint256 preBalanceIn = IERC20(tokenIn).balanceOf(address(this));
        uint256 preBalanceOut = IERC20(tokenOut).balanceOf(address(this));

        address tokenTransferProxy = paraswapV5Augustus.getTokenTransferProxy();
        ERC20Helpers.approve(tokenIn, tokenTransferProxy, amountIn);
        Address.functionCall(address(paraswapV5Augustus), data, 'PARASWAP_V5_SWAP_FAILED');

        uint256 postBalanceIn = IERC20(tokenIn).balanceOf(address(this));
        bool isPostBalanceInUnexpected = postBalanceIn < preBalanceIn - amountIn;
        if (isPostBalanceInUnexpected) revert ParaswapV5BadPostTokenInBalance(postBalanceIn, preBalanceIn, amountIn);

        uint256 postBalanceOut = IERC20(tokenOut).balanceOf(address(this));
        amountOut = postBalanceOut - preBalanceOut;
        if (amountOut < minAmountOut) revert ParaswapV5BadAmountOut(amountOut, minAmountOut);
    }
}
