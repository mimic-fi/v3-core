// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../base/BaseTask.sol';
import '../../base/TokenIndexedTask.sol';

contract TokenIndexedTaskMock is BaseTask, TokenIndexedTask {
    using EnumerableSet for EnumerableSet.AddressSet;

    bytes32 public constant override EXECUTION_TYPE = keccak256('TOKEN_INDEXED_TASK');

    struct TokenIndexMockConfig {
        BaseConfig baseConfig;
        TokenIndexConfig tokenIndexConfig;
    }

    function initialize(TokenIndexMockConfig memory config) external virtual initializer {
        __BaseTask_init(config.baseConfig);
        __TokenIndexedTask_init(config.tokenIndexConfig);
    }

    function call(address token) external {
        _beforeTokenIndexedTaskMock(token);
        _afterTokenIndexedTaskMock(token);
    }

    function isTokenAllowed(address token) external view returns (bool) {
        bool containsToken = _tokens.contains(token);
        return tokensAcceptanceType == TokensAcceptanceType.AllowList ? containsToken : !containsToken;
    }

    /**
     * @dev Before token indexed task mock hook
     */
    function _beforeTokenIndexedTaskMock(address token) internal virtual {
        _beforeBaseTask(token, 0);
        _beforeTokenIndexedTask(token, 0);
    }

    /**
     * @dev After token indexed task mock hook
     */
    function _afterTokenIndexedTaskMock(address token) internal virtual {
        _afterTokenIndexedTask(token, 0);
        _afterBaseTask(token, 0);
    }
}
