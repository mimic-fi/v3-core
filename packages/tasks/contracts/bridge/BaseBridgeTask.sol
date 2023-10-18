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

import '../Task.sol';
import '../interfaces/bridge/IBaseBridgeTask.sol';

/**
 * @title Base bridge task
 * @dev Task that offers the basic components for more detailed bridge tasks
 */
abstract contract BaseBridgeTask is IBaseBridgeTask, Task {
    using FixedPoint for uint256;

    // Connector address
    address public override connector;

    // Connector address
    address public override recipient;

    // Default destination chain
    uint256 public override defaultDestinationChain;

    // Default maximum slippage in fixed point
    uint256 public override defaultMaxSlippage;

    // Default maximum fee
    MaxFee internal _defaultMaxFee;

    // Destination chain per token address
    mapping (address => uint256) public override customDestinationChain;

    // Maximum slippage per token address
    mapping (address => uint256) public override customMaxSlippage;

    // Maximum fee per token address
    mapping (address => MaxFee) internal _customMaxFee;

    /**
     * @dev Maximum fee defined by a token address and a max fee value
     */
    struct MaxFee {
        address token;
        uint256 amount;
    }

    /**
     * @dev Custom destination chain config. Only used in the initializer.
     */
    struct CustomDestinationChain {
        address token;
        uint256 destinationChain;
    }

    /**
     * @dev Custom max slippage config. Only used in the initializer.
     */
    struct CustomMaxSlippage {
        address token;
        uint256 maxSlippage;
    }

    /**
     * @dev Custom max fee config. Only used in the initializer.
     */
    struct CustomMaxFee {
        address token;
        MaxFee maxFee;
    }

    /**
     * @dev Base bridge config. Only used in the initializer.
     */
    struct BaseBridgeConfig {
        address connector;
        address recipient;
        uint256 destinationChain;
        uint256 maxSlippage;
        MaxFee maxFee;
        CustomDestinationChain[] customDestinationChains;
        CustomMaxSlippage[] customMaxSlippages;
        CustomMaxFee[] customMaxFees;
        TaskConfig taskConfig;
    }

    /**
     * @dev Initializes the base bridge task. It does call upper contracts initializers.
     * @param config Base bridge config
     */
    function __BaseBridgeTask_init(BaseBridgeConfig memory config) internal onlyInitializing {
        __Task_init(config.taskConfig);
        __BaseBridgeTask_init_unchained(config);
    }

    /**
     * @dev Initializes the base bridge task. It does not call upper contracts initializers.
     * @param config Base bridge config
     */
    function __BaseBridgeTask_init_unchained(BaseBridgeConfig memory config) internal onlyInitializing {
        _setConnector(config.connector);
        _setRecipient(config.recipient);
        _setDefaultDestinationChain(config.destinationChain);
        _setDefaultMaxSlippage(config.maxSlippage);
        MaxFee memory defaultFee = config.maxFee;
        _setDefaultMaxFee(defaultFee.token, defaultFee.amount);

        for (uint256 i = 0; i < config.customDestinationChains.length; i++) {
            CustomDestinationChain memory customConfig = config.customDestinationChains[i];
            _setCustomDestinationChain(customConfig.token, customConfig.destinationChain);
        }

        for (uint256 i = 0; i < config.customMaxSlippages.length; i++) {
            _setCustomMaxSlippage(config.customMaxSlippages[i].token, config.customMaxSlippages[i].maxSlippage);
        }

        for (uint256 i = 0; i < config.customMaxFees.length; i++) {
            CustomMaxFee memory customConfig = config.customMaxFees[i];
            MaxFee memory maxFee = customConfig.maxFee;
            _setCustomMaxFee(customConfig.token, maxFee.token, maxFee.amount);
        }
    }

    /**
     * @dev Tells the default max fee
     */
    function defaultMaxFee() external view override returns (address maxFeeToken, uint256 amount) {
        MaxFee memory maxFee = _defaultMaxFee;
        return (maxFee.token, maxFee.amount);
    }

    /**
     * @dev Tells the max fee defined for a specific token
     * @param token Address of the token being queried
     */
    function customMaxFee(address token) external view override returns (address maxFeeToken, uint256 amount) {
        MaxFee memory maxFee = _customMaxFee[token];
        return (maxFee.token, maxFee.amount);
    }

    /**
     * @dev Tells the destination chain that should be used for a token
     * @param token Address of the token to get the destination chain for
     */
    function getDestinationChain(address token) public view virtual override returns (uint256) {
        uint256 chain = customDestinationChain[token];
        return chain == 0 ? defaultDestinationChain : chain;
    }

    /**
     * @dev Tells the max slippage that should be used for a token
     * @param token Address of the token to get the max slippage for
     */
    function getMaxSlippage(address token) public view virtual override returns (uint256) {
        uint256 maxSlippage = customMaxSlippage[token];
        return maxSlippage == 0 ? defaultMaxSlippage : maxSlippage;
    }

    /**
     * @dev Tells the max fee that should be used for a token
     * @param token Address of the token to get the max fee for
     */
    function getMaxFee(address token) external view virtual override returns (address maxFeeToken, uint256 amount) {
        MaxFee memory maxFee = _getMaxFee(token);
        return (maxFee.token, maxFee.amount);
    }

    /**
     * @dev Sets a new connector
     * @param newConnector Address of the connector to be set
     */
    function setConnector(address newConnector) external override authP(authParams(newConnector)) {
        _setConnector(newConnector);
    }

    /**
     * @dev Sets the recipient address. Sender must be authorized.
     * @param newRecipient Address of the new recipient to be set
     */
    function setRecipient(address newRecipient) external override authP(authParams(newRecipient)) {
        _setRecipient(newRecipient);
    }

    /**
     * @dev Sets the default destination chain
     * @param destinationChain Default destination chain to be set
     */
    function setDefaultDestinationChain(uint256 destinationChain)
        external
        override
        authP(authParams(destinationChain))
    {
        _setDefaultDestinationChain(destinationChain);
    }

    /**
     * @dev Sets the default max slippage
     * @param maxSlippage Default max slippage to be set
     */
    function setDefaultMaxSlippage(uint256 maxSlippage) external override authP(authParams(maxSlippage)) {
        _setDefaultMaxSlippage(maxSlippage);
    }

    /**
     * @dev Sets the default max fee
     * @param maxFeeToken Default max fee token to be set
     * @param amount Default max fee amount to be set
     */
    function setDefaultMaxFee(address maxFeeToken, uint256 amount)
        external
        override
        authP(authParams(maxFeeToken, amount))
    {
        _setDefaultMaxFee(maxFeeToken, amount);
    }

    /**
     * @dev Sets a custom destination chain
     * @param token Address of the token to set a custom destination chain for
     * @param destinationChain Destination chain to be set
     */
    function setCustomDestinationChain(address token, uint256 destinationChain)
        external
        override
        authP(authParams(token, destinationChain))
    {
        _setCustomDestinationChain(token, destinationChain);
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
     * @dev Sets a custom max fee
     * @param token Address of the token to set a custom max fee for
     * @param maxFeeToken Max fee token to be set for the given token
     * @param amount Max fee amount to be set for the given token
     */
    function setCustomMaxFee(address token, address maxFeeToken, uint256 amount)
        external
        override
        authP(authParams(token, maxFeeToken, amount))
    {
        _setCustomMaxFee(token, maxFeeToken, amount);
    }

    /**
     * @dev Tells the max fee that should be used for a token
     * @param token Address of the token to get the max fee for
     */
    function _getMaxFee(address token) internal view virtual returns (MaxFee memory) {
        MaxFee memory maxFee = _customMaxFee[token];
        return maxFee.token == address(0) ? _defaultMaxFee : maxFee;
    }

    /**
     * @dev Before base bridge task hook
     */
    function _beforeBaseBridgeTask(address token, uint256 amount, uint256 slippage, uint256 fee) internal virtual {
        _beforeTask(token, amount);
        if (token == address(0)) revert TaskTokenZero();
        if (amount == 0) revert TaskAmountZero();
        if (getDestinationChain(token) == 0) revert TaskDestinationChainNotSet();

        uint256 maxSlippage = getMaxSlippage(token);
        if (slippage > maxSlippage) revert TaskSlippageAboveMax(slippage, maxSlippage);

        MaxFee memory maxFee = _getMaxFee(token);
        if (maxFee.token == address(0)) return;

        uint256 convertedFee = maxFee.token == token ? fee : fee.mulDown(_getPrice(token, maxFee.token));
        if (convertedFee > maxFee.amount) revert TaskFeeAboveMax(convertedFee, maxFee.amount);
    }

    /**
     * @dev After base bridge task hook
     */
    function _afterBaseBridgeTask(address token, uint256 amount, uint256, uint256) internal virtual {
        _afterTask(token, amount);
    }

    /**
     * @dev Sets the balance connectors. Next balance connector must be unset.
     * @param previous Balance connector id of the previous task in the workflow
     * @param next Balance connector id of the next task in the workflow
     */
    function _setBalanceConnectors(bytes32 previous, bytes32 next) internal virtual override {
        if (next != bytes32(0)) revert TaskNextConnectorNotZero(next);
        super._setBalanceConnectors(previous, next);
    }

    /**
     * @dev Sets a new connector
     * @param newConnector Address of the connector to be set
     */
    function _setConnector(address newConnector) internal {
        if (newConnector == address(0)) revert TaskConnectorZero();
        connector = newConnector;
        emit ConnectorSet(newConnector);
    }

    /**
     * @dev Sets the recipient address
     * @param newRecipient Address of the new recipient to be set
     */
    function _setRecipient(address newRecipient) internal {
        if (newRecipient == address(0)) revert TaskRecipientZero();
        recipient = newRecipient;
        emit RecipientSet(newRecipient);
    }

    /**
     * @dev Sets the default destination chain
     * @param destinationChain Default destination chain to be set
     */
    function _setDefaultDestinationChain(uint256 destinationChain) internal {
        if (destinationChain == block.chainid) revert TaskBridgeCurrentChainId(destinationChain);
        defaultDestinationChain = destinationChain;
        emit DefaultDestinationChainSet(destinationChain);
    }

    /**
     * @dev Sets the default max slippage
     * @param maxSlippage Default max slippage to be set
     */
    function _setDefaultMaxSlippage(uint256 maxSlippage) internal {
        if (maxSlippage > FixedPoint.ONE) revert TaskSlippageAboveOne();
        defaultMaxSlippage = maxSlippage;
        emit DefaultMaxSlippageSet(maxSlippage);
    }

    /**
     * @dev Sets the default max fee
     * @param maxFeeToken Default max fee token to be set
     * @param amount Default max fee amount to be set
     */
    function _setDefaultMaxFee(address maxFeeToken, uint256 amount) internal {
        _setMaxFee(_defaultMaxFee, maxFeeToken, amount);
        emit DefaultMaxFeeSet(maxFeeToken, amount);
    }

    /**
     * @dev Sets a custom destination chain for a token
     * @param token Address of the token to set the custom destination chain for
     * @param destinationChain Destination chain to be set
     */
    function _setCustomDestinationChain(address token, uint256 destinationChain) internal {
        if (token == address(0)) revert TaskTokenZero();
        if (destinationChain == block.chainid) revert TaskBridgeCurrentChainId(destinationChain);
        customDestinationChain[token] = destinationChain;
        emit CustomDestinationChainSet(token, destinationChain);
    }

    /**
     * @dev Sets a custom max slippage for a token
     * @param token Address of the token to set the custom max slippage for
     * @param maxSlippage Max slippage to be set
     */
    function _setCustomMaxSlippage(address token, uint256 maxSlippage) internal {
        if (token == address(0)) revert TaskTokenZero();
        if (maxSlippage > FixedPoint.ONE) revert TaskSlippageAboveOne();
        customMaxSlippage[token] = maxSlippage;
        emit CustomMaxSlippageSet(token, maxSlippage);
    }

    /**
     * @dev Sets a custom max fee for a token
     * @param token Address of the token to set the custom max fee for
     * @param maxFeeToken Max fee token to be set for the given token
     * @param amount Max fee amount to be set for the given token
     */
    function _setCustomMaxFee(address token, address maxFeeToken, uint256 amount) internal {
        if (token == address(0)) revert TaskTokenZero();
        _setMaxFee(_customMaxFee[token], maxFeeToken, amount);
        emit CustomMaxFeeSet(token, maxFeeToken, amount);
    }

    /**
     * @dev Sets a max fee
     * @param maxFee Max fee to be updated
     * @param token Max fee token to be set
     * @param amount Max fee amount to be set
     */
    function _setMaxFee(MaxFee storage maxFee, address token, uint256 amount) private {
        if (token == address(0) && amount != 0) revert TaskInvalidMaxFee();
        maxFee.token = token;
        maxFee.amount = amount;
    }
}
