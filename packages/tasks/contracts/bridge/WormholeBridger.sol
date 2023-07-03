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
import '@mimic-fi/v3-connectors/contracts/bridge/wormhole/WormholeConnector.sol';

import './BaseBridgeTask.sol';
import './interfaces/IWormholeBridger.sol';

/**
 * @title Wormhole bridger task
 * @dev Task that extends the bridger task to use Wormhole
 */
contract WormholeBridger is IWormholeBridger, BaseBridgeTask {
    using FixedPoint for uint256;

    /**
     * @dev Wormhole bridger task config. Only used in the initializer.
     * @param baseBridgeConfig Base bridge task config params
     */
    struct WormholeBridgerConfig {
        BaseBridgeConfig baseBridgeConfig;
    }

    /**
     * @dev Creates a Wormhole bridger task
     */
    function initialize(WormholeBridgerConfig memory config) external initializer {
        _initialize(config.baseBridgeConfig);
    }

    /**
     * @dev Execute Wormhole bridger task
     */
    function call(address token, uint256 amountIn, uint256 slippage)
        external
        override
        authP(authParams(token, amountIn, slippage))
        baseBridgeTaskCall(token, amountIn, slippage)
    {
        uint256 minAmountOut = amountIn.mulUp(FixedPoint.ONE - slippage);

        bytes memory connectorData = abi.encodeWithSelector(
            WormholeConnector.execute.selector,
            _getApplicableDestinationChain(token),
            token,
            amountIn,
            minAmountOut,
            address(smartVault)
        );

        ISmartVault(smartVault).execute(connector, connectorData);
    }
}
