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

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';

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
abstract contract BaseTask is IBaseTask, Authorized, ReentrancyGuardUpgradeable {
    // Smart Vault reference
    address public override smartVault;

    // Whether the task is paused or not
    bool public override isPaused;

    // Group ID of the task
    uint8 public override groupId;

    // Source from where the token amounts to execute each task must be calculated
    address public override tokensSource;

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
     * @param groupId Id of the group to which this task must refer to, use zero to avoid grouping
     * @param tokensSource Address of the tokens source to be set
     */
    struct BaseConfig {
        address smartVault;
        uint8 groupId;
        address tokensSource;
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
        __ReentrancyGuard_init();
        _initialize(ISmartVault(config.smartVault).authorizer());
        _setGroupId(config.groupId);
        _setTokensSource(config.tokensSource);
        smartVault = config.smartVault;
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
     * @dev Sets a group ID for the task. Sender must be authorized
     * @param newGroupId ID of the group to be set for the task
     */
    function setGroupId(uint8 newGroupId) external override authP(authParams(uint256(newGroupId))) {
        _setGroupId(newGroupId);
    }

    /**
     * @dev Sets the tokens source of the task
     * @param source Address of the new tokens source to be set
     */
    function setTokensSource(address source) external override authP(authParams(source)) {
        _setTokensSource(source);
    }

    /**
     * @dev Hook to be called before the task call starts. This implementation only adds a non-reentrant and
     * not-paused guard. It should be overwritten to add any extra logic that must run before the task is executed.
     */
    function _beforeTask(address, uint256) internal virtual nonReentrant {
        require(!isPaused, 'TASK_PAUSED');
    }

    /**
     * @dev Hook to be called after the task call has finished. This implementation only emits the Executed event.
     * It should be overwritten to add any extra logic that must run after the task has been executed.
     */
    function _afterTask(address, uint256) internal virtual {
        emit Executed();
    }

    /**
     * @dev Sets a group ID for the task
     * @param newGroupId ID of the group to be set for the task
     */
    function _setGroupId(uint8 newGroupId) internal {
        groupId = newGroupId;
        emit GroupIdSet(newGroupId);
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
