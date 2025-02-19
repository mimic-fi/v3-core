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
import '@mimic-fi/v3-connectors/contracts/interfaces/index-coop/IIndexCoopConnector.sol';

import './BaseSwapTask.sol';
import '../interfaces/swap/IIndexCoopSwapper.sol';

/**
 * @title IndexCoop swapper
 * @dev Task that extends the base swap task to use IndexCoop
 */
contract IndexCoopSwapper is IIndexCoopSwapper, BaseSwapTask {
    using FixedPoint for uint256;
    using BytesHelpers for bytes;

    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('INDEX_COOP_SWAPPER');

    /**
     * @dev IndexCoop swap config. Only used in the initializer.
     */
    struct IndexCoopSwapConfig {
        BaseSwapConfig baseSwapConfig;
    }

    /**
     * @dev Initializes the IndexCoop swapper
     * @param config IndexCoop swap config
     */
    function initialize(IndexCoopSwapConfig memory config) external virtual initializer {
        __IndexCoopSwapper_init(config);
    }

    /**
     * @dev Initializes the IndexCoop swapper. It does call upper contracts initializers.
     * @param config IndexCoop swap config
     */
    function __IndexCoopSwapper_init(IndexCoopSwapConfig memory config) internal onlyInitializing {
        __BaseSwapTask_init(config.baseSwapConfig);
        __IndexCoopSwapper_init_unchained(config);
    }

    /**
     * @dev Initializes the IndexCoop swapper. It does not call upper contracts initializers.
     * @param config IndexCoop swap config
     */
    function __IndexCoopSwapper_init_unchained(IndexCoopSwapConfig memory config) internal onlyInitializing {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Executes the IndexCoop swapper
     */
    function call(address tokenIn, uint256 amountIn, uint256 slippage, bytes memory data)
        external
        override
        authP(authParams(tokenIn, amountIn, slippage))
    {
        if (amountIn == 0) amountIn = getTaskAmount(tokenIn);
        _beforeIndexCoopSwapper(tokenIn, amountIn, slippage);

        address tokenOut = getTokenOut(tokenIn);
        uint256 price = _getPrice(tokenIn, tokenOut);
        uint256 minAmountOut = amountIn.mulUp(price).mulUp(FixedPoint.ONE - slippage);
        bytes memory connectorData = abi.encodeWithSelector(
            IIndexCoopConnector.execute.selector,
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            data
        );

        bytes memory result = ISmartVault(smartVault).execute(connector, connectorData);
        _afterIndexCoopSwapper(tokenIn, amountIn, slippage, tokenOut, result.toUint256());
    }

    /**
     * @dev Before IndexCoop swapper hook
     */
    function _beforeIndexCoopSwapper(address token, uint256 amount, uint256 slippage) internal virtual {
        _beforeBaseSwapTask(token, amount, slippage);
    }

    /**
     * @dev After IndexCoop swapper hook
     */
    function _afterIndexCoopSwapper(
        address tokenIn,
        uint256 amountIn,
        uint256 slippage,
        address tokenOut,
        uint256 amountOut
    ) internal virtual {
        _afterBaseSwapTask(tokenIn, amountIn, slippage, tokenOut, amountOut);
    }
}
