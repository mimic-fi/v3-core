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

import '@mimic-fi/helpers/contracts/utils/BytesHelpers.sol';
import '@mimic-fi/v3-connectors/contracts/interfaces/convex/IConvexConnector.sol';

import './BaseConvexTask.sol';
import '../../interfaces/liquidity/convex/IConvexExiter.sol';

/**
 * @title Convex exiter
 * @dev Task that extends the base Convex task to exit Convex pools
 */
contract ConvexExiter is IConvexExiter, BaseConvexTask {
    using BytesHelpers for bytes;

    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('CONVEX_EXITER');

    /**
     * @dev Convex exit config. Only used in the initializer.
     */
    struct ConvexExitConfig {
        BaseConvexConfig baseConvexConfig;
    }

    /**
     * @dev Initializes a Convex exiter
     * @param config Convex exit config
     */
    function initialize(ConvexExitConfig memory config) external virtual initializer {
        __ConvexExiter_init(config);
    }

    /**
     * @dev Initializes the Convex exiter. It does call upper contracts initializers.
     * @param config Convex exit config
     */
    function __ConvexExiter_init(ConvexExitConfig memory config) internal onlyInitializing {
        __BaseConvexTask_init(config.baseConvexConfig);
        __ConvexExiter_init_unchained(config);
    }

    /**
     * @dev Initializes the Convex exiter. It does not call upper contracts initializers.
     * @param config Convex exit config
     */
    function __ConvexExiter_init_unchained(ConvexExitConfig memory config) internal onlyInitializing {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Executes the Convex exiter task
     * @param token Address of the Convex pool token to be exited with
     * @param amount Amount of Convex pool tokens to be exited with
     */
    function call(address token, uint256 amount) external override authP(authParams(token, amount)) {
        if (amount == 0) amount = getTaskAmount(token);
        _beforeConvexExiter(token, amount);
        bytes memory connectorData = abi.encodeWithSelector(IConvexConnector.exit.selector, token, amount);
        bytes memory result = ISmartVault(smartVault).execute(connector, connectorData);
        _afterConvexExiter(token, amount, IConvexConnector(connector).getCurvePool(token), result.toUint256());
    }

    /**
     * @dev Before Convex exiter hook
     */
    function _beforeConvexExiter(address token, uint256 amount) internal virtual {
        _beforeBaseConvexTask(token, amount);
        if (amount == 0) revert TaskAmountZero();
    }

    /**
     * @dev After Convex exiter hook
     */
    function _afterConvexExiter(address tokenIn, uint256 amountIn, address tokenOut, uint256 amountOut)
        internal
        virtual
    {
        _increaseBalanceConnector(tokenOut, amountOut);
        _afterBaseConvexTask(tokenIn, amountIn);
    }
}
