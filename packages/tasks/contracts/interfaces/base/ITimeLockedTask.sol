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

import './IBaseTask.sol';

/**
 * @dev Time-locked task interface
 */
interface ITimeLockedTask is IBaseTask {
    /**
     * @dev Emitted every time a new time-lock delay is set
     */
    event TimeLockDelaySet(uint256 delay);

    /**
     * @dev Emitted every time a new expiration timestamp is set
     */
    event TimeLockExpirationSet(uint256 expiration);

    /**
     * @dev Tells the time-lock delay in seconds
     */
    function timeLockDelay() external view returns (uint256);

    /**
     * @dev Tells the time-lock expiration timestamp
     */
    function timeLockExpiration() external view returns (uint256);

    /**
     * @dev Sets the time-lock delay
     * @param delay New delay to be set
     */
    function setTimeLockDelay(uint256 delay) external;

    /**
     * @dev Sets the time-lock expiration timestamp
     * @param expiration New expiration timestamp to be set
     */
    function setTimeLockExpiration(uint256 expiration) external;
}
