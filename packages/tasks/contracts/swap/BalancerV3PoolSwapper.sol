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
import '@mimic-fi/v3-connectors/contracts/interfaces/balancer/IBalancerV3PoolConnector.sol';

import './BaseSwapTask.sol';
import '../interfaces/swap/IBalancerV3PoolSwapper.sol';

/**
 * @title Balancer v3 pool swapper task
 * @dev Task that extends the base swap task to use Balancer v3 pools
 */
contract BalancerV3PoolSwapper is IBalancerV3PoolSwapper, BaseSwapTask {
    using FixedPoint for uint256;
    using BytesHelpers for bytes;

    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('BALANCER_V3_POOL_SWAPPER');

    /**
     * @dev Balancer v3 swap config. Only used in the initalizer
     */
    struct BalancerV3SwapConfig {
        BaseSwapConfig baseSwapConfig;
    }

    /**
     * @dev Initializes the Balancer v3 swapper
     * @param config Balancer v3 swap config
     */
    function initialize(BalancerV3SwapConfig memory config) external initializer {
        __BalancerV3Swapper_init(config);
    }

    /**
     * @dev Initializes the Balancer v3 swapper. It does call upper contracts.
     * @param config Balancer v3 swap config
     */
    function __BalancerV3Swapper_init(BalancerV3SwapConfig memory config) internal onlyInitializing {
        __BaseSwapTask_init(config.baseSwapConfig);
        __BalancerV3Swapper_init_unchained(config);
    }

    /**
     * @dev Initializes the Balancer swapper. It does not call upper contracts
     */
    function __BalancerV3Swapper_init_unchained(BalancerV3SwapConfig memory) internal onlyInitializing {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Executes the Balancer v3 swapper task
     */
    function call(
        address tokenIn,
        uint256 amountIn,
        uint256 slippage,
        IBalancerV3BatchRouter.SwapPathStep[] memory steps
    ) external override authP(authParams(tokenIn, amountIn, slippage)) {
        if (amountIn == 0) amountIn = getTaskAmount(tokenIn);
        _beforeBalancerV3Swapper(tokenIn, amountIn, slippage);

        address tokenOut = getTokenOut(tokenIn);
        uint256 price = _getPrice(tokenIn, tokenOut);
        uint256 minAmountOut = amountIn.mulUp(price).mulUp(FixedPoint.ONE - slippage);

        bytes memory connectorData = abi.encodeWithSelector(
            IBalancerV3PoolConnector.execute.selector,
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            steps
        );

        bytes memory result = ISmartVault(smartVault).execute(connector, connectorData);
        _afterBalancerV3Swapper(tokenIn, amountIn, slippage, tokenOut, result.toUint256());
    }

    /**
     * @dev Before Balancer V3 swapper hook
     */
    function _beforeBalancerV3Swapper(address token, uint256 amount, uint256 slippage) internal virtual {
        _beforeBaseSwapTask(token, amount, slippage);
    }

    /**
     * @dev After Balancer v3 swapper hook
     */
    function _afterBalancerV3Swapper(
        address tokenIn,
        uint256 amountIn,
        uint256 slippage,
        address tokenOut,
        uint256 amountOut
    ) internal virtual {
        _afterBaseSwapTask(tokenIn, amountIn, slippage, tokenOut, amountOut);
    }
}
