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

import '@mimic-fi/v3-helpers/contracts/utils/Arrays.sol';
import '@mimic-fi/v3-helpers/contracts/utils/BytesHelpers.sol';
import '@mimic-fi/v3-helpers/contracts/utils/ERC20Helpers.sol';

import './IUniswapV3Factory.sol';
import './IUniswapV3SwapRouter.sol';
import './IUniswapV3PeripheryImmutableState.sol';
import '../../interfaces/swap/IUniswapV3Connector.sol';

/**
 * @title UniswapV3Connector
 * @dev Interfaces with Uniswap V3 to swap tokens
 */
contract UniswapV3Connector is IUniswapV3Connector {
    using BytesHelpers for bytes;

    // Reference to UniswapV3 router
    address public immutable override uniswapV3Router;

    /**
     * @dev Initializes the UniswapV3Connector contract
     * @param _uniswapV3Router Uniswap V3 router reference
     */
    constructor(address _uniswapV3Router) {
        uniswapV3Router = _uniswapV3Router;
    }

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
    ) external returns (uint256 amountOut) {
        if (tokenIn == tokenOut) revert UniswapV3SwapSameToken(tokenIn);
        if (hopTokens.length != hopFees.length) revert UniswapV3InputLengthMismatch();

        uint256 preBalanceIn = IERC20(tokenIn).balanceOf(address(this));
        uint256 preBalanceOut = IERC20(tokenOut).balanceOf(address(this));

        ERC20Helpers.approve(tokenIn, uniswapV3Router, amountIn);
        hopTokens.length == 0
            ? _singleSwap(tokenIn, tokenOut, amountIn, minAmountOut, fee)
            : _batchSwap(tokenIn, tokenOut, amountIn, minAmountOut, fee, hopTokens, hopFees);

        uint256 postBalanceIn = IERC20(tokenIn).balanceOf(address(this));
        bool isPostBalanceInUnexpected = postBalanceIn < preBalanceIn - amountIn;
        if (isPostBalanceInUnexpected) revert UniswapV3BadPostTokenInBalance(postBalanceIn, preBalanceIn, amountIn);

        uint256 postBalanceOut = IERC20(tokenOut).balanceOf(address(this));
        amountOut = postBalanceOut - preBalanceOut;
        if (amountOut < minAmountOut) revert UniswapV3BadAmountOut(amountOut, minAmountOut);
    }

    /**
     * @dev Swap two tokens through UniswapV3 using a single hop
     * @param tokenIn Token being sent
     * @param tokenOut Token being received
     * @param amountIn Amount of tokenIn being swapped
     * @param minAmountOut Minimum amount of tokenOut willing to receive
     * @param fee Fee to be used
     */
    function _singleSwap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint24 fee)
        internal
        returns (uint256 amountOut)
    {
        _validatePool(_uniswapV3Factory(), tokenIn, tokenOut, fee);

        IUniswapV3SwapRouter.ExactInputSingleParams memory input;
        input.tokenIn = tokenIn;
        input.tokenOut = tokenOut;
        input.fee = fee;
        input.recipient = address(this);
        input.deadline = block.timestamp;
        input.amountIn = amountIn;
        input.amountOutMinimum = minAmountOut;
        input.sqrtPriceLimitX96 = 0;
        return IUniswapV3SwapRouter(uniswapV3Router).exactInputSingle(input);
    }

    /**
     * @dev Swap two tokens through UniswapV3 using a multi hop
     * @param tokenIn Token being sent
     * @param tokenOut Token being received
     * @param amountIn Amount of the first token in the path to be swapped
     * @param minAmountOut Minimum amount of the last token in the path willing to receive
     * @param fee Fee to be used
     * @param hopTokens List of hop-tokens between tokenIn and tokenOut
     * @param hopFees List of hop-fees between tokenIn and tokenOut
     */
    function _batchSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint24 fee,
        address[] memory hopTokens,
        uint24[] memory hopFees
    ) internal returns (uint256 amountOut) {
        address factory = _uniswapV3Factory();
        address[] memory tokens = Arrays.from(tokenIn, hopTokens, tokenOut);
        uint24[] memory fees = Arrays.from(fee, hopFees);

        // No need for checked math since we are using it to compute indexes manually, always within boundaries
        for (uint256 i = 0; i < fees.length; i++) {
            _validatePool(factory, tokens[i], tokens[i + 1], fees[i]);
        }

        IUniswapV3SwapRouter.ExactInputParams memory input;
        input.path = _encodePoolPath(tokens, fees);
        input.amountIn = amountIn;
        input.amountOutMinimum = minAmountOut;
        input.recipient = address(this);
        input.deadline = block.timestamp;
        return IUniswapV3SwapRouter(uniswapV3Router).exactInput(input);
    }

    /**
     * @dev Tells the Uniswap V3 factory contract address
     * @return Address of the Uniswap V3 factory contract
     */
    function _uniswapV3Factory() internal view returns (address) {
        return IUniswapV3PeripheryImmutableState(uniswapV3Router).factory();
    }

    /**
     * @dev Validates that there is a pool created for tokenA and tokenB with a requested fee
     * @param factory UniswapV3 factory to check against
     * @param tokenA One of the tokens in the pool
     * @param tokenB The other token in the pool
     * @param fee Fee used by the pool
     */
    function _validatePool(address factory, address tokenA, address tokenB, uint24 fee) internal view {
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        address pool = IUniswapV3Factory(factory).getPool(token0, token1, fee);
        if (pool == address(0)) revert UniswapV3InvalidPoolFee(token0, token1, fee);
    }

    /**
     * @dev Encodes a path of tokens with their corresponding fees
     * @param tokens List of tokens to be encoded
     * @param fees List of fees to use for each token pair
     */
    function _encodePoolPath(address[] memory tokens, uint24[] memory fees) internal pure returns (bytes memory path) {
        path = new bytes(0);
        for (uint256 i = 0; i < fees.length; i++) path = path.concat(tokens[i]).concat(fees[i]);
        path = path.concat(tokens[fees.length]);
    }
}
