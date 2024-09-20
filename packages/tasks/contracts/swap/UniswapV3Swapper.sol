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

import '@mimic-fi/helpers/contracts/math/FixedPoint.sol';
import '@mimic-fi/helpers/contracts/utils/BytesHelpers.sol';
import '@mimic-fi/v3-connectors/contracts/interfaces/uniswap/IUniswapV3Connector.sol';

import './BaseSwapTask.sol';
import '../interfaces/swap/IUniswapV3Swapper.sol';

/**
 * @title Uniswap v3 swapper task
 * @dev Task that extends the swapper task to use Uniswap v3
 */
contract UniswapV3Swapper is IUniswapV3Swapper, BaseSwapTask {
    using FixedPoint for uint256;
    using BytesHelpers for bytes;

    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('UNISWAP_V3_SWAPPER');

    /**
     * @dev Uniswap v3 swap config. Only used in the initializer.
     */
    struct UniswapV3SwapConfig {
        BaseSwapConfig baseSwapConfig;
    }

    /**
     * @dev Initializes the Uniswap v3 swapper
     * @param config Uniswap v3 swap config
     */
    function initialize(UniswapV3SwapConfig memory config) external initializer {
        __UniswapV3Swapper_init(config);
    }

    /**
     * @dev Initializes the Uniswap V3 swapper. It does call upper contracts.
     * @param config Uniswap v3 swap config
     */
    function __UniswapV3Swapper_init(UniswapV3SwapConfig memory config) internal onlyInitializing {
        __BaseSwapTask_init(config.baseSwapConfig);
        __UniswapV3Swapper_init_unchained(config);
    }

    /**
     * @dev Initializes the Uniswap V3 swapper. It does not call upper contracts.
     * @param config Uniswap v3 swap config
     */
    function __UniswapV3Swapper_init_unchained(UniswapV3SwapConfig memory config) internal onlyInitializing {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Executes the Uniswap v3 swapper task
     */
    function call(
        address tokenIn,
        uint256 amountIn,
        uint256 slippage,
        uint24 fee,
        address[] memory hopTokens,
        uint24[] memory hopFees
    ) external override authP(authParams(tokenIn, amountIn, slippage, fee)) {
        if (amountIn == 0) amountIn = getTaskAmount(tokenIn);
        _beforeUniswapV3Swapper(tokenIn, amountIn, slippage);

        address tokenOut = getTokenOut(tokenIn);
        uint256 price = _getPrice(tokenIn, tokenOut);
        uint256 minAmountOut = amountIn.mulUp(price).mulUp(FixedPoint.ONE - slippage);

        bytes memory connectorData = abi.encodeWithSelector(
            IUniswapV3Connector.execute.selector,
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            fee,
            hopTokens,
            hopFees
        );

        bytes memory result = ISmartVault(smartVault).execute(connector, connectorData);
        _afterUniswapV3Swapper(tokenIn, amountIn, slippage, tokenOut, result.toUint256());
    }

    /**
     * @dev Before Uniswap v3 swapper task
     */
    function _beforeUniswapV3Swapper(address token, uint256 amount, uint256 slippage) internal virtual {
        _beforeBaseSwapTask(token, amount, slippage);
    }

    /**
     * @dev After Uniswap v3 swapper hook
     */
    function _afterUniswapV3Swapper(
        address tokenIn,
        uint256 amountIn,
        uint256 slippage,
        address tokenOut,
        uint256 amountOut
    ) internal virtual {
        _afterBaseSwapTask(tokenIn, amountIn, slippage, tokenOut, amountOut);
    }
}
