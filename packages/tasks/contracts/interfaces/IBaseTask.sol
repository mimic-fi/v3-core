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

import '@mimic-fi/v3-authorizer/contracts/interfaces/IAuthorizer.sol';
import '@mimic-fi/v3-authorizer/contracts/interfaces/IAuthorized.sol';
import '@mimic-fi/v3-smart-vault/contracts/interfaces/ISmartVault.sol';

/**
 * @dev Base task interface
 */
interface IBaseTask is IAuthorized {
    /**
     * @dev Emitted every time an task is executed
     */
    event Executed();

    /**
     * @dev Emitted every time an task is paused
     */
    event Paused();

    /**
     * @dev Emitted every time an task is unpaused
     */
    event Unpaused();

    /**
     * @dev Emitted every time the group ID is set
     */
    event GroupIdSet(uint8 indexed groupId);

    /**
     * @dev Tells the group ID of the task
     */
    function groupId() external view returns (uint8);

    /**
     * @dev Tells the address of the Smart Vault tied to it, it cannot be changed
     */
    function smartVault() external view returns (address);

    /**
     * @dev Tells the task is paused or not
     */
    function isPaused() external view returns (bool);

    /**
     * @dev Tells the balance of the task for a given token
     * @param token Address of the token querying the balance of
     */
    function getTaskBalance(address token) external view returns (uint256);

    /**
     * @dev Tells the balance of the Smart Vault for a given token
     * @param token Address of the token querying the balance of
     */
    function getSmartVaultBalance(address token) external view returns (uint256);

    /**
     * @dev Tells the total balance for a given token
     * @param token Address of the token querying the balance of
     */
    function getTotalBalance(address token) external view returns (uint256);

    /**
     * @dev Pauses an task
     */
    function pause() external;

    /**
     * @dev Unpauses an task
     */
    function unpause() external;

    /**
     * @dev Sets a group ID for the task. Sender must be authorized
     * @param groupId ID of the group to be set for the task
     */
    function setGroupId(uint8 groupId) external;

    /**
     * @dev Transfers task's assets to the Smart Vault
     * @param token Address of the token to be transferred
     * @param amount Amount of tokens to be transferred
     */
    function transferToSmartVault(address token, uint256 amount) external;
}
