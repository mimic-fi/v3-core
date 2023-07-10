// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../base/BaseTask.sol';
import '../../base/TimeLockedTask.sol';

contract TimeLockedTaskMock is BaseTask, TimeLockedTask {
    bytes32 public constant override EXECUTION_TYPE = keccak256('TIME_LOCKED_TASK');

    struct TimeLockMockConfig {
        BaseConfig baseConfig;
        TimeLockConfig timeLockConfig;
    }

    function initialize(TimeLockMockConfig memory config) external virtual initializer {
        __BaseTask_init(config.baseConfig);
        __TimeLockedTask_init(config.timeLockConfig);
    }

    function call() external {
        _beforeTimeLockedTaskMock();
        _afterTimeLockedTaskMock();
    }

    /**
     * @dev Before time locked task mock hook
     */
    function _beforeTimeLockedTaskMock() internal virtual {
        _beforeBaseTask(address(0), 0);
        _beforeTimeLockedTask(address(0), 0);
    }

    /**
     * @dev After time locked task mock hook
     */
    function _afterTimeLockedTaskMock() internal virtual {
        _afterTimeLockedTask(address(0), 0);
        _afterBaseTask(address(0), 0);
    }
}
