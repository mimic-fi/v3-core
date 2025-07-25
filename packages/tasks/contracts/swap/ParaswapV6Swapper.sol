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
import '@mimic-fi/v3-connectors/contracts/interfaces/paraswap/IParaswapV6Connector.sol';

import './BaseSwapTask.sol';
import '../interfaces/swap/IParaswapV6Swapper.sol';

/**
 * @title Paraswap V6 swapper task
 * @dev Task that extends the swapper task to use Paraswap v6
 */
contract ParaswapV6Swapper is IParaswapV6Swapper, BaseSwapTask {
    using FixedPoint for uint256;
    using BytesHelpers for bytes;

    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('PARASWAP_V6_SWAPPER');

    /**
     * @dev Paraswap v6 swap config. Only used in the initializer.
     */
    struct ParaswapV6SwapConfig {
        BaseSwapConfig baseSwapConfig;
    }

    /**
     * @dev Initializes the Paraswap v6 swapper
     * @param config Paraswap v6 swap config
     */
    function initialize(ParaswapV6SwapConfig memory config) external virtual initializer {
        __ParaswapV6Swapper_init(config);
    }

    /**
     * @dev Initializes the Paraswap v6 swapper. It does call upper contracts initializers.
     * @param config Paraswap v6 swap config
     */
    function __ParaswapV6Swapper_init(ParaswapV6SwapConfig memory config) internal onlyInitializing {
        __BaseSwapTask_init(config.baseSwapConfig);
        __ParaswapV6Swapper_init_unchained(config);
    }

    /**
     * @dev Initializes the Paraswap v6 swapper. It does not call upper contracts initializers.
     * @param config Paraswap v6 swap config
     */
    function __ParaswapV6Swapper_init_unchained(ParaswapV6SwapConfig memory config) internal onlyInitializing {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Execute Paraswap v6 swapper task
     */
    function call(address tokenIn, uint256 amountIn, uint256 slippage, bytes memory data)
        external
        override
        authP(authParams(tokenIn, amountIn, slippage))
    {
        if (amountIn == 0) amountIn = getTaskAmount(tokenIn);
        _beforeParaswapV6Swapper(tokenIn, amountIn, slippage);

        address tokenOut = getTokenOut(tokenIn);
        uint256 price = _getPrice(tokenIn, tokenOut);
        uint256 minAmountOut = amountIn.mulUp(price).mulUp(FixedPoint.ONE - slippage);
        bytes memory connectorData = abi.encodeWithSelector(
            IParaswapV6Connector.execute.selector,
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            data
        );

        bytes memory result = ISmartVault(smartVault).execute(connector, connectorData);
        _afterParaswapV6Swapper(tokenIn, amountIn, slippage, tokenOut, result.toUint256());
    }

    /**
     * @dev Before Paraswap v6 swapper hook
     */
    function _beforeParaswapV6Swapper(address tokenIn, uint256 amountIn, uint256 slippage) internal virtual {
        _beforeBaseSwapTask(tokenIn, amountIn, slippage);
    }

    /**
     * @dev After Paraswap v6 swapper hook
     */
    function _afterParaswapV6Swapper(
        address tokenIn,
        uint256 amountIn,
        uint256 slippage,
        address tokenOut,
        uint256 amountOut
    ) internal virtual {
        _afterBaseSwapTask(tokenIn, amountIn, slippage, tokenOut, amountOut);
    }
}
