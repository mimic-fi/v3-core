// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../base/BaseTask.sol';
import '../../base/PausableTask.sol';

contract PausableTaskMock is BaseTask, PausableTask {
    bytes32 public constant override EXECUTION_TYPE = keccak256('PAUSABLE_TASK');

    struct PauseMockConfig {
        BaseConfig baseConfig;
    }

    function initialize(PauseMockConfig memory config) external virtual initializer {
        __BaseTask_init(config.baseConfig);
        __PausableTask_init();
    }

    function call(address token, uint256 amount) external {
        _beforePausableTaskMock(token, amount);
        _afterPausableTaskMock(token, amount);
    }

    /**
     * @dev Before pausable task mock hook
     */
    function _beforePausableTaskMock(address token, uint256 amount) internal virtual {
        _beforeBaseTask(token, amount);
        _beforePausableTask(token, amount);
    }

    /**
     * @dev After pausable task mock hook
     */
    function _afterPausableTaskMock(address token, uint256 amount) internal virtual {
        _afterPausableTask(token, amount);
        _afterBaseTask(token, amount);
    }
}
