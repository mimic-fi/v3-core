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
 * @title Connext bridger task
 * @dev Task that extends the bridger task to use Connext
 */
contract ConnextBridger is IConnextBridger, BaseBridgeTask {
    using FixedPoint for uint256;
    using EnumerableMap for EnumerableMap.AddressToUintMap;

    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('CONNEXT_BRIDGER');

    // Default relayer fee
    uint256 public override defaultRelayerFee;

    // Relayer fee per token address
    EnumerableMap.AddressToUintMap private _customRelayerFees;

    /**
     * @dev Custom relayer fee config
     */
    struct CustomRelayerFee {
        address token;
        uint256 relayerFee;
    }

    /**
     * @dev Connext bridger task config. Only used in the initializer
     */
    struct ConnextBridgeConfig {
        uint256 defaultRelayerFee;
        CustomRelayerFee[] customRelayerFees;
        BaseBridgeConfig baseConfig;
    }

    /**
     * @dev Creates a Connext bridger task
     */
    function initialize(ConnextBridgeConfig memory config) external initializer {
        _initialize(config.baseConfig);
        _setDefaultRelayerFee(config.defaultRelayerFee);

        for (uint256 i = 0; i < config.customRelayerFees.length; i++) {
            _setCustomRelayerFee(config.customRelayerFees[i].token, config.customRelayerFees[i].relayerFee);
        }
    }

    /**
     * @dev Tells the relayer fee for a token
     */
    function customRelayerFee(address token) external view override returns (uint256 fee) {
        (, fee) = _customRelayerFees.tryGet(token);
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
     * @dev Execute Connext bridger task
     */
    function call(address token, uint256 amountIn, uint256 slippage, uint256 relayerFee)
        external
        override
        authP(authParams(token, amountIn, slippage, relayerFee))
        baseBridgeTaskCall(token, amountIn, slippage)
    {
        _validateFee(token, amountIn, relayerFee);

        uint256 minAmountOut = amountIn.mulUp(FixedPoint.ONE - slippage);
        bytes memory connectorData = abi.encodeWithSelector(
            ConnextConnector.execute.selector,
            _getApplicableDestinationChain(token),
            token,
            amountIn,
            minAmountOut,
            recipient,
            relayerFee
        );

        ISmartVault(smartVault).execute(connector, connectorData);
    }

    /**
     * @dev Tells the relayer fee that should be used for a token
     */
    function _getApplicableRelayerFee(address token) internal view returns (uint256) {
        return _customRelayerFees.contains(token) ? _customRelayerFees.get(token) : defaultRelayerFee;
    }

    /**
     * @dev Tells if the requested fee is valid based on the relayer fee configured for a token
     */
    function _isFeeValid(address token, uint256 amount, uint256 fee) internal view returns (bool) {
        return fee.divUp(amount) <= _getApplicableRelayerFee(token);
    }

    /**
     * @dev Reverts if the requested fee is above the relayer fee configured for a token
     */
    function _validateFee(address token, uint256 amount, uint256 fee) internal view {
        require(_isFeeValid(token, amount, fee), 'TASK_FEE_TOO_HIGH');
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
        relayerFee == 0 ? _customRelayerFees.remove(token) : _customRelayerFees.set(token, relayerFee);
        emit CustomRelayerFeeSet(token, relayerFee);
    }
}
