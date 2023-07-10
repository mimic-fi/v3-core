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

    // Destination chain per token address
    mapping (address => uint256) public override customDestinationChain;

    // Maximum slippage per token address
    mapping (address => uint256) public override customMaxSlippage;

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
     * @dev Base bridge config. Only used in the initializer.
     */
    struct BaseBridgeConfig {
        address connector;
        address recipient;
        uint256 destinationChain;
        uint256 maxSlippage;
        CustomDestinationChain[] customDestinationChains;
        CustomMaxSlippage[] customMaxSlippages;
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

        for (uint256 i = 0; i < config.customDestinationChains.length; i++) {
            CustomDestinationChain memory customConfig = config.customDestinationChains[i];
            _setCustomDestinationChain(customConfig.token, customConfig.destinationChain);
        }

        for (uint256 i = 0; i < config.customMaxSlippages.length; i++) {
            _setCustomMaxSlippage(config.customMaxSlippages[i].token, config.customMaxSlippages[i].maxSlippage);
        }
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
     * @dev Before base bridge task hook
     */
    function _beforeBaseBridgeTask(address token, uint256 amount, uint256 slippage) internal virtual {
        _beforeTask(token, amount);
        require(token != address(0), 'TASK_TOKEN_ZERO');
        require(amount > 0, 'TASK_AMOUNT_ZERO');
        require(getDestinationChain(token) != 0, 'TASK_DESTINATION_CHAIN_NOT_SET');
        require(slippage <= getMaxSlippage(token), 'TASK_SLIPPAGE_TOO_HIGH');
    }

    /**
     * @dev After base bridge task hook
     */
    function _afterBaseBridgeTask(address token, uint256 amount, uint256) internal virtual {
        _afterTask(token, amount);
    }

    /**
     * @dev Sets the balance connectors. Next balance connector must be unset.
     * @param previous Balance connector id of the previous task in the workflow
     * @param next Balance connector id of the next task in the workflow
     */
    function _setBalanceConnectors(bytes32 previous, bytes32 next) internal virtual override {
        require(next == bytes32(0), 'TASK_NEXT_CONNECTOR_NOT_ZERO');
        super._setBalanceConnectors(previous, next);
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
     * @dev Sets the recipient address
     * @param newRecipient Address of the new recipient to be set
     */
    function _setRecipient(address newRecipient) internal {
        require(newRecipient != address(0), 'TASK_RECIPIENT_ZERO');
        recipient = newRecipient;
        emit RecipientSet(newRecipient);
    }

    /**
     * @dev Sets the default destination chain
     * @param destinationChain Default destination chain to be set
     */
    function _setDefaultDestinationChain(uint256 destinationChain) internal {
        require(destinationChain != block.chainid, 'TASK_BRIDGE_CURRENT_CHAIN_ID');
        defaultDestinationChain = destinationChain;
        emit DefaultDestinationChainSet(destinationChain);
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
     * @dev Sets a custom destination chain for a token
     * @param token Address of the token to set the custom destination chain for
     * @param destinationChain Destination chain to be set
     */
    function _setCustomDestinationChain(address token, uint256 destinationChain) internal {
        require(token != address(0), 'TASK_TOKEN_ZERO');
        require(destinationChain != block.chainid, 'TASK_BRIDGE_CURRENT_CHAIN_ID');
        customDestinationChain[token] = destinationChain;
        emit CustomDestinationChainSet(token, destinationChain);
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
