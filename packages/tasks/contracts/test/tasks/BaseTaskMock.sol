// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../BaseTask.sol';

contract BaseTaskMock is BaseTask {
    function initialize(BaseConfig memory config) external initializer {
        _initialize(config);
    }
}
