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

import '@mimic-fi/v3-helpers/contracts/math/FixedPoint.sol';
import '@mimic-fi/v3-relayer/contracts/interfaces/IRelayer.sol';

import '../Task.sol';
import './interfaces/IDepositor.sol';

contract Depositor is IDepositor, Task {
    using FixedPoint for uint256;

    // Reference to the contract to be funded
    address public override recipient;

    /**
     * @dev Depositor task config. Only used in the initializer.
     */
    struct DepositorConfig {
        address recipient;
        TaskConfig taskConfig;
    }

    /**
     * @dev Creates a Depositor task
     * @param config Depositor task config
     */
    function initialize(DepositorConfig memory config) external initializer {
        _initialize(config.taskConfig);

        require(config.recipient != address(0), 'DEPOSITOR_RECIPIENT_ZERO');
        recipient = config.recipient;
    }

    /**
     * @dev Executes the depositor task
     */
    function call(uint256 amount)
        external
        override
        authP(authParams(amount))
        baseTaskCall(_wrappedNativeToken(), amount)
    {
        bytes memory recipientData = abi.encodeWithSelector(IRelayer.deposit.selector, smartVault, amount);
        ISmartVault(smartVault).call(recipient, recipientData, amount);
    }

    /**
     * @dev Reverts if the token or the amount are zero
     */
    function _beforeTask(address token, uint256 amount) internal override {
        super._beforeTask(token, amount);
        require(token == _wrappedNativeToken(), 'TASK_NOT_NATIVE_TOKEN');
        require(amount > 0, 'TASK_AMOUNT_ZERO');
    }
}
