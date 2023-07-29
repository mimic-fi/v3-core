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
     * @dev Emitted every time the default max fee percentage is set
     */
    event DefaultMaxFeePctSet(uint256 maxFeePct);

    /**
     * @dev Emitted every time a custom max fee percentage is set
     */
    event CustomMaxFeePctSet(address indexed token, uint256 maxFeePct);

    /**
     * @dev Tells the default max fee pct
     */
    function defaultMaxFeePct() external view returns (uint256);

    /**
     * @dev Tells the max fee percentage defined for a specific token
     */
    function customMaxFeePct(address token) external view returns (uint256 maxFeePct);

    /**
     * @dev Tells the max fee percentage that should be used for a token
     * @param token Address of the token being queried
     */
    function getMaxFeePct(address token) external view returns (uint256);

    /**
     * @dev Sets the default max fee percentage
     * @param maxFeePct New default max fee percentage to be set
     */
    function setDefaultMaxFeePct(uint256 maxFeePct) external;

    /**
     * @dev Sets a custom max fee percentage
     * @param token Token address to set a max fee percentage for
     * @param maxFeePct Max fee percentage to be set for a token
     */
    function setCustomMaxFeePct(address token, uint256 maxFeePct) external;

    /**
     * @dev Execute Connext bridger task
     */
    function call(address token, uint256 amountIn, uint256 slippage, uint256 relayerFee) external;
}
