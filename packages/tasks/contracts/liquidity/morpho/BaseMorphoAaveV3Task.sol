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
import '../../interfaces/liquidity/morpho/IBaseMorphoAaveV3Task.sol';

/**
 * @title Base Morpho-Aave V3 task
 * @dev Task that offers the basic components for more detailed Morpho-Aave V3 related tasks
 */
abstract contract BaseMorphoAaveV3Task is IBaseMorphoAaveV3Task, Task {
    // Task connector address
    address public override connector;

    /**
     * @dev Base Morpho-Aave V3 config. Only used in the initializer.
     */
    struct BaseMorphoAaveV3Config {
        address connector;
        TaskConfig taskConfig;
    }

    /**
     * @dev Initializes the base Morpho-Aave V3 task. It does call upper contracts initializers.
     * @param config Base Morpho-Aave V3 config
     */
    function __BaseMorphoAaveV3Task_init(BaseMorphoAaveV3Config memory config) internal onlyInitializing {
        __Task_init(config.taskConfig);
        __BaseMorphoAaveV3Task_init_unchained(config);
    }

    /**
     * @dev Initializes the base Morpho-Aave V3 task. It does not call upper contracts initializers.
     * @param config Base Morpho-Aave V3 config
     */
    function __BaseMorphoAaveV3Task_init_unchained(BaseMorphoAaveV3Config memory config) internal onlyInitializing {
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
     * @dev Before base Morpho-Aave V3 task hook
     */
    function _beforeBaseMorphoAaveV3Task(address token, uint256 amount) internal virtual {
        _beforeTask(token, amount);
        if (token == address(0)) revert TaskTokenZero();
        if (amount == 0) revert TaskAmountZero();
    }

    /**
     * @dev After base Morpho-Aave V3 task hook
     */
    function _afterBaseMorphoAaveV3Task(address token, uint256 amount) internal virtual {
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
