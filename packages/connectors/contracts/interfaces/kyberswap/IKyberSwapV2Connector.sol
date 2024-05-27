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
 * @title KyberSwap V2 connector interface
 */
interface IKyberSwapV2Connector {
    /**
     * @dev The token in is the same as the token out
     */
    error KyberSwapV2SwapSameToken(address token);

    /**
     * @dev The amount out is lower than the minimum amount out
     */
    error KyberSwapV2BadAmountOut(uint256 amountOut, uint256 minAmountOut);

    /**
     * @dev The post token in balance is lower than the previous token in balance minus the amount in
     */
    error KyberSwapV2BadPostTokenInBalance(uint256 postBalanceIn, uint256 preBalanceIn, uint256 amountIn);

    /**
     * @dev Tells the reference to KyberSwap aggregation router v2
     */
    function kyberSwapV2Router() external view returns (address);

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
        returns (uint256 amountOut);
}
