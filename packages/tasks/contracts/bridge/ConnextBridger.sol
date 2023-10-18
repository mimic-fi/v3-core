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
import '@mimic-fi/v3-connectors/contracts/interfaces/bridge/IConnextConnector.sol';

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

    // Default max fee percentage
    uint256 public override defaultMaxFeePct;

    // Max fee percentage per token
    mapping (address => uint256) public override customMaxFeePct;

    /**
     * @dev Custom max fee percentage config. Only used in the initializer.
     */
    struct CustomMaxFeePct {
        address token;
        uint256 maxFeePct;
    }

    /**
     * @dev Connext bridge config. Only used in the initializer.
     */
    struct ConnextBridgeConfig {
        uint256 maxFeePct;
        CustomMaxFeePct[] customMaxFeePcts;
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
        _setDefaultMaxFeePct(config.maxFeePct);

        for (uint256 i = 0; i < config.customMaxFeePcts.length; i++) {
            CustomMaxFeePct memory customConfig = config.customMaxFeePcts[i];
            _setCustomMaxFeePct(customConfig.token, customConfig.maxFeePct);
        }
    }

    /**
     * @dev Tells the max fee percentage that should be used for a token
     * @param token Address of the token being queried
     */
    function getMaxFeePct(address token) public view virtual override returns (uint256) {
        uint256 maxFeePct = customMaxFeePct[token];
        return maxFeePct == 0 ? defaultMaxFeePct : maxFeePct;
    }

    /**
     * @dev Sets the default max fee percentage
     * @param maxFeePct New default max fee percentage to be set
     */
    function setDefaultMaxFeePct(uint256 maxFeePct) external override authP(authParams(maxFeePct)) {
        _setDefaultMaxFeePct(maxFeePct);
    }

    /**
     * @dev Sets a custom max fee percentage
     * @param token Token address to set a max fee percentage for
     * @param maxFeePct Max fee percentage to be set for a token
     */
    function setCustomMaxFeePct(address token, uint256 maxFeePct)
        external
        override
        authP(authParams(token, maxFeePct))
    {
        _setCustomMaxFeePct(token, maxFeePct);
    }

    /**
     * @dev Execute Connext bridger
     */
    function call(address token, uint256 amount, uint256 slippage, uint256 fee)
        external
        override
        authP(authParams(token, amount, slippage, fee))
    {
        if (amount == 0) amount = getTaskAmount(token);
        _beforeConnextBridger(token, amount, slippage, fee);

        uint256 minAmountOut = amount.mulUp(FixedPoint.ONE - slippage);
        bytes memory connectorData = abi.encodeWithSelector(
            IConnextConnector.execute.selector,
            getDestinationChain(token),
            token,
            amount,
            minAmountOut,
            recipient,
            fee
        );

        ISmartVault(smartVault).execute(connector, connectorData);
        _afterConnextBridger(token, amount, slippage, fee);
    }

    /**
     * @dev Before connext bridger hook
     */
    function _beforeConnextBridger(address token, uint256 amount, uint256 slippage, uint256 fee) internal virtual {
        _beforeBaseBridgeTask(token, amount, slippage, fee);
        uint256 feePct = fee.divUp(amount);
        uint256 maxFeePct = getMaxFeePct(token);
        if (feePct > maxFeePct) revert TaskFeePctAboveMax(feePct, maxFeePct);
    }

    /**
     * @dev After connext bridger hook
     */
    function _afterConnextBridger(address token, uint256 amount, uint256 slippage, uint256 fee) internal virtual {
        _afterBaseBridgeTask(token, amount, slippage, fee);
    }

    /**
     * @dev Sets the default max fee percentage
     * @param maxFeePct Default max fee percentage to be set
     */
    function _setDefaultMaxFeePct(uint256 maxFeePct) internal {
        defaultMaxFeePct = maxFeePct;
        emit DefaultMaxFeePctSet(maxFeePct);
    }

    /**
     * @dev Sets a custom max fee percentage for a token
     * @param token Address of the token to set a custom max fee percentage for
     * @param maxFeePct Max fee percentage to be set for the given token
     */
    function _setCustomMaxFeePct(address token, uint256 maxFeePct) internal {
        if (token == address(0)) revert TaskTokenZero();
        customMaxFeePct[token] = maxFeePct;
        emit CustomMaxFeePctSet(token, maxFeePct);
    }
}
