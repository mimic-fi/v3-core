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

import '@mimic-fi/v3-helpers/contracts/math/UncheckedMath.sol';
import '@mimic-fi/v3-helpers/contracts/utils/Arrays.sol';
import '@mimic-fi/v3-helpers/contracts/utils/ERC20Helpers.sol';

import './IUniswapV2Factory.sol';
import './IUniswapV2Router02.sol';

/**
 * @title UniswapV2Connector
 * @dev Interfaces with Uniswap V2 to swap tokens
 */
contract UniswapV2Connector {
    using UncheckedMath for uint256;

    // Reference to UniswapV2 router
    IUniswapV2Router02 public immutable uniswapV2Router;

    /**
     * @dev Initializes the UniswapV2Connector contract
     * @param _uniswapV2Router Uniswap V2 router reference
     */
    constructor(address _uniswapV2Router) {
        uniswapV2Router = IUniswapV2Router02(_uniswapV2Router);
    }

    /**
     * @dev Executes a token swap in Uniswap V2
     * @param tokenIn Token being sent
     * @param tokenOut Token being received
     * @param amountIn Amount of tokenIn being swapped
     * @param minAmountOut Minimum amount of tokenOut willing to receive
     * @param hopTokens Optional list of hop-tokens between tokenIn and tokenOut, only used for multi-hops
     */
    function execute(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address[] memory hopTokens
    ) external returns (uint256 amountOut) {
        require(tokenIn != tokenOut, 'UNI_V2_SWAP_SAME_TOKEN');

        uint256 preBalanceIn = IERC20(tokenIn).balanceOf(address(this));
        uint256 preBalanceOut = IERC20(tokenOut).balanceOf(address(this));

        ERC20Helpers.approve(tokenIn, address(uniswapV2Router), amountIn);
        hopTokens.length == 0
            ? _singleSwap(tokenIn, tokenOut, amountIn, minAmountOut)
            : _batchSwap(tokenIn, tokenOut, amountIn, minAmountOut, hopTokens);

        uint256 postBalanceIn = IERC20(tokenIn).balanceOf(address(this));
        require(postBalanceIn >= preBalanceIn - amountIn, 'UNI_V2_BAD_TOKEN_IN_BALANCE');

        uint256 postBalanceOut = IERC20(tokenOut).balanceOf(address(this));
        amountOut = postBalanceOut - preBalanceOut;
        require(amountOut >= minAmountOut, 'UNI_V2_MIN_AMOUNT_OUT');
    }

    /**
     * @dev Swap two tokens through UniswapV2 using a single hop
     * @param tokenIn Token being sent
     * @param tokenOut Token being received
     * @param amountIn Amount of tokenIn being swapped
     * @param minAmountOut Minimum amount of tokenOut willing to receive
     */
    function _singleSwap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut)
        internal
        returns (uint256[] memory)
    {
        address factory = uniswapV2Router.factory();
        address[] memory tokens = Arrays.from(tokenIn, tokenOut);
        _validatePool(factory, tokenIn, tokenOut);
        return uniswapV2Router.swapExactTokensForTokens(amountIn, minAmountOut, tokens, address(this), block.timestamp);
    }

    /**
     * @dev Swap two tokens through UniswapV2 using a multi hop
     * @param tokenIn Token being sent
     * @param tokenOut Token being received
     * @param amountIn Amount of the first token in the path to be swapped
     * @param minAmountOut Minimum amount of the last token in the path willing to receive
     * @param hopTokens List of hop-tokens between tokenIn and tokenOut
     */
    function _batchSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address[] memory hopTokens
    ) internal returns (uint256[] memory) {
        address factory = uniswapV2Router.factory();
        address[] memory tokens = Arrays.from(tokenIn, hopTokens, tokenOut);
        // No need for checked math since we are using it to compute indexes manually, always within boundaries
        for (uint256 i = 0; i < tokens.length.uncheckedSub(1); i = i.uncheckedAdd(1)) {
            _validatePool(factory, tokens[i], tokens[i.uncheckedAdd(1)]);
        }
        return uniswapV2Router.swapExactTokensForTokens(amountIn, minAmountOut, tokens, address(this), block.timestamp);
    }

    /**
     * @dev Validates that there is a pool created for tokenA and tokenB
     * @param factory UniswapV2 factory to check against
     * @param tokenA First token of the pair
     * @param tokenB Second token of the pair
     */
    function _validatePool(address factory, address tokenA, address tokenB) private view {
        address pool = IUniswapV2Factory(factory).getPair(tokenA, tokenB);
        require(pool != address(0), 'INVALID_UNISWAP_POOL');
    }
}
