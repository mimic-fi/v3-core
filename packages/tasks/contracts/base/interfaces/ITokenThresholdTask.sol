// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General External License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General External License for more details.

// You should have received a copy of the GNU General External License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity >=0.8.0;

import './IBaseTask.sol';

/**
 * @dev Token threshold task interface
 */
interface ITokenThresholdTask is IBaseTask {
    /**
     * @dev Threshold defined by a token address and min/max values
     */
    struct Threshold {
        address token;
        uint256 min;
        uint256 max;
    }

    /**
     * @dev Emitted every time a default threshold is set
     */
    event DefaultTokenThresholdSet(Threshold threshold);

    /**
     * @dev Emitted every time a token threshold is set
     */
    event CustomTokenThresholdSet(address indexed token, Threshold threshold);

    /**
     * @dev Tells the default token threshold
     */
    function defaultTokenThreshold() external view returns (Threshold memory);

    /**
     * @dev Tells the custom threshold defined for a specific token
     * @param token Address of the token being queried
     */
    function customTokenThreshold(address token) external view returns (Threshold memory threshold);

    /**
     * @dev Sets a new default threshold config
     * @param threshold Threshold config to be set as the default one
     */
    function setDefaultTokenThreshold(Threshold memory threshold) external;

    /**
     * @dev Sets a custom token threshold
     * @param token Address of the token to set a custom threshold
     * @param threshold Custom threshold to be set for the given token
     */
    function setCustomTokenThreshold(address token, Threshold memory threshold) external;
}
