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

import '@mimic-fi/v3-connectors/contracts/liquidity/convex/ConvexConnector.sol';

import './BaseConvexTask.sol';
import '../../interfaces/liquidity/convex/IConvexJoiner.sol';

/**
 * @title Convex joiner task
 */
contract ConvexJoiner is IConvexJoiner, BaseConvexTask {
    /**
     * @dev Convex joiner task config. Only used in the initializer.
     */
    struct ConvexConfig {
        BaseConvexConfig baseConvexConfig;
    }

    /**
     * @dev Initializes a Convex joiner task
     */
    function initialize(ConvexConfig memory config) external initializer {
        _initialize(config.baseConvexConfig);
    }

    /**
     * @dev Executes the Convex joiner task
     */
    function call(address pool, uint256 amount)
        external
        override
        authP(authParams(pool, amount))
        baseTaskCall(pool, amount)
    {
        bytes memory connectorData = abi.encodeWithSelector(ConvexConnector.join.selector, pool, amount);
        ISmartVault(smartVault).execute(connector, connectorData);
    }

    /**
     * @dev Hook to be called before the Convex task call starts. Adds simple validations to avoid zeroed amounts.
     */
    function _beforeTask(address pool, uint256 amount) internal virtual override {
        super._beforeTask(pool, amount);
        require(amount > 0, 'TASK_AMOUNT_ZERO');
    }
}
