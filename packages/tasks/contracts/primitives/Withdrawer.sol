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
 * @title Withdrawer
 * @dev Task that offers a recipient address where funds can be withdrawn
 */
contract Withdrawer is IWithdrawer, Task {
    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('WITHDRAWER');

    // Address where tokens will be transferred to
    address public override recipient;

    /**
     * @dev Withdraw config. Only used in the initializer.
     */
    struct WithdrawConfig {
        address recipient;
        TaskConfig taskConfig;
    }

    /**
     * @dev Initializes the withdrawer
     * @param config Withdraw config
     */
    function initialize(WithdrawConfig memory config) external virtual initializer {
        __Withdrawer_init(config);
    }

    /**
     * @dev Initializes the withdrawer. It does call upper contracts initializers.
     * @param config Withdraw config
     */
    function __Withdrawer_init(WithdrawConfig memory config) internal onlyInitializing {
        __Task_init(config.taskConfig);
        __Withdrawer_init_unchained(config);
    }

    /**
     * @dev Initializes the withdrawer. It does not call upper contracts initializers.
     * @param config Withdraw config
     */
    function __Withdrawer_init_unchained(WithdrawConfig memory config) internal onlyInitializing {
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
     * @dev Executes the Withdrawer
     */
    function call(address token, uint256 amount) external virtual override authP(authParams(token, amount)) {
        if (amount == 0) amount = getTaskAmount(token);
        _beforeWithdrawer(token, amount);
        ISmartVault(smartVault).withdraw(token, recipient, amount);
        _afterWithdrawer(token, amount);
    }

    /**
     * @dev Before withdrawer hook
     */
    function _beforeWithdrawer(address token, uint256 amount) internal virtual {
        _beforeTask(token, amount);
        if (token == address(0)) revert TaskTokenZero();
        if (amount == 0) revert TaskAmountZero();
    }

    /**
     * @dev After withdrawer hook
     */
    function _afterWithdrawer(address token, uint256 amount) internal virtual {
        _afterTask(token, amount);
    }

    /**
     * @dev Sets the recipient address
     * @param newRecipient Address of the new recipient to be set
     */
    function _setRecipient(address newRecipient) internal {
        if (newRecipient == address(0)) revert TaskRecipientZero();
        if (newRecipient == smartVault) revert TaskRecipientEqualsSmartVault(newRecipient);
        recipient = newRecipient;
        emit RecipientSet(newRecipient);
    }

    /**
     * @dev Sets the balance connectors. Next balance connector must be unset.
     * @param previous Balance connector id of the previous task in the workflow
     * @param next Balance connector id of the next task in the workflow
     */
    function _setBalanceConnectors(bytes32 previous, bytes32 next) internal virtual override {
        if (next != bytes32(0)) revert TaskNextConnectorNotZero(next);
        super._setBalanceConnectors(previous, next);
    }
}
