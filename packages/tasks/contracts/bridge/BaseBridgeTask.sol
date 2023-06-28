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

import './interfaces/IBaseBridgeTask.sol';
import '../Task.sol';

/**
 * @title Base bridge task
 * @dev Task that offers the basic components for more detailed bridge tasks
 */
abstract contract BaseBridgeTask is IBaseBridgeTask, Task {
    using FixedPoint for uint256;
    using EnumerableMap for EnumerableMap.AddressToUintMap;
    using EnumerableMap for EnumerableMap.AddressToAddressMap;

    // Connector address
    address public override connector;

    // Default destination chain
    uint256 public override defaultDestinationChain;

    // Destination chain per token address
    EnumerableMap.AddressToUintMap private _customDestinationChains;

    /**
     * @dev Modifier to tag the execution function of a task to trigger before and after hooks automatically
     * @param token Address of the token to be bridged
     * @param amount Amount of tokens to be bridged
     */
    modifier baseBridgeTaskCall(address token, uint256 amount) {
        _beforeBridgeTask(token, amount);
        _;
        _afterBridgeTask(token, amount);
    }

    /**
     * @dev Custom destination chain config
     */
    struct CustomDestinationChain {
        address token;
        uint256 destinationChain;
    }

    /**
     * @dev Base bridge task config. Only used in the initializer
     */
    struct BaseBridgeConfig {
        address connector;
        uint256 destinationChain;
        CustomDestinationChain[] customDestinationChains;
        TaskConfig taskConfig;
    }

    /**
     * @dev Initializes a base bridge task
     * @param config Base bridge task config
     */
    function _initialize(BaseBridgeConfig memory config) internal onlyInitializing {
        _initialize(config.taskConfig);
        _setConnector(config.connector);
        _setDefaultDestinationChain(config.destinationChain);

        for (uint256 i = 0; i < config.customDestinationChains.length; i++) {
            CustomDestinationChain memory customConfig = config.customDestinationChains[i];
            _setCustomDestinationChain(customConfig.token, customConfig.destinationChain);
        }
    }

    /**
     * @dev Tells the destination chain defined for a specific token
     * @param token Address of the token to get the destination chain for
     * @return destinationChain Destination chain to be used
     */
    function customDestinationChain(address token) public view override returns (bool, uint256) {
        return _customDestinationChains.tryGet(token);
    }

    /**
     * @dev Sets a new connector
     * @param newConnector Address of the connector to be set
     */
    function setConnector(address newConnector) external override auth {
        _setConnector(newConnector);
    }

    /**
     * @dev Sets the default destination chain
     * @param destinationChain Default destination chain to be set
     */
    function setDefaultDestinationChain(uint256 destinationChain) external override auth {
        _setDefaultDestinationChain(destinationChain);
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
     * @dev Tells the destination chain that should be used for a token
     * @param token Address of the token to get the destination chain for
     * @return destinationChain Destination chain to be used
     */
    function _getApplicableDestinationChain(address token) internal view returns (uint256) {
        return _customDestinationChains.contains(token) ? _customDestinationChains.get(token) : defaultDestinationChain;
    }

    /**
     * @dev Hook to be called before the bridge task call starts. This implementation calls the base task `_beforeTask`
     * hook and finally adds some trivial token and amount validations.
     * @param token Address of the token to be bridged
     * @param amount Amount of tokens to be bridged
     */
    function _beforeBridgeTask(address token, uint256 amount) internal virtual {
        _beforeTask(token, amount);
        require(token != address(0), 'TASK_TOKEN_ZERO');
        require(amount > 0, 'TASK_AMOUNT_ZERO');
        require(_getApplicableDestinationChain(token) != 0, 'TASK_DESTINATION_CHAIN_NOT_SET');
    }

    /**
     * @dev Hook to be called after the bridge task call has finished. This implementation simply calls the base task
     * `_afterTask` hook.
     * @param token Address of the token to be bridged
     * @param amount Amount of tokens to be bridged
     */
    function _afterBridgeTask(address token, uint256 amount) internal virtual {
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
     * @dev Sets the default destination chain
     * @param destinationChain Default destination chain to be set
     */
    function _setDefaultDestinationChain(uint256 destinationChain) internal {
        require(destinationChain != block.chainid, 'TASK_BRIDGE_CURRENT_CHAIN_ID');
        defaultDestinationChain = destinationChain;
        emit DefaultDestinationChainSet(destinationChain);
    }

    /**
     * @dev Sets a custom destination chain for a token
     * @param token Address of the token to set the custom destination chain for
     * @param destinationChain Destination chain to be set
     */
    function _setCustomDestinationChain(address token, uint256 destinationChain) internal {
        require(destinationChain != block.chainid, 'TASK_BRIDGE_CURRENT_CHAIN_ID');

        destinationChain == 0
            ? _customDestinationChains.remove(token)
            : _customDestinationChains.set(token, destinationChain);

        emit CustomDestinationChainSet(token, destinationChain);
    }
}
