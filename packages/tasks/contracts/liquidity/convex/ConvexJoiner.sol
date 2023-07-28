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

import '@mimic-fi/v3-helpers/contracts/utils/BytesHelpers.sol';
import '@mimic-fi/v3-connectors/contracts/liquidity/convex/ConvexConnector.sol';

import './BaseConvexTask.sol';
import '../../interfaces/liquidity/convex/IConvexJoiner.sol';

/**
 * @title Convex joiner
 * @dev Task that extends the base Convex task to join Convex pools
 */
contract ConvexJoiner is IConvexJoiner, BaseConvexTask {
    using BytesHelpers for bytes;

    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('CONVEX_JOINER');

    /**
     * @dev Convex join config. Only used in the initializer.
     */
    struct ConvexJoinConfig {
        BaseConvexConfig baseConvexConfig;
    }

    /**
     * @dev Initializes a Convex joiner
     * @param config Convex join config
     */
    function initialize(ConvexJoinConfig memory config) external virtual initializer {
        __ConvexJoiner_init(config);
    }

    /**
     * @dev Initializes the Convex joiner. It does call upper contracts initializers.
     * @param config Convex join config
     */
    function __ConvexJoiner_init(ConvexJoinConfig memory config) internal onlyInitializing {
        __BaseConvexTask_init(config.baseConvexConfig);
        __ConvexJoiner_init_unchained(config);
    }

    /**
     * @dev Initializes the Convex joiner. It does not call upper contracts initializers.
     * @param config Convex join config
     */
    function __ConvexJoiner_init_unchained(ConvexJoinConfig memory config) internal onlyInitializing {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Executes the Convex joiner task
     * @param token Address of the Curve pool token to be joined with
     * @param amount Amount of Curve pool tokens to be joined with
     */
    function call(address token, uint256 amount) external override authP(authParams(token, amount)) {
        if (amount == 0) amount = getTaskAmount(token);
        _beforeConvexJoiner(token, amount);
        bytes memory connectorData = abi.encodeWithSelector(ConvexConnector.join.selector, token, amount);
        bytes memory result = ISmartVault(smartVault).execute(connector, connectorData);
        _afterConvexJoiner(token, amount, ConvexConnector(connector).getCvxPool(token), result.toUint256());
    }

    /**
     * @dev Before Convex joiner hook
     */
    function _beforeConvexJoiner(address token, uint256 amount) internal virtual {
        _beforeBaseConvexTask(token, amount);
        if (amount == 0) revert TaskAmountZero();
    }

    /**
     * @dev After Convex joiner hook
     */
    function _afterConvexJoiner(address tokenIn, uint256 amountIn, address tokenOut, uint256 amountOut)
        internal
        virtual
    {
        _increaseBalanceConnector(tokenOut, amountOut);
        _afterBaseConvexTask(tokenIn, amountIn);
    }
}
