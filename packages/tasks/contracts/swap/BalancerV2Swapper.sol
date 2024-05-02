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
import '../interfaces/swap/IBalancerV2Swapper.sol';
import '../interfaces/liquidity/balancer/IBalancerPool.sol';

/**
 * @title Balancer v2 swapper task
 * @dev Task that extends the base swap task to use Balancer
 */
contract BalancerV2Swapper is IBalancerV2Swapper, BaseSwapTask {
    using FixedPoint for uint256;
    using BytesHelpers for bytes;

    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('BALANCER_V2_SWAPPER');

    // List of pool id's per token
    mapping (address => bytes32) public balancerPoolId;

    /**
     * @dev Balancer pool id config. Only used in the initializer.
     */
    struct BalancerPoolId {
        address token;
        bytes32 poolId;
    }

    /**
     * @dev Balancer v2 swap config. Only used in the initalizer
     */
    struct BalancerV2SwapConfig {
        BalancerPoolId[] balancerPoolIds;
        BaseSwapConfig baseSwapConfig;
    }

    /**
     * @dev Initializes the Balancer v2 swapper
     * @param config Balancer v2 swap config
     */
    function initialize(BalancerV2SwapConfig memory config) external initializer {
        __BalancerV2Swapper_init(config);
    }

    /**
     * @dev Initializes the Balancer v2 swapper. It does call upper contracts.
     * @param config Balancer v2 swap config
     */
    function __BalancerV2Swapper_init(BalancerV2SwapConfig memory config) internal onlyInitializing {
        __BaseSwapTask_init(config.baseSwapConfig);
        __BalancerV2Swapper_init_unchained(config);
    }

    /**
     * @dev Initializes the Balancer swapper. It does not call upper contracts
     * @param config Balancer V2 swap config
     */
    function __BalancerV2Swapper_init_unchained(BalancerV2SwapConfig memory config) internal onlyInitializing {
        for (uint256 i = 0; i < config.balancerPoolIds.length; i++) {
            _setPoolId(config.balancerPoolIds[i].token, config.balancerPoolIds[i].poolId);
        }
    }

    /**
     * @dev Sets a Balancer pool ID for a token
     * @param token Address of the token to set the pool ID of
     * @param poolId ID of the pool to be set for the given token
     */
    function setPoolId(address token, bytes32 poolId) external authP(authParams(token, poolId)) {
        _setPoolId(token, poolId);
    }

    /**
     * @dev Executes the Balancer v2 swapper task
     */
    function call(address tokenIn, uint256 amountIn, uint256 slippage)
        external
        override
        authP(authParams(tokenIn, amountIn, slippage))
    {
        if (amountIn == 0) amountIn = getTaskAmount(tokenIn);
        _beforeBalancerV2Swapper(tokenIn, amountIn, slippage);

        address tokenOut = getTokenOut(tokenIn);
        uint256 price = _getPrice(tokenIn, tokenOut);
        uint256 minAmountOut = amountIn.mulUp(price).mulUp(FixedPoint.ONE - slippage);
        bytes32 poolId = balancerPoolId[tokenIn];

        bytes memory connectorData = abi.encodeWithSelector(
            IBalancerV2SwapConnector.execute.selector,
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            poolId,
            new bytes32[](0),
            new address[](0)
        );

        bytes memory result = ISmartVault(smartVault).execute(connector, connectorData);
        _afterBalancerV2Swapper(tokenIn, amountIn, slippage, tokenOut, result.toUint256());
    }

    /**
     * @dev Before Balancer V2 swapper hook
     */
    function _beforeBalancerV2Swapper(address token, uint256 amount, uint256 slippage) internal virtual {
        _beforeBaseSwapTask(token, amount, slippage);
        if (balancerPoolId[token] == bytes32(0)) revert TaskMissingPoolId();
    }

    /**
     * @dev After Balancer v2 swapper hook
     */
    function _afterBalancerV2Swapper(
        address tokenIn,
        uint256 amountIn,
        uint256 slippage,
        address tokenOut,
        uint256 amountOut
    ) internal virtual {
        _afterBaseSwapTask(tokenIn, amountIn, slippage, tokenOut, amountOut);
    }

    /**
     * @dev Sets a Balancer pool ID for a token
     * @param token Address of the token to set the pool ID of
     * @param poolId ID of the pool to be set for the given token
     */
    function _setPoolId(address token, bytes32 poolId) internal {
        if (token == address(0)) revert TaskTokenZero();

        balancerPoolId[token] = poolId;
        emit BalancerPoolIdSet(token, poolId);
    }
}
