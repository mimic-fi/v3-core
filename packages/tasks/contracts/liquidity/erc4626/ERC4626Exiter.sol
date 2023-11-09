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

import '@mimic-fi/v3-connectors/contracts/interfaces/liquidity/erc4626/IERC4626Connector.sol';

import './BaseERC4626Task.sol';
import '../../interfaces/liquidity/erc4626/IERC4626Exiter.sol';

/**
 * @title ERC4626 exiter
 * @dev Task that extends the base ERC4626 task to exit an ERC4626 vault
 */
contract ERC4626Exiter is IERC4626Exiter, BaseERC4626Task {
    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('ERC4626_EXITER');

    /**
     * @dev ERC4626 exit config. Only used in the initializer.
     */
    struct ERC4626ExitConfig {
        BaseERC4626Config baseERC4626Config;
    }

    /**
     * @dev Initializes a ERC4626 exiter
     * @param config ERC4626 exit config
     */
    function initialize(ERC4626ExitConfig memory config) external virtual initializer {
        __ERC4626Exiter_init(config);
    }

    /**
     * @dev Initializes the ERC4626 exiter. It does call upper contracts initializers.
     * @param config ERC4626 exit config
     */
    function __ERC4626Exiter_init(ERC4626ExitConfig memory config) internal onlyInitializing {
        __BaseERC4626Task_init(config.baseERC4626Config);
        __ERC4626Exiter_init_unchained(config);
    }

    /**
     * @dev Initializes the ERC4626 exiter. It does not call upper contracts initializers.
     * @param config ERC4626 exit config
     */
    function __ERC4626Exiter_init_unchained(ERC4626ExitConfig memory config) internal onlyInitializing {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Executes the ERC4626 exiter task
     * @param token Address of the token to be exited with
     * @param amount Amount of shares to be exited with
     */
    function call(address token, uint256 amount) external override authP(authParams(token, amount)) {
        if (amount == 0) amount = getTaskAmount(token);
        _beforeERC4626Exiter(token, amount);
        bytes memory connectorData = abi.encodeWithSelector(IERC4626Connector.exit.selector, amount);
        bytes memory result = ISmartVault(smartVault).execute(connector, connectorData);
        (address tokenOut, uint256 amountOut) = abi.decode(result, (address, uint256));
        _afterERC4626Exiter(token, amount, tokenOut, amountOut);
    }

    /**
     * @dev Before ERC4626 exiter hook
     */
    function _beforeERC4626Exiter(address token, uint256 amount) internal virtual {
        _beforeBaseERC4626Task(token, amount);
        address erc4626 = IERC4626Connector(connector).erc4626();
        if (token != erc4626) revert TaskTokenNotERC4626(token, erc4626);
    }

    /**
     * @dev After ERC4626 exiter hook
     */
    function _afterERC4626Exiter(address tokenIn, uint256 amountIn, address tokenOut, uint256 amountOut)
        internal
        virtual
    {
        _afterBaseERC4626Task(tokenIn, amountIn, tokenOut, amountOut);
    }
}
