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

import '../../ITask.sol';

/**
 * @dev Base ERC4626 task interface
 */
interface IBaseERC4626Task is ITask {
    /**
     * @dev The token is zero
     */
    error TaskTokenZero();

    /**
     * @dev The amount is zero
     */
    error TaskAmountZero();

    /**
     * @dev The connector is zero
     */
    error TaskConnectorZero();

    /**
     * @dev Emitted every time the connector is set
     */
    event ConnectorSet(address indexed connector);

    /**
     * @dev Tells the connector tied to the task
     */
    function connector() external view returns (address);

    /**
     * @dev Sets a new connector
     * @param newConnector Address of the connector to be set
     */
    function setConnector(address newConnector) external;
}
