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
import '../interfaces/primitives/IWrapper.sol';

/**
 * @title Wrapper task
 */
contract Wrapper is IWrapper, Task {
    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('WRAPPER');

    /**
     * @dev Wrapper task config. Only used in the initializer.
     * @param taskConfig Task config params
     */
    struct WrapperConfig {
        TaskConfig taskConfig;
    }

    /**
     * @dev Initializes a wrapper task
     */
    function initialize(WrapperConfig memory config) external initializer {
        _initialize(config.taskConfig);
    }

    /**
     * @dev Executes the wrapper task
     */
    function call(address token, uint256 amount)
        external
        override
        authP(authParams(token, amount))
        baseTaskCall(token, amount)
    {
        ISmartVault(smartVault).wrap(amount);
        _increaseBalanceConnector(_wrappedNativeToken(), amount);
    }

    /**
     * @dev Reverts if the token or the amount are zero
     */
    function _beforeTask(address token, uint256 amount) internal virtual override {
        super._beforeTask(token, amount);
        require(token == Denominations.NATIVE_TOKEN, 'TASK_TOKEN_NOT_NATIVE');
        require(amount > 0, 'TASK_AMOUNT_ZERO');
    }
}
