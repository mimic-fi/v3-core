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
import '@mimic-fi/v3-connectors/contracts/interfaces/okx/IOkxConnector.sol';

import './BaseSwapTask.sol';
import '../interfaces/swap/IOkxSwapper.sol';

/**
 * @title OKX DEX swapper
 * @dev Task that extends the base swap task to use OKX
 */
contract OkxSwapper is IOkxSwapper, BaseSwapTask {
    using FixedPoint for uint256;
    using BytesHelpers for bytes;

    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('OKX_DEX_SWAPPER');

    /**
     * @dev OKX swap config. Only used in the initializer.
     */
    struct OkxSwapConfig {
        BaseSwapConfig baseSwapConfig;
    }

    /**
     * @dev Initializes the OKX DEX swapper
     * @param config OKX swap config
     */
    function initialize(OkxSwapConfig memory config) external virtual initializer {
        __OkxSwapper_init(config);
    }

    /**
     * @dev Initializes the OKX DEX swapper. It does call upper contracts initializers.
     * @param config OKX swap config
     */
    function __OkxSwapper_init(OkxSwapConfig memory config) internal onlyInitializing {
        __BaseSwapTask_init(config.baseSwapConfig);
        __OkxSwapper_init_unchained(config);
    }

    /**
     * @dev Initializes the OKX DEX swapper. It does not call upper contracts initializers.
     * @param config OKX swap config
     */
    function __OkxSwapper_init_unchained(OkxSwapConfig memory config) internal onlyInitializing {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Executes the OKX DEX swapper swapper task
     */
    function call(address tokenIn, uint256 amountIn, uint256 slippage, bytes memory data)
        external
        virtual
        override
        authP(authParams(tokenIn, amountIn, slippage))
    {
        if (amountIn == 0) amountIn = getTaskAmount(tokenIn);
        _beforeOkxSwapper(tokenIn, amountIn, slippage);

        address tokenOut = getTokenOut(tokenIn);
        uint256 price = _getPrice(tokenIn, tokenOut);
        uint256 minAmountOut = amountIn.mulUp(price).mulUp(FixedPoint.ONE - slippage);
        bytes memory connectorData = abi.encodeWithSelector(
            IOkxConnector.execute.selector,
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            data
        );

        bytes memory result = ISmartVault(smartVault).execute(connector, connectorData);
        _afterOkxSwapper(tokenIn, amountIn, slippage, tokenOut, result.toUint256());
    }

    /**
     * @dev Before OKX DEX swapper hook
     */
    function _beforeOkxSwapper(address token, uint256 amount, uint256 slippage) internal virtual {
        _beforeBaseSwapTask(token, amount, slippage);
    }

    /**
     * @dev After OKX DEX swapper hook
     */
    function _afterOkxSwapper(address tokenIn, uint256 amountIn, uint256 slippage, address tokenOut, uint256 amountOut)
        internal
        virtual
    {
        _afterBaseSwapTask(tokenIn, amountIn, slippage, tokenOut, amountOut);
    }
}
