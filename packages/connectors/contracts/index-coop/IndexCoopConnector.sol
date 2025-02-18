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

import '../interfaces/index-coop/IIndexCoopConnector.sol';

/**
 * @title IndexCoopConnector
 * @dev Interfaces with IndexCoop to swap tokens
 */
contract IndexCoopConnector is IIndexCoopConnector {
    // Reference to the FlashMintLeveragedExtended contract
    address public immutable override flashMintLeveragedExtended;

    /**
     * @dev Creates a new IndexCoopConnector contract
     * @param _flashMintLeveragedExtended Address of the FlashMintLeveragedExtended contract
     */
    constructor(address _flashMintLeveragedExtended) {
        flashMintLeveragedExtended = _flashMintLeveragedExtended;
    }

    /**
     * @dev Executes a token swap using IndexCoop
     * @param tokenIn Token being sent
     * @param tokenOut Token being received
     * @param amountIn Amount of tokenIn being swapped
     * @param minAmountOut Minimum amount of tokenOut willing to receive
     * @param data Calldata to be sent to the the FlashMintLeveragedExtended contract
     */
    function execute(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, bytes memory data)
        external
        override
        returns (uint256 amountOut)
    {
        if (tokenIn == tokenOut) revert IndexCoopSwapSameToken(tokenIn);

        uint256 preBalanceIn = IERC20(tokenIn).balanceOf(address(this));
        uint256 preBalanceOut = IERC20(tokenOut).balanceOf(address(this));

        ERC20Helpers.approve(tokenIn, flashMintLeveragedExtended, amountIn);
        Address.functionCall(flashMintLeveragedExtended, data, 'INDEX_COOP_SWAP_FAILED');

        uint256 postBalanceIn = IERC20(tokenIn).balanceOf(address(this));
        bool isPostBalanceInUnexpected = postBalanceIn < preBalanceIn - amountIn;
        if (isPostBalanceInUnexpected) revert IndexCoopBadPostTokenInBalance(postBalanceIn, preBalanceIn, amountIn);

        uint256 postBalanceOut = IERC20(tokenOut).balanceOf(address(this));
        amountOut = postBalanceOut - preBalanceOut;
        if (amountOut < minAmountOut) revert IndexCoopBadAmountOut(amountOut, minAmountOut);
    }
}
