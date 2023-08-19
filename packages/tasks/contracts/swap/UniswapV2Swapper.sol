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

import '@mimic-fi/v3-helpers/contracts/math/FixedPoint.sol';
import '@mimic-fi/v3-helpers/contracts/utils/BytesHelpers.sol';
import '@mimic-fi/v3-connectors/contracts/swap/uniswap-v2/UniswapV2Connector.sol';

import './BaseSwapTask.sol';
import '../interfaces/swap/IUniSwapV2Swapper.sol';

contract UniswapV2Swapper is IUniswapV2Swapper, BaseSwapTask {
    using FixedPoint for uint256;
    using BytesHelpers for bytes;

    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('UNISWAP_V2_SWAPPER');

    /**
     * @dev Uniswap v2 swapper task config. Only used in the initializer.
     */
    struct UniswapV2SwapperConfig {
        BaseSwapConfig baseSwapConfig;
    }

    /**
     * @dev Initializes the Uniswap v2 swapper action.
     * @param config Uniswap v2 swap config.
     */
    function initialize(UniswapV2SwapperConfig memory config) external initializer {
        __UniswapV2Swapper_init(config);
    }

    /**
     * @dev Initializes the Uniswap V2 swapper. It does call upper contracts.
     * @param config Uniswap v2 swap config.
     */
    function __UniswapV2Swapper_init(UniswapV2SwapperConfig memory config) internal onlyInitializing {
        __BaseSwapTask_init(config.baseSwapConfig);
        __UniswapV2Swapper_init_unchained(config);
    }

    /**
     * @dev Initilizes the uniswap V2 swapper. It does not call upper contracts.
     * @param config Uniswap v2 swap config.
     */
    function __UniswapV2Swapper_init_unchained(UniswapV2SwapperConfig memory config) internal onlyInitializing {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Executes the Uniswap v2 swapper task
     */
    function call(address tokenIn, uint256 amountIn, uint256 slippage, address[] memory hopTokens)
        external
        override
        authP(authParams(tokenIn, amountIn, slippage, hopTokens))
    {
        if (amountIn == 0) amountIn = getTaskAmount(tokenIn);
        _beforeUniswapV2Swapper(tokenIn, amountIn, slippage);

        address tokenOut = getTokenOut(tokenIn);
        uint256 price = _getPrice(tokenIn, tokenOut);
        uint256 minAmountOut = amountIn.mulUp(price).mulUp(FixedPoint.ONE - slippage);

        bytes memory connectorData = abi.encodeWithSelector(
            UniswapV2Connector.execute.selector,
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            hopTokens
        );

        bytes memory result = ISmartVault(smartVault).execute(connector, connectorData);
        _afterUniswapV2Swapper(tokenIn, amountIn, slippage, tokenOut, result.toUint256());
    }

    /**
     * @dev Before Uniswap v2 Swapper Task
     */
    function _beforeUniswapV2Swapper(address token, uint256 amount, uint256 slippage) internal virtual {
        _beforeBaseSwapTask(token, amount, slippage);
    }

    /**
     * @dev After Uniswap V2 swapper hook
     */
    function _afterUniswapV2Swapper(
        address tokenIn,
        uint256 amountIn,
        uint256 slippage,
        address tokenOut,
        uint256 amountOut
    ) internal virtual {
        _afterBaseSwapTask(tokenIn, amountIn, slippage, tokenOut, amountOut);
    }
}
