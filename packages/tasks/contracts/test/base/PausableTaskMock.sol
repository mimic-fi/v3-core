// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../base/PausableTask.sol';

contract PausableTaskMock is PausableTask {
    bytes32 public constant override EXECUTION_TYPE = keccak256('PAUSABLE_TASK');

    function initialize(BaseConfig memory config) external initializer {
        _initialize(config);
    }

    function call(address token, uint256 amount) external baseTaskCall(token, amount) {
        // solhint-disable-previous-line no-empty-blocks
    }
}
