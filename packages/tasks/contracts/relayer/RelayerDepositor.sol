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

import '@mimic-fi/helpers/contracts/math/FixedPoint.sol';
import '@mimic-fi/v3-relayer/contracts/interfaces/IRelayer.sol';

import '../Task.sol';
import '../interfaces/relayer/IRelayerDepositor.sol';

/**
 * @title Relayer depositor
 * @dev Task that offers facilities to deposit balance for Mimic relayers
 */
contract RelayerDepositor is IRelayerDepositor, Task {
    using FixedPoint for uint256;

    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('RELAYER_DEPOSITOR');

    // Reference to the contract to be funded
    address public override relayer;

    /**
     * @dev Initializes the relayer depositor
     * @param config Task config
     * @param _relayer Relayer address
     */
    function initialize(TaskConfig memory config, address _relayer) external virtual initializer {
        __RelayerDepositor_init(config, _relayer);
    }

    /**
     * @dev Initializes the relayer depositor. It does call upper contracts initializers.
     * @param config Task config
     * @param _relayer Relayer address
     */
    function __RelayerDepositor_init(TaskConfig memory config, address _relayer) internal onlyInitializing {
        __Task_init(config);
        __RelayerDepositor_init_unchained(config, _relayer);
    }

    /**
     * @dev Initializes the relayer depositor. It does not call upper contracts initializers.
     * @param _relayer Relayer address
     */
    function __RelayerDepositor_init_unchained(TaskConfig memory, address _relayer) internal onlyInitializing {
        _setRelayer(_relayer);
    }

    /**
     * @dev Sets the relayer
     * @param newRelayer Address of the relayer to be set
     */
    function setRelayer(address newRelayer) external override authP(authParams(newRelayer)) {
        _setRelayer(newRelayer);
    }

    /**
     * @dev Executes the relayer depositor task
     */
    function call(address token, uint256 amount) external override authP(authParams(token, amount)) {
        if (amount == 0) amount = getTaskAmount(token);
        _beforeRelayerDepositor(token, amount);
        bytes memory relayerData = abi.encodeWithSelector(IRelayer.deposit.selector, smartVault, amount);
        // solhint-disable-next-line avoid-low-level-calls
        ISmartVault(smartVault).call(relayer, relayerData, amount);
        _afterRelayerDepositor(token, amount);
    }

    /**
     * @dev Before relayer depositor hook
     */
    function _beforeRelayerDepositor(address token, uint256 amount) internal virtual {
        _beforeTask(token, amount);
        if (amount == 0) revert TaskAmountZero();
    }

    /**
     * @dev After relayer depositor hook
     */
    function _afterRelayerDepositor(address token, uint256 amount) internal virtual {
        _afterTask(token, amount);
    }

    /**
     * @dev Sets the relayer
     * @param newRelayer Address of the relayer to be set
     */
    function _setRelayer(address newRelayer) internal {
        if (newRelayer == address(0)) revert TaskRelayerZero();
        relayer = newRelayer;
        emit RelayerSet(newRelayer);
    }
}
