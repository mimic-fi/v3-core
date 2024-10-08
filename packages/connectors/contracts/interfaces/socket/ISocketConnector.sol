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

/**
 * @title Socket connector interface
 */
interface ISocketConnector {
    /**
     * @dev The post token balance is lower than the previous token balance minus the amount bridged
     */
    error SocketBridgeBadPostTokenBalance(uint256 postBalance, uint256 preBalance, uint256 amount);

    /**
     * @dev Tells the reference to the Socket gateway of the source chain
     */
    function socketGateway() external view returns (address);

    /**
     * @dev Executes a bridge of assets using Socket
     * @param token Address of the token to be bridged
     * @param amount Amount of tokens to be bridged
     * @param data Data to be sent to the socket gateway
     */
    function execute(address token, uint256 amount, bytes memory data) external;
}
