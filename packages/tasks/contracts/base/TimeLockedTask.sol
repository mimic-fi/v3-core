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

import '@mimic-fi/v3-authorizer/contracts/Authorized.sol';
import '../interfaces/base/ITimeLockedTask.sol';

/**
 * @dev Time lock config for tasks. It allows limiting the frequency of a task.
 */
abstract contract TimeLockedTask is ITimeLockedTask, Authorized {
    // Period in seconds that must pass after a task has been executed
    uint256 public override timeLockDelay;

    // Future timestamp in which the task can be executed
    uint256 public override timeLockExpiration;

    // Period in seconds during when a time-locked task can be executed right after it becomes executable
    uint256 public override timeLockExecutionPeriod;

    /**
     * @dev Time lock config params. Only used in the initializer.
     * @param delay Period in seconds that must pass after a task has been executed
     * @param nextExecutionTimestamp Next time when the task can be executed
     * @param executionPeriod Period in seconds during when a time-locked task can be executed
     */
    struct TimeLockConfig {
        uint256 delay;
        uint256 nextExecutionTimestamp;
        uint256 executionPeriod;
    }

    /**
     * @dev Initializes the time locked task. It does not call upper contracts initializers.
     * @param config Time locked task config
     */
    function __TimeLockedTask_init(TimeLockConfig memory config) internal onlyInitializing {
        __TimeLockedTask_init_unchained(config);
    }

    /**
     * @dev Initializes the time locked task. It does call upper contracts initializers.
     * @param config Time locked task config
     */
    function __TimeLockedTask_init_unchained(TimeLockConfig memory config) internal onlyInitializing {
        _setTimeLockDelay(config.delay);
        _setTimeLockExpiration(config.nextExecutionTimestamp);
        _setTimeLockExecutionPeriod(config.executionPeriod);
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
     * @dev Sets the time-lock execution period
     * @param period New execution period to be set
     */
    function setTimeLockExecutionPeriod(uint256 period) external override authP(authParams(period)) {
        _setTimeLockExecutionPeriod(period);
    }

    /**
     * @dev Tells the number of delay periods passed between the last expiration timestamp and the current timestamp
     */
    function _getDelayPeriods() internal view returns (uint256) {
        uint256 diff = block.timestamp - timeLockExpiration;
        return diff / timeLockDelay;
    }

    /**
     * @dev Before time locked task hook
     */
    function _beforeTimeLockedTask(address, uint256) internal virtual {
        if (block.timestamp < timeLockExpiration) revert TaskTimeLockNotExpired(timeLockExpiration);

        if (timeLockExecutionPeriod > 0) {
            uint256 diff = block.timestamp - timeLockExpiration;
            uint256 periods = diff / timeLockDelay;
            uint256 offset = diff - (periods * timeLockDelay);
            if (offset > timeLockExecutionPeriod) revert TaskTimeLockWaitNextPeriod(offset, timeLockExecutionPeriod);
        }
    }

    /**
     * @dev After time locked task hook
     */
    function _afterTimeLockedTask(address, uint256) internal virtual {
        if (timeLockDelay > 0) {
            uint256 nextExpirationTimestamp;
            if (timeLockExpiration == 0) {
                nextExpirationTimestamp = block.timestamp + timeLockDelay;
            } else {
                uint256 diff = block.timestamp - timeLockExpiration;
                uint256 nextPeriod = (diff / timeLockDelay) + 1;
                nextExpirationTimestamp = timeLockExpiration + (nextPeriod * timeLockDelay);
            }
            _setTimeLockExpiration(nextExpirationTimestamp);
        }
    }

    /**
     * @dev Sets the time-lock delay
     * @param delay New delay to be set
     */
    function _setTimeLockDelay(uint256 delay) internal {
        if (delay < timeLockExecutionPeriod) revert TaskExecutionPeriodGtDelay(timeLockExecutionPeriod, delay);
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

    /**
     * @dev Sets the time-lock execution period
     * @param period New execution period to be set
     */
    function _setTimeLockExecutionPeriod(uint256 period) internal {
        if (period > timeLockDelay) revert TaskExecutionPeriodGtDelay(period, timeLockDelay);
        timeLockExecutionPeriod = period;
        emit TimeLockExecutionPeriodSet(period);
    }
}
