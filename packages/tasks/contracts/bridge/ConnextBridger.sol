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
import './interfaces/IConnextBridger.sol';

/**
 * @title Connext bridger task
 * @dev Task that extends the bridger task to use Connext
 */
contract ConnextBridger is IConnextBridger, BaseBridgeTask {
    using FixedPoint for uint256;

    /**
     * @dev Creates a Connext bridger task
     */
    function initialize(BaseBridgeConfig memory config) external initializer {
        _initialize(config);
    }

    /**
     * @dev Execute Connext bridger task
     */
    function call(address token, uint256 amountIn, uint256 slippage, uint256 relayerFee)
        external
        override
        authP(authParams(token, amountIn/**, slippage, relayerFee*/)) // TODO
        baseBridgeTaskCall(token, amountIn)
    {
        uint256 minAmountOut = amountIn.mulUp(FixedPoint.ONE - slippage);

        bytes memory connectorData = abi.encodeWithSelector(
            ConnextConnector.execute.selector,
            _getApplicableDestinationChain(token),
            token,
            amountIn,
            minAmountOut,
            address(smartVault),
            relayerFee
        );

        ISmartVault(smartVault).execute(connector, connectorData);
    }
}
