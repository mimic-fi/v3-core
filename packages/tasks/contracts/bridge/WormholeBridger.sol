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
import '@mimic-fi/v3-connectors/contracts/interfaces/wormhole/IWormholeConnector.sol';

import './BaseBridgeTask.sol';
import '../interfaces/bridge/IWormholeBridger.sol';

/**
 * @title Wormhole bridger
 * @dev Task that extends the bridger task to use Wormhole
 */
contract WormholeBridger is IWormholeBridger, BaseBridgeTask {
    using FixedPoint for uint256;

    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('WORMHOLE_BRIDGER');

    /**
     * @dev Wormhole bridge config. Only used in the initializer.
     */
    struct WormholeBridgeConfig {
        BaseBridgeConfig baseBridgeConfig;
    }

    /**
     * @dev Initializes the Wormhole bridger
     * @param config Wormhole bridge config
     */
    function initialize(WormholeBridgeConfig memory config) external virtual initializer {
        __WormholeBridger_init(config);
    }

    /**
     * @dev Initializes the Wormhole bridger. It does call upper contracts initializers.
     * @param config Wormhole bridge config
     */
    function __WormholeBridger_init(WormholeBridgeConfig memory config) internal onlyInitializing {
        __BaseBridgeTask_init(config.baseBridgeConfig);
        __WormholeBridger_init_unchained(config);
    }

    /**
     * @dev Initializes the Wormhole bridger. It does not call upper contracts initializers.
     * @param config Wormhole bridge config
     */
    function __WormholeBridger_init_unchained(WormholeBridgeConfig memory config) internal onlyInitializing {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Execute Wormhole bridger
     */
    function call(address token, uint256 amount, uint256 fee) external override authP(authParams(token, amount, fee)) {
        if (amount == 0) amount = getTaskAmount(token);
        _beforeWormholeBridger(token, amount, fee);

        uint256 minAmountOut = amount - fee;
        bytes memory connectorData = abi.encodeWithSelector(
            IWormholeConnector.execute.selector,
            getDestinationChain(token),
            token,
            amount,
            minAmountOut,
            recipient
        );

        ISmartVault(smartVault).execute(connector, connectorData);
        _afterWormholeBridger(token, amount, fee);
    }

    /**
     * @dev Before Wormhole bridger hook
     */
    function _beforeWormholeBridger(address token, uint256 amount, uint256 fee) internal virtual {
        // Wormhole does not support specifying slippage
        _beforeBaseBridgeTask(token, amount, 0, fee);
    }

    /**
     * @dev After Wormhole bridger hook
     */
    function _afterWormholeBridger(address token, uint256 amount, uint256 fee) internal virtual {
        // Wormhole does not support specifying slippage
        _afterBaseBridgeTask(token, amount, 0, fee);
    }
}
