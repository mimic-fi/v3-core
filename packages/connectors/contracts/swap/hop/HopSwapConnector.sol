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

import '@mimic-fi/v3-helpers/contracts/utils/ERC20Helpers.sol';

import './IHopDex.sol';

/**
 * @title HopSwapConnector
 * @dev Interfaces with Hop to swap tokens
 */
contract HopSwapConnector {
    /**
     * @dev The token in is the same as the token out
     */
    error HopSwapSameToken(address token);

    /**
     * @dev The dex address is zero
     */
    error HopDexAddressZero();

    /**
     * @dev The token balance after the bridge is less than the token balance before the bridge minus the amount bridged
     */
    error HopBadTokenInBalance(uint256 postBalanceIn, uint256 preBalanceIn, uint256 amountIn);

    /**
     * @dev The amount out is less than the minimum amount out 
     */
    error HopBadAmountOut(uint256 amountOut, uint256 minAmountOut);

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
        returns (uint256 amountOut)
    {
        if (tokenIn == tokenOut) revert HopSwapSameToken(tokenIn);
        if (hopDexAddress == address(0)) revert HopDexAddressZero();

        uint256 preBalanceIn = IERC20(tokenIn).balanceOf(address(this));
        uint256 preBalanceOut = IERC20(tokenOut).balanceOf(address(this));

        IHopDex hopDex = IHopDex(hopDexAddress);
        uint8 tokenInIndex = hopDex.getTokenIndex(tokenIn);
        uint8 tokenOutIndex = hopDex.getTokenIndex(tokenOut);

        ERC20Helpers.approve(tokenIn, hopDexAddress, amountIn);
        hopDex.swap(tokenInIndex, tokenOutIndex, amountIn, minAmountOut, block.timestamp);

        uint256 postBalanceIn = IERC20(tokenIn).balanceOf(address(this));
        if (postBalanceIn < preBalanceIn - amountIn) revert HopBadTokenInBalance(postBalanceIn, preBalanceIn, amountIn);

        uint256 postBalanceOut = IERC20(tokenOut).balanceOf(address(this));
        amountOut = postBalanceOut - preBalanceOut;
        if (amountOut < minAmountOut) revert HopBadAmountOut(amountOut, minAmountOut);
    }
}
