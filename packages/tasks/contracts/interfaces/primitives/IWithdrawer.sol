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

import '../ITask.sol';

/**
 * @dev Withdrawer task interface
 */
interface IWithdrawer is ITask {
    /**
     * @dev The recipient to be set is the smart vault
     */
    error TaskRecipientSmartVault(address recipient);

    /**
     * @dev The next connector is not zero
     */
    error TaskNextConnectorNotZero(bytes32 next);

    /**
     * @dev Emitted every time the recipient is set
     */
    event RecipientSet(address indexed recipient);

    /**
     * @dev Tells the address of the allowed recipient
     */
    function recipient() external view returns (address);

    /**
     * @dev Sets the recipient address
     * @param recipient Address of the new recipient to be set
     */
    function setRecipient(address recipient) external;

    /**
     * @dev Executes the withdrawer task
     */
    function call(address token, uint256 amount) external;
}
