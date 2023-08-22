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

import './IBaseMorphoAaveV3Task.sol';

/**
 * @dev Morpho-Aave V3 exiter task interface
 */
interface IMorphoAaveV3Exiter is IBaseMorphoAaveV3Task {
    /**
     * @dev The max iterations is greater than the limit
     */
    error TaskMaxIterationsLimitAboveMax(uint256 maxIterations, uint256 maxIterationsLimit);

    /**
     * @dev Emitted every time the default max iterations limit is set
     */
    event DefaultMaxIterationsLimitSet(uint256 maxIterationsLimit);

    /**
     * @dev Emitted every time a custom max iterations limit is set
     */
    event CustomMaxIterationsLimitSet(address indexed token, uint256 maxIterationsLimit);

    /**
     * @dev Tells the default max iterations limit
     */
    function defaultMaxIterationsLimit() external view returns (uint256);

    /**
     * @dev Tells the max iterations limit defined for a specific token
     * @param token Address of the token being queried
     */
    function customMaxIterationsLimit(address token) external view returns (uint256);

    /**
     * @dev Tells the max iterations limit that should be used for a token
     */
    function getMaxIterationsLimit(address token) external view returns (uint256);

    /**
     * @dev Sets the default max iterations limit
     * @param maxIterationsLimit Default max iterations limit to be set
     */
    function setDefaultMaxIterationsLimit(uint256 maxIterationsLimit) external;

    /**
     * @dev Sets a custom max iterations limit
     * @param token Address of the token to set a custom max iterations limit for
     * @param maxIterationsLimit Max iterations limit to be set
     */
    function setCustomMaxIterationsLimit(address token, uint256 maxIterationsLimit) external;

    /**
     * @dev Executes the Morpho-Aave V3 exiter task
     */
    function call(address token, uint256 amount, uint256 maxIterations) external;
}
