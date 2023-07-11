// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../base/BaseTask.sol';
import '../../base/TimeLockedTask.sol';

contract TimeLockedTaskMock is BaseTask, TimeLockedTask {
    bytes32 public constant override EXECUTION_TYPE = keccak256('TIME_LOCKED_TASK');

    struct Config {
        BaseConfig baseConfig;
        TimeLockConfig timeLockConfig;
    }

    function initialize(Config memory config) external initializer {
        _initialize(config.baseConfig);
        _initialize(config.timeLockConfig);
    }

    function call() external baseTaskCall(address(0), 0) {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Hook to be called before the task call starts.
     */
    function _beforeTask(address token, uint256 amount) internal virtual override(BaseTask, TimeLockedTask) {
        BaseTask._beforeTask(token, amount);
        TimeLockedTask._beforeTask(token, amount);
    }

    /**
     * @dev Hook to be called after the task call has finished.
     */
    function _afterTask(address token, uint256 amount) internal virtual override(BaseTask, TimeLockedTask) {
        TimeLockedTask._afterTask(token, amount);
        BaseTask._afterTask(token, amount);
    }
}
