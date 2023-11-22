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

pragma solidity >=0.8.0;

/**
 * @title Uniswap V3 connector interface
 */
interface IUniswapV3Connector {
    /**
     * @dev The input length mismatch
     */
    error UniswapV3InputLengthMismatch();

    /**
     * @dev The token in is the same as the token out
     */
    error UniswapV3SwapSameToken(address token);

    /**
     * @dev A pool with the given tokens and fee does not exist
     */
    error UniswapV3InvalidPoolFee(address token0, address token1, uint24 fee);

    /**
     * @dev The amount out is lower than the minimum amount out
     */
    error UniswapV3BadAmountOut(uint256 amountOut, uint256 minAmountOut);

    /**
     * @dev The post token in balance is lower than the previous token in balance minus the amount in
     */
    error UniswapV3BadPostTokenInBalance(uint256 postBalanceIn, uint256 preBalanceIn, uint256 amountIn);

    /**
     * @dev Tells the reference to UniswapV3 router
     */
    function uniswapV3Router() external view returns (address);

    /**
     * @dev Executes a token swap in Uniswap V3
     * @param tokenIn Token being sent
     * @param tokenOut Token being received
     * @param amountIn Amount of tokenIn being swapped
     * @param minAmountOut Minimum amount of tokenOut willing to receive
     * @param fee Fee to be used
     * @param hopTokens Optional list of hop-tokens between tokenIn and tokenOut, only used for multi-hops
     * @param hopFees Optional list of hop-fees between tokenIn and tokenOut, only used for multi-hops
     */
    function execute(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint24 fee,
        address[] memory hopTokens,
        uint24[] memory hopFees
    ) external returns (uint256 amountOut);
}
