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

import '@mimic-fi/v3-authorizer/contracts/Authorized.sol';
import '@mimic-fi/v3-helpers/contracts/math/FixedPoint.sol';
import '@mimic-fi/v3-helpers/contracts/utils/Denominations.sol';
import '@mimic-fi/v3-helpers/contracts/utils/ERC20Helpers.sol';
import '@mimic-fi/v3-price-oracle/contracts/interfaces/IPriceOracle.sol';
import '@mimic-fi/v3-smart-vault/contracts/interfaces/ISmartVault.sol';

import '../interfaces/base/IBaseTask.sol';

/**
 * @title BaseTask
 * @dev Base task implementation with a Smart Vault reference and using the Authorizer
 */
abstract contract BaseTask is IBaseTask, Authorized {
    // Smart Vault reference
    address public override smartVault;

    // Whether the task is paused or not
    bool public override isPaused;

    // Source from where the token amounts to execute each task must be calculated
    address public override tokensSource;

    // Optional balance connector id for the previous task in the workflow
    bytes32 public override previousBalanceConnectorId;

    // Optional balance connector id for the next task in the workflow
    bytes32 public override nextBalanceConnectorId;

    /**
     * @dev Modifier to tag the execution function of an task to trigger before and after hooks automatically
     */
    modifier baseTaskCall(address token, uint256 amount) {
        _beforeTask(token, amount);
        _;
        _afterTask(token, amount);
    }

    /**
     * @dev Base task config. Only used in the initializer.
     * @param smartVault Address of the smart vault this task will reference, it cannot be changed once set
     * @param tokensSource Address of the tokens source to be set
     * @param previousBalanceConnectorId Balance connector id for the previous task in the workflow
     * @param nextBalanceConnectorId Balance connector id for the next task in the workflow
     */
    struct BaseConfig {
        address smartVault;
        address tokensSource;
        bytes32 previousBalanceConnectorId;
        bytes32 nextBalanceConnectorId;
    }

    /**
     * @dev Creates a new authorized contract. Note that initializers are disabled at creation time.
     */
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the base task
     * @param config Base task config
     */
    function _initialize(BaseConfig memory config) internal onlyInitializing {
        _initialize(ISmartVault(config.smartVault).authorizer());
        smartVault = config.smartVault;
        _setTokensSource(config.tokensSource);
        _setBalanceConnectors(config.previousBalanceConnectorId, config.nextBalanceConnectorId);
    }

    /**
     * @dev Tells the amount a task should use for a token
     * @param token Address of the token being queried
     */
    function getTaskAmount(address token) external view virtual override returns (uint256) {
        return ERC20Helpers.balanceOf(token, tokensSource);
    }

    /**
     * @dev Pauses an task
     */
    function pause() external override auth {
        require(!isPaused, 'TASK_ALREADY_PAUSED');
        isPaused = true;
        emit Paused();
    }

    /**
     * @dev Unpauses an task
     */
    function unpause() external override auth {
        require(isPaused, 'TASK_ALREADY_UNPAUSED');
        isPaused = false;
        emit Unpaused();
    }

    /**
     * @dev Sets the tokens source of the task
     * @param source Address of the new tokens source to be set
     */
    function setTokensSource(address source) external override authP(authParams(source)) {
        _setTokensSource(source);
    }

    /**
     * @dev Sets the balance connectors
     * @param previous Balance connector id of the previous task in the workflow
     * @param next Balance connector id of the next task in the workflow
     */
    function setBalanceConnectors(bytes32 previous, bytes32 next) external override authP(authParams(previous, next)) {
        _setBalanceConnectors(previous, next);
    }

    /**
     * @dev Hook to be called before the task call starts. This implementation only adds a not-paused guard.
     * It should be overwritten to add any extra logic that must run before the task is executed.
     */
    function _beforeTask(address token, uint256 amount) internal virtual {
        require(!isPaused, 'TASK_PAUSED');
        _decreaseBalanceConnector(token, amount);
    }

    /**
     * @dev Hook to be called after the task call has finished. This implementation only emits the Executed event.
     * It should be overwritten to add any extra logic that must run after the task has been executed.
     */
    function _afterTask(address, uint256) internal virtual {
        emit Executed();
    }

    /**
     * @dev Decreases the previous balance connector in the smart vault if defined
     * @param token Address of the token to update the previous balance connector of
     * @param amount Amount to be updated
     */
    function _decreaseBalanceConnector(address token, uint256 amount) internal {
        if (previousBalanceConnectorId != bytes32(0)) {
            ISmartVault(smartVault).updateBalanceConnector(previousBalanceConnectorId, token, amount, false);
        }
    }

    /**
     * @dev Increases the next balance connector in the smart vault if defined
     * @param token Address of the token to update the next balance connector of
     * @param amount Amount to be updated
     */
    function _increaseBalanceConnector(address token, uint256 amount) internal {
        if (nextBalanceConnectorId != bytes32(0)) {
            ISmartVault(smartVault).updateBalanceConnector(nextBalanceConnectorId, token, amount, true);
        }
    }

    /**
     * @dev Sets the tokens source of the task
     * @param source Address of the new tokens source to be set
     */
    function _setTokensSource(address source) internal {
        require(source != address(0), 'TASK_TOKENS_SOURCE_ZERO');
        tokensSource = source;
        emit TokensSourceSet(source);
    }

    /**
     * @dev Sets the balance connectors
     * @param previous Balance connector id of the previous task in the workflow
     * @param next Balance connector id of the next task in the workflow
     */
    function _setBalanceConnectors(bytes32 previous, bytes32 next) internal virtual {
        require(previous != next || previous == bytes32(0), 'TASK_SAME_BALANCE_CONNECTORS');
        previousBalanceConnectorId = previous;
        nextBalanceConnectorId = next;
        emit BalanceConnectorsSet(previous, next);
    }

    /**
     * @dev Fetches a base/quote price from the smart vault's price oracle
     */
    function _getPrice(address base, address quote) internal view returns (uint256) {
        address priceOracle = ISmartVault(smartVault).priceOracle();
        require(priceOracle != address(0), 'TASK_PRICE_ORACLE_NOT_SET');
        return IPriceOracle(priceOracle).getPrice(_wrappedIfNative(base), _wrappedIfNative(quote));
    }

    /**
     * @dev Tells the wrapped native token address if the given address is the native token
     * @param token Address of the token to be checked
     */
    function _wrappedIfNative(address token) internal view returns (address) {
        return Denominations.isNativeToken(token) ? _wrappedNativeToken() : token;
    }

    /**
     * @dev Tells whether a token is the native or the wrapped native token
     */
    function _isWrappedOrNative(address token) internal view returns (bool) {
        return Denominations.isNativeToken(token) || token == _wrappedNativeToken();
    }

    /**
     * @dev Tells the wrapped native token address
     */
    function _wrappedNativeToken() internal view returns (address) {
        return ISmartVault(smartVault).wrappedNativeToken();
    }
}
