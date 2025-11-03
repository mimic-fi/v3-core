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

import '../interfaces/okx/IOkxConnector.sol';

/**
 * @title OkxConnector
 * @dev Interfaces with OKX DEX to swap tokens
 */
contract OkxConnector is IOkxConnector {
    // Reference to OKX DEX Router swapper
    address public immutable override dexRouter;

    // Reference to Token Approve contract
    address public immutable override tokenApprove;

    /**
     * @dev Creates a new OkxConnector contract
     * @param _dexRouter OKX DEX router reference
     * @param _tokenApprove TokenApprove contract reference
     */
    constructor(address _dexRouter, address _tokenApprove) {
        dexRouter = _dexRouter;
        tokenApprove = _tokenApprove;
    }

    /**
     * @dev Executes a token swap in OKX DEX
     * @param tokenIn Token being sent
     * @param tokenOut Token being received
     * @param amountIn Amount of tokenIn being swapped
     * @param minAmountOut Minimum amount of tokenOut willing to receive
     * @param data Calldata to be sent to the Augusuts V6 swapper
     */
    function execute(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, bytes memory data)
        external
        returns (uint256 amountOut)
    {
        if (tokenIn == tokenOut) revert OkxSwapSameToken(tokenIn);

        uint256 preBalanceIn = IERC20(tokenIn).balanceOf(address(this));
        uint256 preBalanceOut = IERC20(tokenOut).balanceOf(address(this));

        ERC20Helpers.approve(tokenIn, tokenApprove, amountIn);
        Address.functionCall(dexRouter, data, 'OKX_DEX_SWAP_FAILED');

        uint256 postBalanceIn = IERC20(tokenIn).balanceOf(address(this));
        bool isPostBalanceInUnexpected = postBalanceIn < preBalanceIn - amountIn;
        if (isPostBalanceInUnexpected) revert OkxBadPostTokenInBalance(postBalanceIn, preBalanceIn, amountIn);

        uint256 postBalanceOut = IERC20(tokenOut).balanceOf(address(this));
        amountOut = postBalanceOut - preBalanceOut;
        if (amountOut < minAmountOut) revert OkxBadAmountOut(amountOut, minAmountOut);
    }
}
