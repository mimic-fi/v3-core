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

import '@quant-finance/solidity-datetime/contracts/DateTime.sol';
import '@mimic-fi/v3-authorizer/contracts/Authorized.sol';

import '../interfaces/base/ITimeLockedTask.sol';

/**
 * @dev Time lock config for tasks. It allows limiting the frequency of a task.
 */
abstract contract TimeLockedTask is ITimeLockedTask, Authorized {
    using DateTime for uint256;

    uint256 private constant DAYS_28 = 60 * 60 * 24 * 28;

    /**
     * @dev Time-locks supports different frequency modes
     * @param Seconds To indicate the execution must occur every certain number of seconds
     * @param OnDay To indicate the execution must occur on day number from 1 to 28
     * @param OnLastMonthDay To indicate the execution must occur on the last day of the month
     * @param EverySomeMonths To indicate the execution must occur every certain number of months
     */
    enum Mode {
        Seconds,
        OnDay,
        OnLastMonthDay,
        EverySomeMonths
    }

    // Time lock mode
    Mode internal _mode;

    // Time lock frequency
    uint256 internal _frequency;

    // Future timestamp since when the task can be executed
    uint256 internal _allowedAt;

    // Next future timestamp since when the task can be executed to be set, only used internally
    uint256 internal _nextAllowedAt;

    // Period in seconds during when a time-locked task can be executed since the allowed timestamp
    uint256 internal _window;

    /**
     * @dev Time lock config params. Only used in the initializer.
     * @param mode Time lock mode
     * @param frequency Time lock frequency value
     * @param allowedAt Time lock allowed date
     * @param window Time lock execution window
     */
    struct TimeLockConfig {
        uint8 mode;
        uint256 frequency;
        uint256 allowedAt;
        uint256 window;
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
        _setTimeLock(config.mode, config.frequency, config.allowedAt, config.window);
    }

    /**
     * @dev Tells the time-lock related information
     */
    function getTimeLock() external view returns (uint8 mode, uint256 frequency, uint256 allowedAt, uint256 window) {
        return (uint8(_mode), _frequency, _allowedAt, _window);
    }

    /**
     * @dev Sets a new time lock
     */
    function setTimeLock(uint8 mode, uint256 frequency, uint256 allowedAt, uint256 window)
        external
        override
        authP(authParams(mode, frequency, allowedAt, window))
    {
        _setTimeLock(mode, frequency, allowedAt, window);
    }

    /**
     * @dev Before time locked task hook
     */
    function _beforeTimeLockedTask(address, uint256) internal virtual {
        // Load storage variables
        Mode mode = _mode;
        uint256 frequency = _frequency;
        uint256 allowedAt = _allowedAt;
        uint256 window = _window;

        // First we check the current timestamp is not in the past
        if (block.timestamp < allowedAt) revert TaskTimeLockActive(block.timestamp, allowedAt);

        if (mode == Mode.Seconds) {
            if (frequency == 0) return;

            // If no window is set, the next allowed date is simply moved the number of seconds set as frequency.
            // Otherwise, the offset must be validated and the next allowed date is set to the next period.
            if (window == 0) _nextAllowedAt = block.timestamp + frequency;
            else {
                uint256 diff = block.timestamp - allowedAt;
                uint256 periods = diff / frequency;
                uint256 offset = diff - (periods * frequency);
                if (offset > window) revert TaskTimeLockActive(block.timestamp, allowedAt);
                _nextAllowedAt = allowedAt + ((periods + 1) * frequency);
            }
        } else {
            uint256 day;
            uint256 monthsToAdd;

            if (mode == Mode.EverySomeMonths) {
                // Check the difference in months matches the frequency value
                uint256 diff = allowedAt.diffMonths(block.timestamp);
                if (diff % frequency != 0) revert TaskTimeLockActive(block.timestamp, allowedAt);
                day = allowedAt.getDay();
                monthsToAdd = frequency;
            } else {
                if (mode == Mode.OnDay) {
                    day = allowedAt.getDay();
                } else if (mode == Mode.OnLastMonthDay) {
                    day = block.timestamp.getDaysInMonth();
                } else {
                    revert TaskInvalidFrequencyMode(uint8(mode));
                }

                // Check the current day matches the one in the configuration
                if (block.timestamp.getDay() != day) revert TaskTimeLockActive(block.timestamp, allowedAt);
                monthsToAdd = 1;
            }

            // Construct when would be the current allowed timestamp only considering the current month and year
            uint256 currentAllowedAt = _getCurrentAllowedDateForMonthlyRelativeFrequency(allowedAt, day);

            // Since we already checked the current timestamp is not before the allowed timestamp set,
            // we simply need to check we are withing the allowed execution window
            if (block.timestamp - currentAllowedAt > window) revert TaskTimeLockActive(block.timestamp, allowedAt);

            // Finally set the next allowed date to the corresponding number of months from the current date
            _nextAllowedAt = _getNextAllowedDateForMonthlyRelativeFrequency(currentAllowedAt, monthsToAdd);
        }
    }

    /**
     * @dev After time locked task hook
     */
    function _afterTimeLockedTask(address, uint256) internal virtual {
        if (_nextAllowedAt == 0) return;
        _setTimeLockAllowedAt(_nextAllowedAt);
        _nextAllowedAt = 0;
    }

    /**
     * @dev Sets a new time lock
     */
    function _setTimeLock(uint8 mode, uint256 frequency, uint256 allowedAt, uint256 window) internal {
        if (mode == uint8(Mode.Seconds)) {
            // The execution window and timestamp are optional, but both must be given or none
            // If given the execution window cannot be larger than the number of seconds
            // Also, if these are given the frequency must be checked as well, otherwise it could be unsetting the lock
            if (window > 0 || allowedAt > 0) {
                if (frequency == 0) revert TaskInvalidFrequency(mode, frequency);
                if (window == 0 || window > frequency) revert TaskInvalidAllowedWindow(mode, window);
                if (allowedAt == 0) revert TaskInvalidAllowedDate(mode, allowedAt);
            }
        } else if (mode == uint8(Mode.OnDay)) {
            // It must be valid for every month, then the frequency value cannot be larger than 28 days
            if (frequency == 0 || frequency > 28) revert TaskInvalidFrequency(mode, frequency);

            // The execution window that cannot be larger than 28 days
            if (window == 0 || window > DAYS_28) revert TaskInvalidAllowedWindow(mode, window);

            // The allowed date must match the specified frequency value
            if (allowedAt == 0 || allowedAt.getDay() != frequency) revert TaskInvalidAllowedDate(mode, allowedAt);
        } else if (mode == uint8(Mode.OnLastMonthDay)) {
            // There must be no frequency value in this case
            if (frequency != 0) revert TaskInvalidFrequency(mode, frequency);

            // The execution window that cannot be larger than 28 days
            if (window == 0 || window > DAYS_28) revert TaskInvalidAllowedWindow(mode, window);

            // The allowed date timestamp must be the last day of the month
            if (allowedAt == 0) revert TaskInvalidAllowedDate(mode, allowedAt);
            if (allowedAt.getDay() != allowedAt.getDaysInMonth()) revert TaskInvalidAllowedDate(mode, allowedAt);
        } else if (mode == uint8(Mode.EverySomeMonths)) {
            // There is no limit on the number of months
            if (frequency == 0) revert TaskInvalidFrequency(mode, frequency);

            // The execution window cannot be larger than the number of months considering months of 28 days
            if (window == 0 || window > frequency * DAYS_28) revert TaskInvalidAllowedWindow(mode, window);

            // The execution allowed at timestamp and the day cannot be greater than the 28th
            if (allowedAt == 0 || allowedAt.getDay() > 28) revert TaskInvalidAllowedDate(mode, allowedAt);
        } else {
            revert TaskInvalidFrequencyMode(mode);
        }

        _mode = Mode(mode);
        _frequency = frequency;
        _allowedAt = allowedAt;
        _window = window;

        emit TimeLockSet(mode, frequency, allowedAt, window);
    }

    /**
     * @dev Sets the time-lock execution allowed timestamp
     * @param allowedAt New execution allowed timestamp to be set
     */
    function _setTimeLockAllowedAt(uint256 allowedAt) internal {
        _allowedAt = allowedAt;
        emit TimeLockAllowedAtSet(allowedAt);
    }

    /**
     * @dev Tells the allowed date based on a current allowed date considering the current timestamp and a specific day.
     * It builds a new date using the current timestamp's month and year, following by the specified day, and using
     * the current allowed date hours, minutes, and seconds.
     */
    function _getCurrentAllowedDateForMonthlyRelativeFrequency(uint256 allowedAt, uint256 day)
        private
        view
        returns (uint256)
    {
        (uint256 year, uint256 month, ) = block.timestamp.timestampToDate();
        return _getAllowedDateFor(allowedAt, year, month, day);
    }

    /**
     * @dev Tells the next allowed date based on a current allowed date considering a number of months to increase
     */
    function _getNextAllowedDateForMonthlyRelativeFrequency(uint256 allowedAt, uint256 monthsToIncrease)
        private
        view
        returns (uint256)
    {
        (uint256 year, uint256 month, uint256 day) = allowedAt.timestampToDate();
        uint256 nextMonth = month + (monthsToIncrease % 12);
        uint256 nextYear = nextMonth > month ? year : (year + 1);
        uint256 nextDay = _mode == Mode.OnLastMonthDay ? DateTime._getDaysInMonth(nextYear, nextMonth) : day;
        return _getAllowedDateFor(allowedAt, nextYear, nextMonth, nextDay);
    }

    /**
     * @dev Builds an allowed date using a specific year, month, and day
     */
    function _getAllowedDateFor(uint256 allowedAt, uint256 year, uint256 month, uint256 day)
        private
        pure
        returns (uint256)
    {
        return
            DateTime.timestampFromDateTime(
                year,
                month,
                day,
                allowedAt.getHour(),
                allowedAt.getMinute(),
                allowedAt.getSecond()
            );
    }
}
