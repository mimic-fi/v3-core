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
import '@mimic-fi/v3-connectors/contracts/interfaces/symbiosis/ISymbiosisConnector.sol';

import './BaseBridgeTask.sol';
import '../interfaces/bridge/ISymbiosisBridger.sol';

/**
 * @title Symbiosis bridger
 * @dev Task that extends the base bridge task to use Symbiosis
 */
contract SymbiosisBridger is ISymbiosisBridger, BaseBridgeTask {
    using FixedPoint for uint256;

    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('SYMBIOSIS_BRIDGER');

    /**
     * @dev Symbiosis bridge config. Only used in the initializer.
     */
    struct SymbiosisBridgeConfig {
        BaseBridgeConfig baseBridgeConfig;
    }

    /**
     * @dev Initializes the Symbiosis bridger
     * @param config Symbiosis bridge config
     */
    function initialize(SymbiosisBridgeConfig memory config) external virtual initializer {
        __SymbiosisBridger_init(config);
    }

    /**
     * @dev Initializes the Symbiosis bridger. It does call upper contracts initializers.
     * @param config Symbiosis bridge config
     */
    function __SymbiosisBridger_init(SymbiosisBridgeConfig memory config) internal onlyInitializing {
        __BaseBridgeTask_init(config.baseBridgeConfig);
        __SymbiosisBridger_init_unchained(config);
    }

    /**
     * @dev Initializes the Symbiosis bridger. It does not call upper contracts initializers.
     * @param config Symbiosis bridge config
     */
    function __SymbiosisBridger_init_unchained(SymbiosisBridgeConfig memory config) internal onlyInitializing {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Execute Symbiosis bridger
     */
    function call(address token, uint256 amount, bytes memory data) external override authP(authParams(token, amount)) {
        if (amount == 0) amount = getTaskAmount(token);
        _beforeSymbiosisBridger(token, amount);

        bytes memory connectorData = abi.encodeWithSelector(ISymbiosisConnector.execute.selector, token, amount, data);

        ISmartVault(smartVault).execute(connector, connectorData);
        _afterSymbiosisBridger(token, amount);
    }

    /**
     * @dev Before Symbiosis bridger hook
     */
    function _beforeSymbiosisBridger(address token, uint256 amount) internal virtual {
        // Symbiosis does not support specifying slippage nor fee
        _beforeBaseBridgeTask(token, amount, 0, 0);
    }

    /**
     * @dev After Symbiosis bridger task hook
     */
    function _afterSymbiosisBridger(address token, uint256 amount) internal virtual {
        // Symbiosis does not support specifying slippage nor fee
        _afterBaseBridgeTask(token, amount, 0, 0);
    }
}
