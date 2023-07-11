// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '@mimic-fi/v3-tasks/contracts/base/BaseTask.sol';

contract TaskMock is BaseTask {
    bytes32 public constant override EXECUTION_TYPE = keccak256('TASK');

    function initialize(BaseConfig memory config) external initializer {
        _initialize(config);
    }
}
