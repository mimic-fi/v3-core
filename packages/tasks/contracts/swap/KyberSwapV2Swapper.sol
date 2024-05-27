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
import '@mimic-fi/v3-connectors/contracts/interfaces/kyberswap/IKyberSwapV2Connector.sol';

import './BaseSwapTask.sol';
import '../interfaces/swap/IKyberSwapV2Swapper.sol';

/**
 * @title KyberSwap v2 swapper
 * @dev Task that extends the base swap task to use KyberSwap v2
 */
contract KyberSwapV2Swapper is IKyberSwapV2Swapper, BaseSwapTask {
    using FixedPoint for uint256;
    using BytesHelpers for bytes;

    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('KYBER_SWAP_V2_SWAPPER');

    /**
     * @dev KyberSwap v2 swap config. Only used in the initializer.
     */
    struct KyberSwapV2SwapConfig {
        BaseSwapConfig baseSwapConfig;
    }

    /**
     * @dev Initializes the KyberSwap v2 swapper
     * @param config KyberSwap v2 swap config
     */
    function initialize(KyberSwapV2SwapConfig memory config) external virtual initializer {
        __KyberSwapV2Swapper_init(config);
    }

    /**
     * @dev Initializes the KyberSwap v2 swapper. It does call upper contracts initializers.
     * @param config KyberSwap v2 swap config
     */
    function __KyberSwapV2Swapper_init(KyberSwapV2SwapConfig memory config) internal onlyInitializing {
        __BaseSwapTask_init(config.baseSwapConfig);
        __KyberSwapV2Swapper_init_unchained(config);
    }

    /**
     * @dev Initializes the KyberSwap v2 swapper. It does not call upper contracts initializers.
     * @param config KyberSwap v2 swap config
     */
    function __KyberSwapV2Swapper_init_unchained(KyberSwapV2SwapConfig memory config) internal onlyInitializing {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Executes the KyberSwap V2 swapper task
     */
    function call(address tokenIn, uint256 amountIn, uint256 slippage, bytes memory data)
        external
        override
        authP(authParams(tokenIn, amountIn, slippage))
    {
        if (amountIn == 0) amountIn = getTaskAmount(tokenIn);
        _beforeKyberSwapV2Swapper(tokenIn, amountIn, slippage);

        address tokenOut = getTokenOut(tokenIn);
        uint256 price = _getPrice(tokenIn, tokenOut);
        uint256 minAmountOut = amountIn.mulUp(price).mulUp(FixedPoint.ONE - slippage);
        bytes memory connectorData = abi.encodeWithSelector(
            IKyberSwapV2Connector.execute.selector,
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            data
        );

        bytes memory result = ISmartVault(smartVault).execute(connector, connectorData);
        _afterKyberSwapV2Swapper(tokenIn, amountIn, slippage, tokenOut, result.toUint256());
    }

    /**
     * @dev Before KyberSwap v2 swapper hook
     */
    function _beforeKyberSwapV2Swapper(address token, uint256 amount, uint256 slippage) internal virtual {
        _beforeBaseSwapTask(token, amount, slippage);
    }

    /**
     * @dev After KyberSwap v2 swapper hook
     */
    function _afterKyberSwapV2Swapper(
        address tokenIn,
        uint256 amountIn,
        uint256 slippage,
        address tokenOut,
        uint256 amountOut
    ) internal virtual {
        _afterBaseSwapTask(tokenIn, amountIn, slippage, tokenOut, amountOut);
    }
}
