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

import '@mimic-fi/helpers/contracts/utils/ERC20Helpers.sol';

import '../interfaces/generic/IGenericSwapConnector.sol';

/**
 * @title GenericSwapConnector
 * @dev Interfaces with an arbitrary target to swap tokens
 */
contract GenericSwapConnector is IGenericSwapConnector {
    /**
     * @dev Executes a token swap with an arbitrary swapper contract
     * @param tokenIn Token being sent
     * @param tokenOut Token being received
     * @param amountIn Amount of tokenIn being swapped
     * @param minAmountOut Minimum amount of tokenOut willing to receive
     * @param targetCall Target contract to execute the swap
     * @param targetApproval Target contract to grant token in allowance before swap
     * @param data Calldata to be sent to the arbitrary target swapper
     */
    function execute(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address targetCall,
        address targetApproval,
        bytes memory data
    ) external returns (uint256 amountOut) {
        if (tokenIn == tokenOut) revert GenericSwapSameToken(tokenIn);

        uint256 preBalanceIn = IERC20(tokenIn).balanceOf(address(this));
        uint256 preBalanceOut = IERC20(tokenOut).balanceOf(address(this));

        ERC20Helpers.approve(tokenIn, targetApproval, amountIn);
        Address.functionCall(targetCall, data, 'GENERIC_SWAP_FAILED');

        uint256 postBalanceIn = IERC20(tokenIn).balanceOf(address(this));
        bool isPostBalanceInUnexpected = postBalanceIn < preBalanceIn - amountIn;
        if (isPostBalanceInUnexpected) revert GenericSwapBadPostTokenInBalance(postBalanceIn, preBalanceIn, amountIn);

        uint256 postBalanceOut = IERC20(tokenOut).balanceOf(address(this));
        amountOut = postBalanceOut - preBalanceOut;
        if (amountOut < minAmountOut) revert GenericSwapBadAmountOut(amountOut, minAmountOut);
    }
}
