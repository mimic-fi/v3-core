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

import '@mimic-fi/v3-connectors/contracts/interfaces/socket/ISocketConnector.sol';

import './BaseBridgeTask.sol';
import '../interfaces/bridge/ISocketBridger.sol';

/**
 * @title Socket bridger
 * @dev Task that extends the base bridge task to use Socket
 */
contract SocketBridger is ISocketBridger, BaseBridgeTask {
    using FixedPoint for uint256;

    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('SOCKET_BRIDGER');

    /**
     * @dev Socket bridge config. Only used in the initializer.
     */
    struct SocketBridgeConfig {
        BaseBridgeConfig baseBridgeConfig;
    }

    /**
     * @dev Initializes the Socket bridger
     * @param config Socket bridge config
     */
    function initialize(SocketBridgeConfig memory config) external virtual initializer {
        __SocketBridger_init(config);
    }

    /**
     * @dev Initializes the Socket bridger. It does call upper contracts initializers.
     * @param config Socket bridge config
     */
    function __SocketBridger_init(SocketBridgeConfig memory config) internal onlyInitializing {
        __BaseBridgeTask_init(config.baseBridgeConfig);
        __SocketBridger_init_unchained(config);
    }

    /**
     * @dev Initializes the Socket bridger. It does not call upper contracts initializers.
     * @param config Socket bridge config
     */
    function __SocketBridger_init_unchained(SocketBridgeConfig memory config) internal onlyInitializing {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Execute Socket bridger
     */
    function call(address token, uint256 amount, bytes memory data) external override authP(authParams(token, amount)) {
        if (amount == 0) amount = getTaskAmount(token);
        _beforeSocketBridger(token, amount);

        bytes memory connectorData = abi.encodeWithSelector(ISocketConnector.execute.selector, token, amount, data);
        ISmartVault(smartVault).execute(connector, connectorData);
        _afterSocketBridger(token, amount);
    }

    /**
     * @dev Before Socket bridger hook
     */
    function _beforeSocketBridger(address token, uint256 amount) internal virtual {
        // Socket does not support specifying slippage nor fee
        _beforeBaseBridgeTask(token, amount, 0, 0);
    }

    /**
     * @dev After Socket bridger task hook
     */
    function _afterSocketBridger(address token, uint256 amount) internal virtual {
        // Socket does not support specifying slippage nor fee
        _afterBaseBridgeTask(token, amount, 0, 0);
    }
}
