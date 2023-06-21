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
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';

import '@mimic-fi/v3-authorizer/contracts/Authorized.sol';
import '@mimic-fi/v3-authorizer/contracts/interfaces/IAuthorizer.sol';
import '@mimic-fi/v3-fee-controller/contracts/interfaces/IFeeController.sol';
import '@mimic-fi/v3-helpers/contracts/math/FixedPoint.sol';
import '@mimic-fi/v3-helpers/contracts/utils/ERC20Helpers.sol';
import '@mimic-fi/v3-helpers/contracts/utils/IWrappedNativeToken.sol';
import '@mimic-fi/v3-price-oracle/contracts/interfaces/IPriceOracle.sol';
import '@mimic-fi/v3-registry/contracts/interfaces/IRegistry.sol';

import './interfaces/ISmartVault.sol';

/**
 * @title Smart Vault
 * @dev Core component where the interaction with the DeFi world occurs
 */
contract SmartVault is ISmartVault, Authorized, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;
    using FixedPoint for uint256;

    // Price oracle reference
    address public override priceOracle;

    // Mimic registry reference
    address public immutable override registry;

    // Mimic fee controller reference
    address public immutable override feeController;

    // Wrapped native token reference
    address public immutable override wrappedNativeToken;

    // Tells whether a connector check is ignored or not
    mapping (address => bool) public override isConnectorCheckIgnored;

    /**
     * @dev Creates a new Smart Vault implementation with the references that should be shared among all implementations
     * @param _feeController Address of the Mimic fee controller to be referenced
     * @param _wrappedNativeToken Address of the wrapped native token to be used
     */
    constructor(address _registry, address _feeController, address _wrappedNativeToken) {
        _disableInitializers();
        registry = _registry;
        feeController = _feeController;
        wrappedNativeToken = _wrappedNativeToken;
    }

    /**
     * @dev Initializes the Smart Vault instance
     * @param _authorizer Address of the authorizer to be linked
     * @param _priceOracle Address of the price oracle to be set, it is ignored in case it's zero
     */
    function initialize(address _authorizer, address _priceOracle) external initializer {
        __ReentrancyGuard_init();
        _initialize(_authorizer);
        _setPriceOracle(_priceOracle);
    }

    /**
     * @dev It allows receiving native token transfers
     */
    receive() external payable {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Sets the price oracle. Sender must be authorized.
     * @param newPriceOracle Address of the new price oracle to be set
     */
    function setPriceOracle(address newPriceOracle) external override nonReentrant authP(authParams(newPriceOracle)) {
        _setPriceOracle(newPriceOracle);
    }

    /**
     * @dev Overrides connector checks. Sender must be authorized.
     * @param connector Address of the connector to override its check
     * @param ignored Whether the connector check should be ignored
     */
    function overrideConnectorCheck(address connector, bool ignored)
        external
        nonReentrant
        authP(authParams(connector, ignored))
    {
        isConnectorCheckIgnored[connector] = ignored;
        emit ConnectorCheckOverridden(connector, ignored);
    }

    /**
     * @dev Executes a connector inside of the Smart Vault context. Sender must be authorized.
     * @param connector Address of the connector that will be executed
     * @param data Call data to be used for the delegate-call
     * @return result Call response if it was successful, otherwise it reverts
     */
    function execute(address connector, bytes memory data)
        external
        override
        nonReentrant
        authP(authParams(connector))
        returns (bytes memory result)
    {
        _validateConnector(connector);
        result = Address.functionDelegateCall(connector, data, 'SMART_VAULT_EXECUTE_FAILED');
        emit Executed(connector, data, result);
    }

    /**
     * @dev Executes an arbitrary call from the Smart Vault. Sender must be authorized.
     * @param target Address where the call will be sent
     * @param data Call data to be used for the call
     * @param value Value in wei that will be attached to the call
     * @return result Call response if it was successful, otherwise it reverts
     */
    function call(address target, bytes memory data, uint256 value)
        external
        override
        nonReentrant
        authP(authParams(target))
        returns (bytes memory result)
    {
        result = Address.functionCallWithValue(target, data, value, 'SMART_VAULT_CALL_FAILED');
        emit Called(target, data, value, result);
    }

    /**
     * @dev Wrap an amount of native tokens to the wrapped ERC20 version of it. Sender must be authorized.
     * @param amount Amount of native tokens to be wrapped
     */
    function wrap(uint256 amount) external override nonReentrant authP(authParams(amount)) {
        require(amount > 0, 'SMART_VAULT_WRAP_AMOUNT_ZERO');
        require(address(this).balance >= amount, 'SMART_VAULT_WRAP_NO_BALANCE');
        IWrappedNativeToken(wrappedNativeToken).deposit{ value: amount }();
        emit Wrapped(amount);
    }

    /**
     * @dev Unwrap an amount of wrapped native tokens. Sender must be authorized.
     * @param amount Amount of wrapped native tokens to unwrapped
     */
    function unwrap(uint256 amount) external override nonReentrant authP(authParams(amount)) {
        require(amount > 0, 'SMART_VAULT_UNWRAP_AMOUNT_ZERO');
        IWrappedNativeToken(wrappedNativeToken).withdraw(amount);
        emit Unwrapped(amount);
    }

    /**
     * @dev Collect tokens from an external account to the Smart Vault. Sender must be authorized.
     * @param token Address of the token to be collected
     * @param from Address where the tokens will be transfer from
     * @param amount Amount of tokens to be transferred
     */
    function collect(address token, address from, uint256 amount)
        external
        override
        nonReentrant
        authP(authParams(token, from, amount))
    {
        require(amount > 0, 'SMART_VAULT_COLLECT_AMOUNT_ZERO');
        IERC20(token).safeTransferFrom(from, address(this), amount);
        emit Collected(token, from, amount);
    }

    /**
     * @dev Withdraw tokens to an external account. Sender must be authorized.
     * @param token Address of the token to be withdrawn
     * @param recipient Address where the tokens will be transferred to
     * @param amount Amount of tokens to withdraw
     */
    function withdraw(address token, address recipient, uint256 amount)
        external
        override
        nonReentrant
        authP(authParams(token, recipient, amount))
    {
        require(amount > 0, 'SMART_VAULT_WITHDRAW_AMOUNT_ZERO');
        require(recipient != address(0), 'SMART_VAULT_WITHDRAW_DEST_ZERO');

        (, uint256 pct, address collector) = IFeeController(feeController).getFee(address(this));
        uint256 feeAmount = amount.mulDown(pct);
        _safeTransfer(token, collector, feeAmount);

        uint256 withdrawn = amount - feeAmount;
        _safeTransfer(token, recipient, withdrawn);
        emit Withdrawn(token, recipient, withdrawn, feeAmount);
    }

    /**
     * @dev Transfers ERC20 or native tokens from the Smart Vault to an external account
     * @param token Address of the ERC20 token to transfer
     * @param to Address transferring the tokens to
     * @param amount Amount of tokens to transfer
     */
    function _safeTransfer(address token, address to, uint256 amount) internal {
        if (amount == 0) return;
        ERC20Helpers.transfer(token, to, amount);
    }

    /**
     * @dev Sets the price oracle instance
     * @param newPriceOracle Address of the new price oracle to be set
     */
    function _setPriceOracle(address newPriceOracle) internal {
        priceOracle = newPriceOracle;
        emit PriceOracleSet(newPriceOracle);
    }

    /**
     * @dev Validates a connector against the Mimic Registry
     * @param connector Address of the connector to validate
     */
    function _validateConnector(address connector) private view {
        if (isConnectorCheckIgnored[connector]) return;
        require(IRegistry(registry).isRegistered(connector), 'SMART_VAULT_CON_NOT_REGISTERED');
        require(IRegistry(registry).isStateless(connector), 'SMART_VAULT_CON_NOT_STATELESS');
        require(!IRegistry(registry).isDeprecated(connector), 'SMART_VAULT_CON_DEPRECATED');
    }
}
