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

import '../Task.sol';
import '../interfaces/primitives/IWithdrawer.sol';

/**
 * @title Withdrawer task
 * @dev Task that offers a recipient address where funds can be withdrawn
 */
contract Withdrawer is IWithdrawer, Task {
    // Address where tokens will be transferred to
    address public override recipient;

    /**
     * @dev Withdrawer task config. Only used in the initializer.
     * @param recipient Address of the allowed recipient
     * @param taskConfig Task config params
     */
    struct WithdrawerConfig {
        address recipient;
        TaskConfig taskConfig;
    }

    /**
     * @dev Initializes a withdrawer task
     */
    function initialize(WithdrawerConfig memory config) external initializer {
        _initialize(config.taskConfig);
        _setRecipient(config.recipient);
    }

    /**
     * @dev Sets the recipient address. Sender must be authorized.
     * @param newRecipient Address of the new recipient to be set
     */
    function setRecipient(address newRecipient) external override authP(authParams(newRecipient)) {
        _setRecipient(newRecipient);
    }

    /**
     * @dev Executes the withdrawer task
     */
    function call(address token, uint256 amount)
        external
        override
        authP(authParams(token, amount))
        baseTaskCall(token, amount)
    {
        ISmartVault(smartVault).withdraw(token, recipient, amount);
    }

    /**
     * @dev Reverts if the token or the amount are zero
     */
    function _beforeTask(address token, uint256 amount) internal virtual override {
        super._beforeTask(token, amount);
        require(token != address(0), 'TASK_TOKEN_ZERO');
        require(amount > 0, 'TASK_AMOUNT_ZERO');
    }

    /**
     * @dev Sets the recipient address
     * @param newRecipient Address of the new recipient to be set
     */
    function _setRecipient(address newRecipient) internal {
        require(newRecipient != address(0), 'TASK_RECIPIENT_ZERO');
        require(newRecipient != smartVault, 'TASK_RECIPIENT_SMART_VAULT');
        recipient = newRecipient;
        emit RecipientSet(newRecipient);
    }
}
