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

pragma solidity >=0.8.0;

import './IBaseBridgeTask.sol';

/**
 * @dev Connext bridger task interface
 */
interface IConnextBridger is IBaseBridgeTask {
    /**
     * @dev Emitted every time the default relayer fee is set
     */
    event DefaultRelayerFeeSet(uint256 relayerFee);

    /**
     * @dev Emitted every time a custom relayer fee is set
     */
    event CustomRelayerFeeSet(address indexed token, uint256 relayerFee);

    /**
     * @dev Tells the default relayer fee
     */
    function defaultRelayerFee() external view returns (uint256);

    /**
     * @dev Tells the relayer fee defined for a specific token
     */
    function customRelayerFee(address token) external view returns (uint256);

    /**
     * @dev Tells the max fee percentage that should be used for a token
     * @param token Address of the token being queried
     */
    function getMaxFeePct(address token) external view returns (uint256);

    /**
     * @dev Sets the default relayer fee
     */
    function setDefaultRelayerFee(uint256 relayerFee) external;

    /**
     * @dev Sets a custom relayer fee for a specific token
     */
    function setCustomRelayerFee(address token, uint256 relayerFee) external;

    /**
     * @dev Execute Connext bridger task
     */
    function call(address token, uint256 amountIn, uint256 slippage, uint256 relayerFee) external;
}
