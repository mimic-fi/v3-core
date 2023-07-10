// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../base/BaseTask.sol';
import '../../base/VolumeLimitedTask.sol';

contract VolumeLimitedTaskMock is BaseTask, VolumeLimitedTask {
    bytes32 public constant override EXECUTION_TYPE = keccak256('VOLUME_LIMITED_TASK');

    struct VolumeLimitMockConfig {
        BaseConfig baseConfig;
        VolumeLimitConfig volumeLimitConfig;
    }

    function initialize(VolumeLimitMockConfig memory config) external virtual initializer {
        __BaseTask_init(config.baseConfig);
        __VolumeLimitedTask_init(config.volumeLimitConfig);
    }

    function call(address token, uint256 amount) external {
        _beforeVolumeLimitedTaskMock(token, amount);
        _afterVolumeLimitedTaskMock(token, amount);
    }

    /**
     * @dev Fetches a base/quote price
     */
    function _getPrice(address base, address quote)
        internal
        view
        override(BaseTask, VolumeLimitedTask)
        returns (uint256)
    {
        return BaseTask._getPrice(base, quote);
    }

    /**
     * @dev Before volume limited task mock hook
     */
    function _beforeVolumeLimitedTaskMock(address token, uint256 amount) internal virtual {
        _beforeBaseTask(token, amount);
        _beforeVolumeLimitedTask(token, amount);
    }

    /**
     * @dev After volume limited task mock hook
     */
    function _afterVolumeLimitedTaskMock(address token, uint256 amount) internal virtual {
        _afterVolumeLimitedTask(token, amount);
        _afterBaseTask(token, amount);
    }
}
