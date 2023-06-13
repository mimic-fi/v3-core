// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '@mimic-fi/v3-tasks/contracts/BaseTask.sol';

contract TaskMock is BaseTask {
    function initialize(BaseConfig memory config) external initializer {
        _initialize(config);
    }
}
