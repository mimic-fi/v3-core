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

import './interfaces/ITask.sol';
import './base/BaseTask.sol';
import './base/PausableTask.sol';
import './base/GasLimitedTask.sol';
import './base/TimeLockedTask.sol';
import './base/TokenIndexedTask.sol';
import './base/TokenThresholdTask.sol';
import './base/VolumeLimitedTask.sol';

/**
 * @title Task
 * @dev Shared components across all tasks
 */
abstract contract Task is
    ITask,
    BaseTask,
    PausableTask,
    GasLimitedTask,
    TimeLockedTask,
    TokenIndexedTask,
    TokenThresholdTask,
    VolumeLimitedTask
{
    /**
     * @dev Task config params. Only used in the initializer.
     */
    struct TaskConfig {
        BaseConfig baseConfig;
        GasLimitConfig gasLimitConfig;
        TimeLockConfig timeLockConfig;
        TokenIndexConfig tokenIndexConfig;
        TokenThresholdConfig tokenThresholdConfig;
        VolumeLimitConfig volumeLimitConfig;
    }

    /**
     * @dev Initializes a task
     */
    function _initialize(TaskConfig memory config) internal onlyInitializing {
        _initialize(config.baseConfig);
        _initialize(config.gasLimitConfig);
        _initialize(config.timeLockConfig);
        _initialize(config.tokenIndexConfig);
        _initialize(config.tokenThresholdConfig);
        _initialize(config.volumeLimitConfig);
    }

    /**
     * @dev Hook to be called before the task call starts.
     */
    function _beforeTask(address token, uint256 amount)
        internal
        virtual
        override(
            BaseTask,
            PausableTask, 
            GasLimitedTask,
            TimeLockedTask,
            TokenIndexedTask,
            TokenThresholdTask,
            VolumeLimitedTask
        )
    {
        BaseTask._beforeTask(token, amount);
        PausableTask._beforeTask(token, amount);
        GasLimitedTask._beforeTask(token, amount);
        TimeLockedTask._beforeTask(token, amount);
        TokenIndexedTask._beforeTask(token, amount);
        TokenThresholdTask._beforeTask(token, amount);
        VolumeLimitedTask._beforeTask(token, amount);
    }

    /**
     * @dev Hook to be called after the task call has finished.
     */
    function _afterTask(address token, uint256 amount)
        internal
        virtual
        override(BaseTask, GasLimitedTask, TimeLockedTask, VolumeLimitedTask)
    {
        VolumeLimitedTask._beforeTask(token, amount);
        TimeLockedTask._afterTask(token, amount);
        GasLimitedTask._afterTask(token, amount);
        BaseTask._afterTask(token, amount);
    }
}
