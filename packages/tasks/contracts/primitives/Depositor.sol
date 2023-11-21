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
import '@mimic-fi/v3-helpers/contracts/utils/Denominations.sol';

import '../Task.sol';
import '../interfaces/primitives/IDepositor.sol';

/**
 * @title Depositor
 * @dev Task that can be used as the origin to start any workflow
 */
contract Depositor is IDepositor, Task {
    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('DEPOSITOR');

    /**
     * @dev Deposit config. Only used in the initializer.
     */
    struct DepositConfig {
        TaskConfig taskConfig;
    }

    /**
     * @dev Initializes the depositor
     * @param config Deposit config
     */
    function initialize(DepositConfig memory config) external virtual initializer {
        __Depositor_init(config);
    }

    /**
     * @dev Initializes the depositor. It does call upper contracts initializers.
     * @param config Deposit config
     */
    function __Depositor_init(DepositConfig memory config) internal onlyInitializing {
        __Task_init(config.taskConfig);
        __Depositor_init_unchained(config);
    }

    /**
     * @dev Initializes the depositor. It does not call upper contracts initializers.
     * @param config Deposit config
     */
    function __Depositor_init_unchained(DepositConfig memory config) internal onlyInitializing {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Tells the address from where the token amounts to execute this task are fetched
     */
    function getTokensSource() public view virtual override(IBaseTask, BaseTask) returns (address) {
        return address(this);
    }

    /**
     * @dev Tells the balance of the depositor for a given token
     * @param token Address of the token being queried
     */
    function getTaskAmount(address token) public view virtual override(IBaseTask, BaseTask) returns (uint256) {
        return ERC20Helpers.balanceOf(token, getTokensSource());
    }

    /**
     * @dev It allows receiving native token transfers
     */
    receive() external payable {
        if (msg.value == 0) revert TaskValueZero();
    }

    /**
     * @dev Execute Depositor
     */
    function call(address token, uint256 amount) external override authP(authParams(token, amount)) {
        if (amount == 0) amount = getTaskAmount(token);
        _beforeDepositor(token, amount);

        if (Denominations.isNativeToken(token)) {
            Address.sendValue(payable(smartVault), amount);
        } else {
            ERC20Helpers.approve(token, smartVault, amount);
            ISmartVault(smartVault).collect(token, getTokensSource(), amount);
        }

        _afterDepositor(token, amount);
    }

    /**
     * @dev Before depositor hook
     */
    function _beforeDepositor(address token, uint256 amount) internal virtual {
        _beforeTask(token, amount);
        if (token == address(0)) revert TaskTokenZero();
        if (amount == 0) revert TaskAmountZero();
    }

    /**
     * @dev After depositor hook
     */
    function _afterDepositor(address token, uint256 amount) internal virtual {
        _increaseBalanceConnector(token, amount);
        _afterTask(token, amount);
    }

    /**
     * @dev Sets the balance connectors. Previous balance connector must be unset.
     * @param previous Balance connector id of the previous task in the workflow
     * @param next Balance connector id of the next task in the workflow
     */
    function _setBalanceConnectors(bytes32 previous, bytes32 next) internal virtual override {
        if (previous != bytes32(0)) revert TaskPreviousConnectorNotZero(previous);
        super._setBalanceConnectors(previous, next);
    }
}
