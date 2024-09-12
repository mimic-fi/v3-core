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

import '@openzeppelin/contracts/utils/Address.sol';

import '@mimic-fi/v3-helpers/contracts/utils/ERC20Helpers.sol';

import '../interfaces/socket/ISocketConnector.sol';

/**
 * @title SocketConnector
 * @dev Interfaces with Socket to bridge tokens
 */
contract SocketConnector is ISocketConnector {
    // Reference to the Socket gateway of the source chain
    address public immutable override socketGateway;

    /**
     * @dev Creates a new Socket connector
     * @param _socketGateway Address of the Socket gateway for the source chain
     */
    constructor(address _socketGateway) {
        socketGateway = _socketGateway;
    }

    /**
     * @dev Executes a bridge of assets using Socket
     * @param token Address of the token to be bridged
     * @param amount Amount of tokens to be bridged
     * @param data Data to be sent to the Socket gateway
     */
    function execute(address token, uint256 amount, bytes memory data) external override {
        uint256 preBalance = IERC20(token).balanceOf(address(this));
        ERC20Helpers.approve(token, socketGateway, amount);
        Address.functionCall(socketGateway, data, 'SOCKET_BRIDGE_FAILED');

        uint256 postBalance = IERC20(token).balanceOf(address(this));
        bool isPostBalanceUnexpected = postBalance < preBalance - amount;
        if (isPostBalanceUnexpected) revert SocketBridgeBadPostTokenBalance(postBalance, preBalance, amount);
    }
}
