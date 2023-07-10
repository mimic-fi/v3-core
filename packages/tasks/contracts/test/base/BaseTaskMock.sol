// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../base/BaseTask.sol';

contract BaseTaskMock is BaseTask {
    bytes32 public constant override EXECUTION_TYPE = keccak256('BASE_TASK');

    function initialize(BaseConfig memory config) external virtual initializer {
        __BaseTask_init(config);
    }

    function call(address token, uint256 amount) external {
        _beforeBaseTask(token, amount);
        _afterBaseTask(token, amount);
    }
}
