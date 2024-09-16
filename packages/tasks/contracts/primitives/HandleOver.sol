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

import '@mimic-fi/helpers/contracts/utils/ERC20Helpers.sol';

import '../Task.sol';
import '../interfaces/primitives/IHandleOver.sol';

/**
 * @title Hand over task
 * @dev Task that simply moves tokens from one balance connector to the other
 */
contract HandleOver is IHandleOver, Task {
    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('HANDLE_OVER');

    /**
     * @dev Hand over config. Only used in the initializer.
     */
    struct HandleOverConfig {
        TaskConfig taskConfig;
    }

    /**
     * @dev Initializes the hand over task
     * @param config Hand over config
     */
    function initialize(HandleOverConfig memory config) external virtual initializer {
        __HandleOver_init(config);
    }

    /**
     * @dev Initializes the hand over task. It does call upper contracts initializers.
     * @param config Hand over config
     */
    function __HandleOver_init(HandleOverConfig memory config) internal onlyInitializing {
        __Task_init(config.taskConfig);
        __HandleOver_init_unchained(config);
    }

    /**
     * @dev Initializes the hand over task. It does not call upper contracts initializers.
     * @param config Hand over config
     */
    function __HandleOver_init_unchained(HandleOverConfig memory config) internal onlyInitializing {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Execute the hand over taks
     */
    function call(address token, uint256 amount) external override authP(authParams(token, amount)) {
        if (amount == 0) amount = getTaskAmount(token);
        _beforeHandleOver(token, amount);
        _afterHandleOver(token, amount);
    }

    /**
     * @dev Before hand over task hook
     */
    function _beforeHandleOver(address token, uint256 amount) internal virtual {
        _beforeTask(token, amount);
        if (token == address(0)) revert TaskTokenZero();
        if (amount == 0) revert TaskAmountZero();
    }

    /**
     * @dev After hand over task hook
     */
    function _afterHandleOver(address token, uint256 amount) internal virtual {
        _increaseBalanceConnector(token, amount);
        _afterTask(token, amount);
    }

    /**
     * @dev Sets the balance connectors. Both balance connector must be set.
     * @param previous Balance connector id of the previous task in the workflow
     * @param next Balance connector id of the next task in the workflow
     */
    function _setBalanceConnectors(bytes32 previous, bytes32 next) internal virtual override {
        if (previous == bytes32(0)) revert TaskConnectorZero(previous);
        if (next == bytes32(0)) revert TaskConnectorZero(next);
        super._setBalanceConnectors(previous, next);
    }
}
