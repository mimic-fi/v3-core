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
import '@mimic-fi/v3-connectors/contracts/bridge/connext/ConnextConnector.sol';

import './BaseBridgeTask.sol';
import '../interfaces/bridge/IConnextBridger.sol';

/**
 * @title Connext bridger
 * @dev Task that extends the base bridge task to use Connext
 */
contract ConnextBridger is IConnextBridger, BaseBridgeTask {
    using FixedPoint for uint256;

    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('CONNEXT_BRIDGER');

    // Default relayer fee
    uint256 public override defaultRelayerFee;

    // Relayer fee per token address
    mapping (address => uint256) public override customRelayerFee;

    /**
     * @dev Custom relayer fee config
     */
    struct CustomRelayerFee {
        address token;
        uint256 relayerFee;
    }

    /**
     * @dev Connext bridge config. Only used in the initializer.
     */
    struct ConnextBridgeConfig {
        uint256 defaultRelayerFee;
        CustomRelayerFee[] customRelayerFees;
        BaseBridgeConfig baseBridgeConfig;
    }

    /**
     * @dev Initializes the Connext bridger
     * @param config Connext bridge config
     */
    function initialize(ConnextBridgeConfig memory config) external virtual initializer {
        __ConnextBridger_init(config);
    }

    /**
     * @dev Initializes the Connext bridger. It does call upper contracts initializers.
     * @param config Connext bridge config
     */
    function __ConnextBridger_init(ConnextBridgeConfig memory config) internal onlyInitializing {
        __BaseBridgeTask_init(config.baseBridgeConfig);
        __ConnextBridger_init_unchained(config);
    }

    /**
     * @dev Initializes the Connext bridger. It does not call upper contracts initializers.
     * @param config Connext bridge config
     */
    function __ConnextBridger_init_unchained(ConnextBridgeConfig memory config) internal onlyInitializing {
        _setDefaultRelayerFee(config.defaultRelayerFee);
        for (uint256 i = 0; i < config.customRelayerFees.length; i++) {
            _setCustomRelayerFee(config.customRelayerFees[i].token, config.customRelayerFees[i].relayerFee);
        }
    }

    /**
     * @dev Tells the relayer fee that should be used for a token
     * @param token Address of the token being queried
     */
    function getRelayerFee(address token) public view virtual override returns (uint256) {
        uint256 relayerFee = customRelayerFee[token];
        return relayerFee == 0 ? defaultRelayerFee : relayerFee;
    }

    /**
     * Sets the default relayer fee
     */
    function setDefaultRelayerFee(uint256 relayerFee) external override authP(authParams(relayerFee)) {
        _setDefaultRelayerFee(relayerFee);
    }

    /**
     * @dev Sets a custom relayer fee for a token
     */
    function setCustomRelayerFee(address token, uint256 relayerFee)
        external
        override
        authP(authParams(token, relayerFee))
    {
        _setCustomRelayerFee(token, relayerFee);
    }

    /**
     * @dev Execute Connext bridger
     */
    function call(address token, uint256 amountIn, uint256 slippage, uint256 relayerFee)
        external
        override
        authP(authParams(token, amountIn, slippage, relayerFee))
    {
        _beforeConnextBridger(token, amountIn, slippage, relayerFee);
        uint256 minAmountOut = amountIn.mulUp(FixedPoint.ONE - slippage);
        bytes memory connectorData = abi.encodeWithSelector(
            ConnextConnector.execute.selector,
            getDestinationChain(token),
            token,
            amountIn,
            minAmountOut,
            recipient,
            relayerFee
        );

        ISmartVault(smartVault).execute(connector, connectorData);
        _afterConnextBridger(token, amountIn, slippage, relayerFee);
    }

    /**
     * @dev Before connext bridger hook
     */
    function _beforeConnextBridger(address token, uint256 amount, uint256 slippage, uint256 relayerFee)
        internal
        virtual
    {
        _beforeBaseBridgeTask(token, amount, slippage);
        uint256 maxRelayerFee = getRelayerFee(token);
        uint256 relayerFeePct = relayerFee.divUp(amount);
        if (relayerFeePct > maxRelayerFee) revert TaskFeeTooHigh(relayerFeePct, maxRelayerFee);
    }

    /**
     * @dev After connext bridger hook
     */
    function _afterConnextBridger(address token, uint256 amount, uint256 slippage, uint256) internal virtual {
        _afterBaseBridgeTask(token, amount, slippage);
    }

    /**
     * @dev Sets the default relayer fee
     * @param relayerFee Default relayer fee to be set
     */
    function _setDefaultRelayerFee(uint256 relayerFee) internal {
        defaultRelayerFee = relayerFee;
        emit DefaultRelayerFeeSet(relayerFee);
    }

    /**
     * @dev Sets a custom relayer fee for a token
     * @param token Address of the token to set the custom relayer fee for
     * @param relayerFee Relayer fee to be set
     */
    function _setCustomRelayerFee(address token, uint256 relayerFee) internal {
        if (token == address(0)) revert TaskTokenZero();
        customRelayerFee[token] = relayerFee;
        emit CustomRelayerFeeSet(token, relayerFee);
    }
}
