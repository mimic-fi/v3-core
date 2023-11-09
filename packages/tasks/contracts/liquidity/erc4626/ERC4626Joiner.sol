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
import '../../interfaces/liquidity/erc4626/IERC4626Joiner.sol';

/**
 * @title ERC4626 joiner
 * @dev Task that extends the base ERC4626 task to join an ERC4626 vault
 */
contract ERC4626Joiner is IERC4626Joiner, BaseERC4626Task {
    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('ERC4626_JOINER');

    /**
     * @dev ERC4626 join config. Only used in the initializer.
     */
    struct ERC4626JoinConfig {
        BaseERC4626Config baseERC4626Config;
    }

    /**
     * @dev Initializes a ERC4626 joiner
     * @param config ERC4626 join config
     */
    function initialize(ERC4626JoinConfig memory config) external virtual initializer {
        __ERC4626Joiner_init(config);
    }

    /**
     * @dev Initializes the ERC4626 joiner. It does call upper contracts initializers.
     * @param config ERC4626 join config
     */
    function __ERC4626Joiner_init(ERC4626JoinConfig memory config) internal onlyInitializing {
        __BaseERC4626Task_init(config.baseERC4626Config);
        __ERC4626Joiner_init_unchained(config);
    }

    /**
     * @dev Initializes the ERC4626 joiner. It does not call upper contracts initializers.
     * @param config ERC4626 join config
     */
    function __ERC4626Joiner_init_unchained(ERC4626JoinConfig memory config) internal onlyInitializing {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Executes the ERC4626 joiner task
     * @param token Address of the token to be joined with
     * @param amount Amount of assets to be joined with
     */
    function call(address token, uint256 amount) external override authP(authParams(token, amount)) {
        if (amount == 0) amount = getTaskAmount(token);
        _beforeERC4626Joiner(token, amount);
        bytes memory connectorData = abi.encodeWithSelector(IERC4626Connector.join.selector, amount);
        bytes memory result = ISmartVault(smartVault).execute(connector, connectorData);
        (address tokenOut, uint256 amountOut) = abi.decode(result, (address, uint256));
        _afterERC4626Joiner(token, amount, tokenOut, amountOut);
    }

    /**
     * @dev Before ERC4626 joiner hook
     */
    function _beforeERC4626Joiner(address token, uint256 amount) internal virtual {
        _beforeBaseERC4626Task(token, amount);
        address underlying = IERC4626Connector(connector).getToken();
        if (token != underlying) revert TaskTokenNotUnderlying(token, underlying);
    }

    /**
     * @dev After ERC4626 joiner hook
     */
    function _afterERC4626Joiner(address tokenIn, uint256 amountIn, address tokenOut, uint256 amountOut)
        internal
        virtual
    {
        _afterBaseERC4626Task(tokenIn, amountIn, tokenOut, amountOut);
    }
}
