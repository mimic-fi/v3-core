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

import '../Task.sol';
import './interfaces/IUnwrapper.sol';

/**
 * @title Unwrapper task
 */
contract Unwrapper is IUnwrapper, Task {
    /**
     * @dev Unwrapper task config. Only used in the initializer.
     * @param taskConfig Task config params
     */
    struct UnwrapperConfig {
        TaskConfig taskConfig;
    }

    /**
     * @dev Initializes a unwrapper task
     */
    function initialize(UnwrapperConfig memory config) public initializer {
        _initialize(config.taskConfig);
    }

    /**
     * @dev Executes the unwrapper task
     */
    function call(uint256 amount)
        external
        override
        authP(authParams(amount))
        baseTaskCall(_wrappedNativeToken(), amount)
    {
        ISmartVault(smartVault).unwrap(amount);
    }

    /**
     * @dev Reverts if the token or the amount are zero
     */
    function _beforeTask(address token, uint256 amount) internal virtual override {
        super._beforeTask(token, amount);
        require(token == _wrappedNativeToken(), 'TASK_NOT_NATIVE_TOKEN');
        require(amount > 0, 'TASK_AMOUNT_ZERO');
    }
}
