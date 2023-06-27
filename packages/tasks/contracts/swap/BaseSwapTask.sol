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
import '@mimic-fi/v3-helpers/contracts/utils/Denominations.sol';
import '@mimic-fi/v3-helpers/contracts/utils/EnumerableMap.sol';

import '../Task.sol';
import './interfaces/IBaseSwapTask.sol';

/**
 * @title Base swap task
 * @dev Task that offers the basic components for more detailed swap tasks
 */
abstract contract BaseSwapTask is IBaseSwapTask, Task {
    using FixedPoint for uint256;
    using EnumerableMap for EnumerableMap.AddressToUintMap;
    using EnumerableMap for EnumerableMap.AddressToAddressMap;

    // Connector address
    address public override connector;

    // Default token out
    address public override defaultTokenOut;

    // Default maximum slippage in fixed point
    uint256 public override defaultMaxSlippage;

    // Token out per token
    EnumerableMap.AddressToAddressMap private _customTokensOut;

    // Maximum slippage per token address
    EnumerableMap.AddressToUintMap private _customMaxSlippages;

    /**
     * @dev Modifier to tag the execution function of an task to trigger before and after hooks automatically
     */
    modifier baseSwapTaskCall(address token, uint256 amount, uint256 slippage) {
        _beforeSwapTask(token, amount, slippage);
        _;
        _afterSwapTask(token, amount, slippage);
    }

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
     * @dev Base swap task config. Only used in the initializer.
     */
    struct BaseSwapConfig {
        address connector;
        address tokenOut;
        uint256 maxSlippage;
        CustomTokenOut[] customTokensOut;
        CustomMaxSlippage[] customMaxSlippages;
        TaskConfig taskConfig;
    }

    /**
     * @dev Initializes a base swap task
     */
    function _initialize(BaseSwapConfig memory config) internal onlyInitializing {
        _initialize(config.taskConfig);
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
     * @dev Tells the token out defined for a specific token
     */
    function customTokenOut(address token) public view override returns (address tokenOut) {
        (, tokenOut) = _customTokensOut.tryGet(token);
    }

    /**
     * @dev Tells the max slippage defined for a specific token
     */
    function customMaxSlippage(address token) public view override returns (uint256 maxSlippage) {
        (, maxSlippage) = _customMaxSlippages.tryGet(token);
    }

    /**
     * @dev Sets a new connector
     * @param newConnector Address of the connector to be set
     */
    function setConnector(address newConnector) external override auth {
        _setConnector(newConnector);
    }

    /**
     * @dev Sets the default token out
     * @param tokenOut Address of the default token out to be set
     */
    function setDefaultTokenOut(address tokenOut) external override auth {
        _setDefaultTokenOut(tokenOut);
    }

    /**
     * @dev Sets the default max slippage
     * @param maxSlippage Default max slippage to be set
     */
    function setDefaultMaxSlippage(uint256 maxSlippage) external override auth {
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
     * @dev Sets a custom max slippage
     * @param token Address of the token to set a custom max slippage for
     * @param maxSlippage Max slippage to be set
     */
    function setCustomMaxSlippage(address token, uint256 maxSlippage)
        external
        override
        authP(authParams(token, maxSlippage))
    {
        _setCustomMaxSlippage(token, maxSlippage);
    }

    /**
     * @dev Tells the token out that should be used for a token
     */
    function _getApplicableTokenOut(address token) internal view returns (address) {
        return _customTokensOut.contains(token) ? _customTokensOut.get(token) : defaultTokenOut;
    }

    /**
     * @dev Tells the max slippage that should be used for a token
     */
    function _getApplicableMaxSlippage(address token) internal view returns (uint256) {
        return _customMaxSlippages.contains(token) ? _customMaxSlippages.get(token) : defaultMaxSlippage;
    }

    /**
     * @dev Hook to be called before the swap task call starts. This implementation calls the base task `_beforeTask`
     * hook and finally adds some trivial token, amount, and max slippage validations.
     */
    function _beforeSwapTask(address token, uint256 amount, uint256 slippage) internal virtual {
        _beforeTask(token, amount);
        require(token != address(0), 'TASK_TOKEN_ZERO');
        require(amount > 0, 'TASK_AMOUNT_ZERO');
        require(_getApplicableTokenOut(token) != address(0), 'TASK_TOKEN_OUT_NOT_SET');
        require(slippage <= _getApplicableMaxSlippage(token), 'TASK_SLIPPAGE_TOO_HIGH');
    }

    /**
     * @dev Hook to be called after the swap task call has finished. This implementation simply calls the base task
     * `_afterTask` hook.
     */
    function _afterSwapTask(address token, uint256 amount, uint256) internal virtual {
        _afterTask(token, amount);
    }

    /**
     * @dev Sets a new connector
     * @param newConnector Address of the connector to be set
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
        tokenOut == address(0) ? _customTokensOut.remove(token) : _customTokensOut.set(token, tokenOut);
        emit CustomTokenOutSet(token, tokenOut);
    }

    /**
     * @dev Sets a custom max slippage for a token
     * @param token Address of the token to set the custom max slippage for
     * @param maxSlippage Max slippage to be set
     */
    function _setCustomMaxSlippage(address token, uint256 maxSlippage) internal {
        require(maxSlippage <= FixedPoint.ONE, 'TASK_SLIPPAGE_ABOVE_ONE');
        maxSlippage == 0 ? _customMaxSlippages.remove(token) : _customMaxSlippages.set(token, maxSlippage);
        emit CustomMaxSlippageSet(token, maxSlippage);
    }
}
