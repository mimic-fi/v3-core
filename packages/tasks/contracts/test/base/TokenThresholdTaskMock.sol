// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../base/BaseTask.sol';
import '../../base/TokenThresholdTask.sol';

contract TokenThresholdTaskMock is BaseTask, TokenThresholdTask {
    bytes32 public constant override EXECUTION_TYPE = keccak256('TOKEN_THRESHOLD_TASK');

    struct Config {
        BaseConfig baseConfig;
        TokenThresholdConfig tokenThresholdConfig;
    }

    function initialize(Config memory config) external initializer {
        _initialize(config.baseConfig);
        _initialize(config.tokenThresholdConfig);
    }

    function call(address token, uint256 amount) external baseTaskCall(token, amount) {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Hook to be called before the task call starts.
     */
    function _beforeTask(address token, uint256 amount) internal virtual override(BaseTask, TokenThresholdTask) {
        BaseTask._beforeTask(token, amount);
        TokenThresholdTask._beforeTask(token, amount);
    }

    /**
     * @dev Hook to be called after the task call has finished.
     */
    function _afterTask(address token, uint256 amount) internal virtual override(BaseTask) {
        BaseTask._afterTask(token, amount);
    }
}
