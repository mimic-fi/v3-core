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
 * @title Base convex task
 * @dev Task that offers the basic components for more detailed Convex related tasks.
 */
abstract contract BaseConvexTask is IBaseConvexTask, Task {
    // Task connector address
    address public override connector;

    /**
     * @dev Base Convex task config. Only used in the initializer.
     */
    struct BaseConvexConfig {
        address connector;
        TaskConfig taskConfig;
    }

    /**
     * @dev Initializes a base Convex task
     */
    function _initialize(BaseConvexConfig memory config) internal onlyInitializing {
        _initialize(config.taskConfig);
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
     * @dev Hook to be called before the Convex task call starts. Adds simple validations to avoid a zeroed token.
     */
    function _beforeTask(address token, uint256 amount) internal virtual override {
        super._beforeTask(token, amount);
        require(token != address(0), 'TASK_TOKEN_ZERO');
    }

    /**
     * @dev Sets the task connector
     * @param newConnector New connector to be set
     */
    function _setConnector(address newConnector) internal {
        require(newConnector != address(0), 'TASK_CONNECTOR_ZERO');
        connector = newConnector;
        emit ConnectorSet(newConnector);
    }
}
