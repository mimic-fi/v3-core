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
import '@mimic-fi/v3-connectors/contracts/interfaces/axelar/IAxelarConnector.sol';

import './BaseBridgeTask.sol';
import '../interfaces/bridge/IAxelarBridger.sol';

/**
 * @title Axelar bridger
 * @dev Task that extends the base bridge task to use Axelar
 */
contract AxelarBridger is IAxelarBridger, BaseBridgeTask {
    using FixedPoint for uint256;

    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('AXELAR_BRIDGER');

    /**
     * @dev Axelar bridge config. Only used in the initializer.
     */
    struct AxelarBridgeConfig {
        BaseBridgeConfig baseBridgeConfig;
    }

    /**
     * @dev Initializes the Axelar bridger
     * @param config Axelar bridge config
     */
    function initialize(AxelarBridgeConfig memory config) external virtual initializer {
        __AxelarBridger_init(config);
    }

    /**
     * @dev Initializes the Axelar bridger. It does call upper contracts initializers.
     * @param config Axelar bridge config
     */
    function __AxelarBridger_init(AxelarBridgeConfig memory config) internal onlyInitializing {
        __BaseBridgeTask_init(config.baseBridgeConfig);
        __AxelarBridger_init_unchained(config);
    }

    /**
     * @dev Initializes the Axelar bridger. It does not call upper contracts initializers.
     * @param config Axelar bridge config
     */
    function __AxelarBridger_init_unchained(AxelarBridgeConfig memory config) internal onlyInitializing {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Execute Axelar bridger
     */
    function call(address token, uint256 amount) external override authP(authParams(token, amount)) {
        if (amount == 0) amount = getTaskAmount(token);
        _beforeAxelarBridger(token, amount);

        bytes memory connectorData = abi.encodeWithSelector(
            IAxelarConnector.execute.selector,
            getDestinationChain(token),
            token,
            amount,
            recipient
        );

        ISmartVault(smartVault).execute(connector, connectorData);
        _afterAxelarBridger(token, amount);
    }

    /**
     * @dev Before Axelar bridger hook
     */
    function _beforeAxelarBridger(address token, uint256 amount) internal virtual {
        // Axelar does not support specifying slippage nor fee
        _beforeBaseBridgeTask(token, amount, 0, 0);
    }

    /**
     * @dev After Axelar bridger task hook
     */
    function _afterAxelarBridger(address token, uint256 amount) internal virtual {
        // Axelar does not support specifying slippage nor fee
        _afterBaseBridgeTask(token, amount, 0, 0);
    }
}
