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
 * @title Hop swap connector interface
 */
interface IHopSwapConnector {
    /**
     * @dev The dex address is zero
     */
    error HopDexAddressZero();

    /**
     * @dev The token in is the same as the token out
     */
    error HopSwapSameToken(address token);

    /**
     * @dev The amount out is lower than the minimum amount out
     */
    error HopBadAmountOut(uint256 amountOut, uint256 minAmountOut);

    /**
     * @dev The post token in balance is lower than the pre token in balance minus the amount in
     */
    error HopBadPostTokenInBalance(uint256 postBalanceIn, uint256 preBalanceIn, uint256 amountIn);

    /**
     * @dev Executes a token swap in Hop
     * @param tokenIn Token being sent
     * @param tokenOut Token being received
     * @param amountIn Amount of tokenIn being swapped
     * @param minAmountOut Minimum amount of tokenOut willing to receive
     * @param hopDexAddress Address of the Hop dex to be used
     */
    function execute(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address hopDexAddress)
        external
        returns (uint256 amountOut);
}
