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
import '@mimic-fi/v3-connectors/contracts/interfaces/balancer/IBalancerV2SwapConnector.sol';

import './BaseSwapTask.sol';
import '../interfaces/swap/IBalancerV2BptSwapper.sol';
import '../interfaces/liquidity/balancer/IBalancerPool.sol';

/**
 * @title Balancer v2 BPT swapper task
 * @dev Task that extends the swapper task to use Balancer v2
 */
contract BalancerV2BptSwapper is IBalancerV2BptSwapper, BaseSwapTask {
    using FixedPoint for uint256;
    using BytesHelpers for bytes;

    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('BALANCER_V2_BPT_SWAPPER');

    /**
     * @dev Balancer v2 BPT swap config. Only used in the initializer.
     */
    struct BalancerV2BptSwapConfig {
        BaseSwapConfig baseSwapConfig;
    }

    /**
     * @dev Initializes the Balancer v2 BPT swapper
     * @param config Balancer v2 BPT swap config
     */
    function initialize(BalancerV2BptSwapConfig memory config) external initializer {
        __BalancerV2BptSwapper_init(config);
    }

    /**
     * @dev Initializes the Balancer v2 BPT swapper. It does call upper contracts.
     * @param config Balancer v2 BPT swap config
     */
    function __BalancerV2BptSwapper_init(BalancerV2BptSwapConfig memory config) internal onlyInitializing {
        __BaseSwapTask_init(config.baseSwapConfig);
        __BalancerV2BptSwapper_init_unchained(config);
    }

    /**
     * @dev Initializes the Balancer v2 BPT swapper. It does not call upper contracts.
     * @param config Balancer v2 BPT swap config
     */
    function __BalancerV2BptSwapper_init_unchained(BalancerV2BptSwapConfig memory config) internal onlyInitializing {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Executes the Balancer v2 BPT swapper task
     */
    function call(address tokenIn, uint256 amountIn, uint256 slippage)
        external
        override
        authP(authParams(tokenIn, amountIn, slippage))
    {
        if (amountIn == 0) amountIn = getTaskAmount(tokenIn);
        _beforeBalancerV2BptSwapper(tokenIn, amountIn, slippage);

        address tokenOut = getTokenOut(tokenIn);
        uint256 price = _getPrice(tokenIn, tokenOut);
        uint256 minAmountOut = amountIn.mulUp(price).mulUp(FixedPoint.ONE - slippage);

        bytes memory connectorData = abi.encodeWithSelector(
            IBalancerV2SwapConnector.execute.selector,
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            IBalancerPool(tokenIn).getPoolId(),
            new bytes32[](0),
            new address[](0)
        );

        bytes memory result = ISmartVault(smartVault).execute(connector, connectorData);
        _afterBalancerV2BptSwapper(tokenIn, amountIn, slippage, tokenOut, result.toUint256());
    }

    /**
     * @dev Before Balancer v2 BPT swapper task
     */
    function _beforeBalancerV2BptSwapper(address token, uint256 amount, uint256 slippage) internal virtual {
        _beforeBaseSwapTask(token, amount, slippage);
    }

    /**
     * @dev After Balancer v2 BPT swapper hook
     */
    function _afterBalancerV2BptSwapper(
        address tokenIn,
        uint256 amountIn,
        uint256 slippage,
        address tokenOut,
        uint256 amountOut
    ) internal virtual {
        _afterBaseSwapTask(tokenIn, amountIn, slippage, tokenOut, amountOut);
    }
}
