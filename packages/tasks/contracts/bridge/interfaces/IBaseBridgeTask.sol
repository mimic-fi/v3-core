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
 * @dev Base bridge task interface
 */
interface IBaseBridgeTask is ITask {
    /**
     * @dev Emitted every time the connector is set
     */
    event ConnectorSet(address indexed connector);

    /**
     * @dev Emitted every time the default destination chain is set
     */
    event DefaultDestinationChainSet(uint256 indexed defaultDestinationChain);

    /**
     * @dev Emitted every time a custom destination chain is set for a token
     */
    event CustomDestinationChainSet(address indexed token, uint256 indexed defaultDestinationChain);

    /**
     * @dev Tells the connector tied to the task
     */
    function connector() external view returns (address);

    /**
     * @dev Tells the default destination chain
     */
    function defaultDestinationChain() external view returns (uint256);

    /**
     * @dev Tells the destination chain defined for a specific token
     */
    function customDestinationChain(address token) external view returns (bool exists, uint256 chainId);

    /**
     * @dev Sets a new connector
     * @param newConnector Address of the connector to be set
     */
    function setConnector(address newConnector) external;

    /**
     * @dev Sets the default destination chain
     */
    function setDefaultDestinationChain(uint256 destinationChain) external;

    /**
     * @dev Sets a list of custom token outs
     */
    function setCustomDestinationChain(address tokens, uint256 destinationChains) external;
}
