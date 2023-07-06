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

import '@mimic-fi/v3-helpers/contracts/utils/Denominations.sol';

import '../Task.sol';
import '../interfaces/primitives/ICollector.sol';

/**
 * @title Collector task
 * @dev Task that offers a source address where funds can be pulled from
 */
contract Collector is ICollector, Task {
    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('COLLECTOR');

    // Address from where the tokens will be pulled
    address public override source;

    /**
     * @dev Collector task config. Only used in the initializer.
     * @param source Address of the allowed source
     * @param taskConfig Task config params
     */
    struct CollectorConfig {
        address source;
        TaskConfig taskConfig;
    }

    /**
     * @dev Initializes a collector task
     */
    function initialize(CollectorConfig memory config) external initializer {
        _initialize(config.taskConfig);
        _setSource(config.source);
    }

    /**
     * @dev Sets the source address. Sender must be authorized.
     * @param newSource Address of the new source to be set
     */
    function setSource(address newSource) external override authP(authParams(newSource)) {
        _setSource(newSource);
    }

    /**
     * @dev Executes the collector task
     */
    function call(address token, uint256 amount)
        external
        override
        authP(authParams(token, amount))
        baseTaskCall(token, amount)
    {
        ISmartVault(smartVault).collect(token, source, amount);
        _increaseBalanceConnector(token, amount);
    }

    /**
     * @dev Reverts if the token or the amount are zero
     */
    function _beforeTask(address token, uint256 amount) internal virtual override {
        super._beforeTask(token, amount);
        require(token != address(0), 'TASK_TOKEN_ZERO');
        require(amount > 0, 'TASK_AMOUNT_ZERO');
    }

    /**
     * @dev Sets the balance connectors. Previous balance connector must be unset.
     * @param previous Balance connector id of the previous task in the workflow
     * @param next Balance connector id of the next task in the workflow
     */
    function _setBalanceConnectors(bytes32 previous, bytes32 next) internal virtual override {
        require(previous == bytes32(0), 'TASK_PREVIOUS_CONNECTOR_NOT_ZERO');
        super._setBalanceConnectors(previous, next);
    }

    /**
     * @dev Sets the source address
     * @param newSource Address of the new source to be set
     */
    function _setSource(address newSource) internal virtual {
        require(newSource != address(0), 'TASK_SOURCE_ZERO');
        source = newSource;
        emit SourceSet(newSource);
    }
}
