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

import '../../Task.sol';
import '../../interfaces/liquidity/convex/IBaseConvexTask.sol';

/**
 * @title Base Convex task
 * @dev Task that offers the basic components for more detailed Convex related tasks
 */
abstract contract BaseConvexTask is IBaseConvexTask, Task {
    // Task connector address
    address public override connector;

    /**
     * @dev Base Convex config. Only used in the initializer.
     */
    struct BaseConvexConfig {
        address connector;
        TaskConfig taskConfig;
    }

    /**
     * @dev Initializes the base Convex task. It does call upper contracts initializers.
     * @param config Base Convex config
     */
    function __BaseConvexTask_init(BaseConvexConfig memory config) internal onlyInitializing {
        __Task_init(config.taskConfig);
        __BaseConvexTask_init_unchained(config);
    }

    /**
     * @dev Initializes the base Convex task. It does not call upper contracts initializers.
     * @param config Base Convex config
     */
    function __BaseConvexTask_init_unchained(BaseConvexConfig memory config) internal onlyInitializing {
        _setConnector(config.connector);
    }

    /**
     * @dev Sets the task connector
     * @param newConnector Address of the new connector to be set
     */
    function setConnector(address newConnector) external override authP(authParams(newConnector)) {
        _setConnector(newConnector);
    }

    /**
     * @dev Before base Convex task hook
     */
    function _beforeBaseConvexTask(address token, uint256 amount) internal virtual {
        _beforeTask(token, amount);
        if (token == address(0)) revert TaskTokenZero();
    }

    /**
     * @dev After base Convex task hook
     */
    function _afterBaseConvexTask(address token, uint256 amount) internal virtual {
        _afterTask(token, amount);
    }

    /**
     * @dev Sets the task connector
     * @param newConnector New connector to be set
     */
    function _setConnector(address newConnector) internal {
        if (newConnector == address(0)) revert TaskConnectorZero();
        connector = newConnector;
        emit ConnectorSet(newConnector);
    }
}
