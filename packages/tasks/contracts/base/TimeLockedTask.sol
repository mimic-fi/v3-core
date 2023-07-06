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

pragma solidity ^0.8.3;

import './BaseTask.sol';
import '../interfaces/base/ITimeLockedTask.sol';

/**
 * @dev Time lock config for tasks. It allows limiting the frequency of an task.
 */
abstract contract TimeLockedTask is ITimeLockedTask, BaseTask {
    // Period in seconds that must pass after an task has been executed
    uint256 public override timeLockDelay;

    // Future timestamp in which the task can be executed
    uint256 public override timeLockExpiration;

    /**
     * @dev Time lock config params. Only used in the initializer.
     * @param delay Period in seconds that must pass after an task has been executed
     * @param nextExecutionTimestamp Next time when the task can be executed
     */
    struct TimeLockConfig {
        uint256 delay;
        uint256 nextExecutionTimestamp;
    }

    /**
     * @dev Initializes a time locked task
     */
    function _initialize(TimeLockConfig memory config) internal onlyInitializing {
        _setTimeLockDelay(config.delay);
        _setTimeLockExpiration(config.nextExecutionTimestamp);
    }

    /**
     * @dev Sets the time-lock delay
     * @param delay New delay to be set
     */
    function setTimeLockDelay(uint256 delay) external override authP(authParams(delay)) {
        _setTimeLockDelay(delay);
    }

    /**
     * @dev Sets the time-lock expiration timestamp
     * @param expiration New expiration timestamp to be set
     */
    function setTimeLockExpiration(uint256 expiration) external override authP(authParams(expiration)) {
        _setTimeLockExpiration(expiration);
    }

    /**
     * @dev Reverts if the given time-lock is not expired
     */
    function _beforeTask(address, uint256) internal virtual override {
        require(block.timestamp >= timeLockExpiration, 'TASK_TIME_LOCK_NOT_EXPIRED');
    }

    /**
     * @dev Bumps the time-lock expire date
     */
    function _afterTask(address, uint256) internal virtual override {
        if (timeLockDelay > 0) {
            uint256 expiration = (timeLockExpiration > 0 ? timeLockExpiration : block.timestamp) + timeLockDelay;
            _setTimeLockExpiration(expiration);
        }
    }

    /**
     * @dev Sets the time-lock delay
     * @param delay New delay to be set
     */
    function _setTimeLockDelay(uint256 delay) internal {
        timeLockDelay = delay;
        emit TimeLockDelaySet(delay);
    }

    /**
     * @dev Sets the time-lock expiration timestamp
     * @param expiration New expiration timestamp to be set
     */
    function _setTimeLockExpiration(uint256 expiration) internal {
        timeLockExpiration = expiration;
        emit TimeLockExpirationSet(expiration);
    }
}
