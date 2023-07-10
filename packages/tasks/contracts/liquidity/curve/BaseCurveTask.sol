// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.0;

import '@mimic-fi/v3-helpers/contracts/math/FixedPoint.sol';

import '../../Task.sol';
import '../../interfaces/liquidity/curve/IBaseCurveTask.sol';

/**
 * @title Base Curve task
 * @dev Task that offers the basic components for more detailed Curve related tasks
 */
abstract contract BaseCurveTask is IBaseCurveTask, Task {
    using FixedPoint for uint256;

    // Task connector address
    address public override connector;

    // Default token out
    address public override defaultTokenOut;

    // Default maximum slippage in fixed point
    uint256 public override defaultMaxSlippage;

    // Token out per token
    mapping (address => address) public override customTokenOut;

    // Maximum slippage per token address
    mapping (address => uint256) public override customMaxSlippage;

    /**
     * @dev Custom token out config. Only used in the initializer.
     */
    struct CustomTokenOut {
        address token;
        address tokenOut;
    }

    /**
     * @dev Custom max slippage config. Only used in the initializer.
     */
    struct CustomMaxSlippage {
        address token;
        uint256 maxSlippage;
    }

    /**
     * @dev Base Curve config. Only used in the initializer.
     */
    struct BaseCurveConfig {
        address connector;
        address tokenOut;
        uint256 maxSlippage;
        CustomTokenOut[] customTokensOut;
        CustomMaxSlippage[] customMaxSlippages;
        TaskConfig taskConfig;
    }

    /**
     * @dev Initializes the base Curve task. It does call upper contracts initializers.
     * @param config Base Curve config
     */
    function __BaseCurveTask_init(BaseCurveConfig memory config) internal onlyInitializing {
        __Task_init(config.taskConfig);
        __BaseCurveTask_init_unchained(config);
    }

    /**
     * @dev Initializes the base Curve task. It does not call upper contracts initializers.
     * @param config Base Curve config
     */
    function __BaseCurveTask_init_unchained(BaseCurveConfig memory config) internal onlyInitializing {
        _setConnector(config.connector);
        _setDefaultTokenOut(config.tokenOut);
        _setDefaultMaxSlippage(config.maxSlippage);
        for (uint256 i = 0; i < config.customTokensOut.length; i++) {
            _setCustomTokenOut(config.customTokensOut[i].token, config.customTokensOut[i].tokenOut);
        }
        for (uint256 i = 0; i < config.customMaxSlippages.length; i++) {
            _setCustomMaxSlippage(config.customMaxSlippages[i].token, config.customMaxSlippages[i].maxSlippage);
        }
    }

    /**
     * @dev Tells the token out that should be used for a token
     */
    function getTokenOut(address token) public view virtual override returns (address) {
        address tokenOut = customTokenOut[token];
        return tokenOut == address(0) ? defaultTokenOut : tokenOut;
    }

    /**
     * @dev Tells the max slippage that should be used for a token
     */
    function getMaxSlippage(address token) public view virtual override returns (uint256) {
        uint256 maxSlippage = customMaxSlippage[token];
        return maxSlippage == 0 ? defaultMaxSlippage : maxSlippage;
    }

    /**
     * @dev Sets the task connector
     * @param newConnector Address of the new connector to be set
     */
    function setConnector(address newConnector) external override authP(authParams(newConnector)) {
        _setConnector(newConnector);
    }

    /**
     * @dev Sets the default token out
     * @param tokenOut Address of the default token out to be set
     */
    function setDefaultTokenOut(address tokenOut) external override authP(authParams(tokenOut)) {
        _setDefaultTokenOut(tokenOut);
    }

    /**
     * @dev Sets the default max slippage
     */
    function setDefaultMaxSlippage(uint256 maxSlippage) external override authP(authParams(maxSlippage)) {
        _setDefaultMaxSlippage(maxSlippage);
    }

    /**
     * @dev Sets a custom token out
     * @param token Address of the token to set a custom token out for
     * @param tokenOut Address of the token out to be set
     */
    function setCustomTokenOut(address token, address tokenOut) external override authP(authParams(token, tokenOut)) {
        _setCustomTokenOut(token, tokenOut);
    }

    /**
     * @dev Sets a a custom max slippage
     * @param token Address of the token to set a max slippage for
     * @param maxSlippage Max slippage to be set for the given token
     */
    function setCustomMaxSlippage(address token, uint256 maxSlippage)
        external
        override
        authP(authParams(token, maxSlippage))
    {
        _setCustomMaxSlippage(token, maxSlippage);
    }

    /**
     * @dev Before base Curve task hook
     */
    function _beforeBaseCurveTask(address token, uint256 amount, uint256 slippage) internal virtual {
        _beforeTask(token, amount);
        require(token != address(0), 'TASK_TOKEN_ZERO');
        require(amount > 0, 'TASK_AMOUNT_ZERO');
        require(getTokenOut(token) != address(0), 'TASK_TOKEN_OUT_NOT_SET');
        require(slippage <= getMaxSlippage(token), 'TASK_SLIPPAGE_TOO_HIGH');
    }

    /**
     * @dev After base Curve task hook
     */
    function _afterBaseCurveTask(address tokenIn, uint256 amountIn, uint256, address tokenOut, uint256 amountOut)
        internal
        virtual
    {
        _increaseBalanceConnector(tokenOut, amountOut);
        _afterTask(tokenIn, amountIn);
    }

    /**
     * @dev Sets the task connector
     * @param newConnector New connector to be set
     */
    function _setConnector(address newConnector) internal {
        require(newConnector != address(0), 'TASK_CONNECTOR_ZERO');
        connector = newConnector;
        emit ConnectorSet(newConnector);
    }

    /**
     * @dev Sets the default token out
     * @param tokenOut Default token out to be set
     */
    function _setDefaultTokenOut(address tokenOut) internal {
        defaultTokenOut = tokenOut;
        emit DefaultTokenOutSet(tokenOut);
    }

    /**
     * @dev Sets the default max slippage
     * @param maxSlippage Default max slippage to be set
     */
    function _setDefaultMaxSlippage(uint256 maxSlippage) internal {
        require(maxSlippage <= FixedPoint.ONE, 'TASK_SLIPPAGE_ABOVE_ONE');
        defaultMaxSlippage = maxSlippage;
        emit DefaultMaxSlippageSet(maxSlippage);
    }

    /**
     * @dev Sets a custom token out for a token
     * @param token Address of the token to set the custom token out for
     * @param tokenOut Address of the token out to be set
     */
    function _setCustomTokenOut(address token, address tokenOut) internal {
        require(token != address(0), 'TASK_TOKEN_ZERO');
        customTokenOut[token] = tokenOut;
        emit CustomTokenOutSet(token, tokenOut);
    }

    /**
     * @dev Sets a custom max slippage for a token
     * @param token Address of the token to set the custom max slippage for
     * @param maxSlippage Max slippage to be set
     */
    function _setCustomMaxSlippage(address token, uint256 maxSlippage) internal {
        require(token != address(0), 'TASK_TOKEN_ZERO');
        require(maxSlippage <= FixedPoint.ONE, 'TASK_SLIPPAGE_ABOVE_ONE');
        customMaxSlippage[token] = maxSlippage;
        emit CustomMaxSlippageSet(token, maxSlippage);
    }
}
