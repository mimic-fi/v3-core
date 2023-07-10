// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../base/BaseTask.sol';
import '../../base/TokenThresholdTask.sol';

contract TokenThresholdTaskMock is BaseTask, TokenThresholdTask {
    bytes32 public constant override EXECUTION_TYPE = keccak256('TOKEN_THRESHOLD_TASK');

    struct TokenThresholdMockConfig {
        BaseConfig baseConfig;
        TokenThresholdConfig tokenThresholdConfig;
    }

    function initialize(TokenThresholdMockConfig memory config) external virtual initializer {
        __BaseTask_init(config.baseConfig);
        __TokenThresholdTask_init(config.tokenThresholdConfig);
    }

    function call(address token, uint256 amount) external {
        _beforeTokenThresholdTask(token, amount);
        _afterTokenThresholdTask(token, amount);
    }

    /**
     * @dev Fetches a base/quote price
     */
    function _getPrice(address base, address quote)
        internal
        view
        override(BaseTask, TokenThresholdTask)
        returns (uint256)
    {
        return BaseTask._getPrice(base, quote);
    }

    /**
     * @dev Before token threshold task mock hook
     */
    function _beforeTokenThresholdTaskMock(address token, uint256 amount) internal virtual {
        _beforeBaseTask(token, amount);
        _beforeTokenThresholdTask(token, amount);
    }

    /**
     * @dev After token threshold task mock hook
     */
    function _afterTokenThresholdTaskMock(address token, uint256 amount) internal virtual {
        _afterTokenThresholdTask(token, amount);
        _afterBaseTask(token, amount);
    }
}
