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
import '../../interfaces/liquidity/erc4626/IBaseERC4626Task.sol';

/**
 * @title Base ERC4626 task
 * @dev Task that offers the basic components for more detailed ERC4626 related tasks
 */
abstract contract BaseERC4626Task is IBaseERC4626Task, Task {
    // Task connector address
    address public override connector;

    /**
     * @dev Base ERC4626 config. Only used in the initializer.
     */
    struct BaseERC4626Config {
        address connector;
        TaskConfig taskConfig;
    }

    /**
     * @dev Initializes the base ERC4626 task. It does call upper contracts initializers.
     * @param config Base ERC4626 config
     */
    function __BaseERC4626Task_init(BaseERC4626Config memory config) internal onlyInitializing {
        __Task_init(config.taskConfig);
        __BaseERC4626Task_init_unchained(config);
    }

    /**
     * @dev Initializes the base ERC4626 task. It does not call upper contracts initializers.
     * @param config Base ERC4626 config
     */
    function __BaseERC4626Task_init_unchained(BaseERC4626Config memory config) internal onlyInitializing {
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
     * @dev Before base ERC4626 task hook
     */
    function _beforeBaseERC4626Task(address token, uint256 amount) internal virtual {
        _beforeTask(token, amount);
        if (token == address(0)) revert TaskTokenZero();
        if (amount == 0) revert TaskAmountZero();
    }

    /**
     * @dev After base ERC4626 task hook
     */
    function _afterBaseERC4626Task(address tokenIn, uint256 amountIn, address tokenOut, uint256 amountOut)
        internal
        virtual
    {
        _increaseBalanceConnector(tokenOut, amountOut);
        _afterTask(tokenIn, amountIn);
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
