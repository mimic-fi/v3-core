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

pragma solidity ^0.8.17;

import '@mimic-fi/v3-helpers/contracts/math/FixedPoint.sol';

import './BaseTask.sol';
import '../interfaces/base/IPausableTask.sol';

/**
 * @dev Pausable config for tasks
 */
abstract contract PausableTask is IPausableTask, BaseTask {
    using FixedPoint for uint256;

    // Whether the task is paused or not
    bool public override isPaused;

    /**
     * @dev Pauses a task
     */
    function pause() external override auth {
        require(!isPaused, 'TASK_ALREADY_PAUSED');
        isPaused = true;
        emit Paused();
    }

    /**
     * @dev Unpauses a task
     */
    function unpause() external override auth {
        require(isPaused, 'TASK_ALREADY_UNPAUSED');
        isPaused = false;
        emit Unpaused();
    }

    /**
     * @dev Hook to be called before the task call starts. This implementation only adds a not-paused guard
     */
    function _beforeTask(address, uint256) internal virtual override {
        require(!isPaused, 'TASK_PAUSED');
    }
}
