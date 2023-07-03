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
import '@mimic-fi/v3-connectors/contracts/bridge/axelar/AxelarConnector.sol';

import './BaseBridgeTask.sol';
import './interfaces/IAxelarBridger.sol';

/**
 * @title Axelar bridger task
 * @dev Task that extends the bridger task to use Axelar
 */
contract AxelarBridger is IAxelarBridger, BaseBridgeTask {
    using FixedPoint for uint256;

    /**
     * @dev Axelar bridger task config. Only used in the initializer.
     * @param baseBridgeConfig Base bridge task config params
     */
    struct AxelarBridgerConfig {
        BaseBridgeConfig baseBridgeConfig;
    }

    /**
     * @dev Creates a Axelar bridger task
     */
    function initialize(AxelarBridgerConfig memory config) external initializer {
        _initialize(config.baseBridgeConfig);
    }

    /**
     * @dev Execute Axelar bridger task
     */
    function call(address token, uint256 amountIn)
        external
        override
        authP(authParams(token, amountIn))
        baseBridgeTaskCall(token, amountIn, 0)
    {
        bytes memory connectorData = abi.encodeWithSelector(
            AxelarConnector.execute.selector,
            _getApplicableDestinationChain(token),
            token,
            amountIn,
            address(smartVault)
        );

        ISmartVault(smartVault).execute(connector, connectorData);
    }
}
