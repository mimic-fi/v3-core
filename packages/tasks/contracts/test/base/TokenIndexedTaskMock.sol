// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../base/BaseTask.sol';
import '../../base/TokenIndexedTask.sol';

contract TokenIndexedTaskMock is BaseTask, TokenIndexedTask {
    struct Config {
        BaseConfig baseConfig;
        TokenIndexConfig tokenIndexConfig;
    }

    function initialize(Config memory config) external initializer {
        _initialize(config.baseConfig);
        _initialize(config.tokenIndexConfig);
    }

    function call(address token) external baseTaskCall(token, 0) {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Hook to be called before the task call starts.
     */
    function _beforeTask(address token, uint256 amount) internal virtual override(BaseTask, TokenIndexedTask) {
        BaseTask._beforeTask(token, amount);
        TokenIndexedTask._beforeTask(token, amount);
    }

    /**
     * @dev Hook to be called after the task call has finished.
     */
    function _afterTask(address token, uint256 amount) internal virtual override(BaseTask) {
        BaseTask._afterTask(token, amount);
    }
}
