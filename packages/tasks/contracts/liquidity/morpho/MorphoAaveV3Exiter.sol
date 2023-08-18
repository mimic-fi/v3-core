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

import '@mimic-fi/v3-connectors/contracts/interfaces/liquidity/morpho/IMorphoAaveV3Connector.sol';
import '@mimic-fi/v3-helpers/contracts/utils/BytesHelpers.sol';

import './BaseMorphoAaveV3Task.sol';
import '../../interfaces/liquidity/morpho/IMorphoAaveV3Exiter.sol';

/**
 * @title Morpho-Aave V3 exiter
 * @dev Task that extends the base Morpho-Aave V3 task to exit Morpho-Aave V3 pools
 */
contract MorphoAaveV3Exiter is IMorphoAaveV3Exiter, BaseMorphoAaveV3Task {
    using BytesHelpers for bytes;

    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('MORPHO_AAVE_V3_EXITER');

    /**
     * @dev Morpho-Aave V3 exit config. Only used in the initializer.
     */
    struct MorphoAaveV3ExitConfig {
        BaseMorphoAaveV3Config baseMorphoAaveV3Config;
    }

    /**
     * @dev Initializes a Morpho-Aave V3 exiter
     * @param config Morpho-Aave V3 exit config
     */
    function initialize(MorphoAaveV3ExitConfig memory config) external virtual initializer {
        __MorphoAaveV3Exiter_init(config);
    }

    /**
     * @dev Initializes the Morpho-Aave V3 exiter. It does call upper contracts initializers.
     * @param config Morpho-Aave V3 exit config
     */
    function __MorphoAaveV3Exiter_init(MorphoAaveV3ExitConfig memory config) internal onlyInitializing {
        __BaseMorphoAaveV3Task_init(config.baseMorphoAaveV3Config);
        __MorphoAaveV3Exiter_init_unchained(config);
    }

    /**
     * @dev Initializes the Morpho-Aave V3 exiter. It does not call upper contracts initializers.
     * @param config Morpho-Aave V3 exit config
     */
    function __MorphoAaveV3Exiter_init_unchained(MorphoAaveV3ExitConfig memory config) internal onlyInitializing {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Executes the Morpho-Aave V3 exiter task
     * @param token Address of the Morpho-Aave V3 pool token to be exited with
     * @param amount Amount of Morpho-Aave V3 pool tokens to be exited with
     * @param maxIterations Maximum number of iterations allowed during the matching process.
     *  If it is less than the default, the latter will be used. Pass 0 to fallback to the default.
     */
    function call(address token, uint256 amount, uint256 maxIterations)
        external
        override
        authP(authParams(token, amount, maxIterations))
    {
        if (amount == 0) amount = getTaskAmount(token);
        _beforeMorphoAaveV3Exiter(token, amount);
        _call(token, amount, maxIterations);
        _afterMorphoAaveV3Exiter(token, amount);
    }

    /**
     * @dev Executes the Morpho-Aave V3 exiter task
     * @param token Address of the Morpho-Aave V3 pool token to be exited with
     * @param amount Amount of Morpho-Aave V3 pool tokens to be exited with
     * @param maxIterations Maximum number of iterations allowed during the matching process.
     *  If it is less than the default, the latter will be used. Pass 0 to fallback to the default.
     */
    function _call(address token, uint256 amount, uint256 maxIterations) internal virtual {
        bytes memory connectorData = abi.encodeWithSelector(
            IMorphoAaveV3Connector.exit.selector,
            token,
            amount,
            maxIterations
        );
        ISmartVault(smartVault).execute(connector, connectorData);
    }

    /**
     * @dev Before Morpho-Aave V3 exiter hook
     */
    function _beforeMorphoAaveV3Exiter(address token, uint256 amount) internal virtual {
        _beforeBaseMorphoAaveV3Task(token, amount);
    }

    /**
     * @dev After Morpho-Aave V3 exiter hook
     */
    function _afterMorphoAaveV3Exiter(address token, uint256 amount) internal virtual {
        _increaseBalanceConnector(token, amount);
        _afterBaseMorphoAaveV3Task(token, amount);
    }
}
