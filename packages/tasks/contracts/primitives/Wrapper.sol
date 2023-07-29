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

import '@mimic-fi/v3-helpers/contracts/utils/Denominations.sol';

import '../Task.sol';
import '../interfaces/primitives/IWrapper.sol';

/**
 * @title Wrapper
 * @dev Task that offers facilities to wrap native tokens
 */
contract Wrapper is IWrapper, Task {
    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('WRAPPER');

    /**
     * @dev Wrap config. Only used in the initializer.
     */
    struct WrapConfig {
        TaskConfig taskConfig;
    }

    /**
     * @dev Initializes the wrapper
     * @param config Wrap config
     */
    function initialize(WrapConfig memory config) external virtual initializer {
        __Wrapper_init(config);
    }

    /**
     * @dev Initializes the wrapper. It does call upper contracts initializers.
     * @param config Wrap config
     */
    function __Wrapper_init(WrapConfig memory config) internal onlyInitializing {
        __Task_init(config.taskConfig);
        __Wrapper_init_unchained(config);
    }

    /**
     * @dev Initializes the wrapper. It does not call upper contracts initializers.
     * @param config Wrap config
     */
    function __Wrapper_init_unchained(WrapConfig memory config) internal onlyInitializing {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Execute Wrapper
     */
    function call(address token, uint256 amount) external override authP(authParams(token, amount)) {
        if (amount == 0) amount = getTaskAmount(token);
        _beforeWrapper(token, amount);
        ISmartVault(smartVault).wrap(amount);
        _afterWrapper(token, amount);
    }

    /**
     * @dev Before wrapper hook
     */
    function _beforeWrapper(address token, uint256 amount) internal virtual {
        _beforeTask(token, amount);
        if (token != Denominations.NATIVE_TOKEN) revert TaskTokenNotNative();
        if (amount == 0) revert TaskAmountZero();
    }

    /**
     * @dev After wrapper hook
     */
    function _afterWrapper(address token, uint256 amount) internal virtual {
        _increaseBalanceConnector(_wrappedNativeToken(), amount);
        _afterTask(token, amount);
    }
}
