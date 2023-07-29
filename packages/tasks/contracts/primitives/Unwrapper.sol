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
import '../interfaces/primitives/IUnwrapper.sol';

/**
 * @title Unwrapper
 * @dev Task that offers facilities to unwrap wrapped native tokens
 */
contract Unwrapper is IUnwrapper, Task {
    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('UNWRAPPER');

    /**
     * @dev Unwrap config. Only used in the initializer.
     * @param taskConfig Task config params
     */
    struct UnwrapConfig {
        TaskConfig taskConfig;
    }

    /**
     * @dev Initializes the unwrapper
     * @param config Unwrap config
     */
    function initialize(UnwrapConfig memory config) external virtual initializer {
        __Unwrapper_init(config);
    }

    /**
     * @dev Initializes the unwrapper. It does call upper contracts initializers.
     * @param config Unwrap config
     */
    function __Unwrapper_init(UnwrapConfig memory config) internal onlyInitializing {
        __Task_init(config.taskConfig);
        __Unwrapper_init_unchained(config);
    }

    /**
     * @dev Initializes the unwrapper. It does not call upper contracts initializers.
     * @param config Unwrap config
     */
    function __Unwrapper_init_unchained(UnwrapConfig memory config) internal onlyInitializing {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Execute Unwrapper
     */
    function call(address token, uint256 amount) external override authP(authParams(token, amount)) {
        _beforeUnwrapper(token, amount);
        ISmartVault(smartVault).unwrap(amount);
        _afterUnwrapper(token, amount);
    }

    /**
     * @dev Before unwrapper hook
     */
    function _beforeUnwrapper(address token, uint256 amount) internal virtual {
        _beforeTask(token, amount);
        if (token != _wrappedNativeToken()) revert TaskTokenNotWrapped();
        if (amount == 0) revert TaskAmountZero();
    }

    /**
     * @dev After unwrapper hook
     */
    function _afterUnwrapper(address token, uint256 amount) internal virtual {
        _increaseBalanceConnector(Denominations.NATIVE_TOKEN, amount);
        _afterTask(token, amount);
    }
}
