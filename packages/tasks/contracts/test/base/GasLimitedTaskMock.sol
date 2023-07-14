// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../base/BaseTask.sol';
import '../../base/GasLimitedTask.sol';

contract GasLimitedTaskMock is BaseTask, GasLimitedTask {
    bytes32 public constant override EXECUTION_TYPE = keccak256('GAS_LIMITED_TASK');

    struct GasLimitMockConfig {
        BaseConfig baseConfig;
        GasLimitConfig gasLimitConfig;
    }

    function initialize(GasLimitMockConfig memory config) external virtual initializer {
        __BaseTask_init(config.baseConfig);
        __GasLimitedTask_init(config.gasLimitConfig);
    }

    function call(address token, uint256 amount) external {
        _beforeGasLimitedTaskMock(token, amount);
        _afterGasLimitedTaskMock(token, amount);
    }

    /**
     * @dev Fetches a base/quote price
     */
    function _getPrice(address base, address quote) internal view override(BaseTask, GasLimitedTask) returns (uint256) {
        return BaseTask._getPrice(base, quote);
    }

    /**
     * @dev Before gas limited task mock hook
     */
    function _beforeGasLimitedTaskMock(address token, uint256 amount) internal virtual {
        _beforeBaseTask(token, amount);
        _beforeGasLimitedTask(token, amount);
    }

    /**
     * @dev After gas limited task mock hook
     */
    function _afterGasLimitedTaskMock(address token, uint256 amount) internal virtual {
        _afterGasLimitedTask(token, amount);
        _afterBaseTask(token, amount);
    }
}
