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
 * @title Paraswap V6 connector interface
 */
interface IParaswapV6Connector {
    /**
     * @dev The token in is the same as the token out
     */
    error ParaswapV6SwapSameToken(address token);

    /**
     * @dev The amount out is lower than the minimum amount out
     */
    error ParaswapV6BadAmountOut(uint256 amountOut, uint256 minAmountOut);

    /**
     * @dev The post token in balance is lower than the previous token in balance minus the amount in
     */
    error ParaswapV6BadPostTokenInBalance(uint256 postBalanceIn, uint256 preBalanceIn, uint256 amountIn);

    /**
     * @dev Tells the reference to Paraswap V6 Augustus swapper
     */
    function paraswapV6Augustus() external view returns (address);

    /**
     * @dev Executes a token swap in Paraswap V6
     * @param tokenIn Token being sent
     * @param tokenOut Token being received
     * @param amountIn Amount of tokenIn being swapped
     * @param minAmountOut Minimum amount of tokenOut willing to receive
     * @param data Calldata to be sent to the Augusuts V6 swapper
     */
    function execute(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, bytes memory data)
        external
        returns (uint256 amountOut);
}
