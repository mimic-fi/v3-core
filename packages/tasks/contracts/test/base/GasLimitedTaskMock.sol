// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../base/BaseTask.sol';
import '../../base/GasLimitedTask.sol';

contract GasLimitedTaskMock is BaseTask, GasLimitedTask {
    struct Config {
        BaseConfig baseConfig;
        GasLimitConfig gasLimitConfig;
    }

    function initialize(Config memory config) external initializer {
        _initialize(config.baseConfig);
        _initialize(config.gasLimitConfig);
    }

    function call(address token, uint256 amount) external baseTaskCall(token, amount) {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Hook to be called before the task call starts.
     */
    function _beforeTask(address token, uint256 amount) internal virtual override(BaseTask, GasLimitedTask) {
        BaseTask._beforeTask(token, amount);
        GasLimitedTask._beforeTask(token, amount);
    }

    /**
     * @dev Hook to be called after the task call has finished.
     */
    function _afterTask(address token, uint256 amount) internal virtual override(BaseTask, GasLimitedTask) {
        GasLimitedTask._afterTask(token, amount);
        BaseTask._afterTask(token, amount);
    }
}
